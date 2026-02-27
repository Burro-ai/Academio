#!/usr/bin/env tsx
/**
 * ingest-curriculum.ts
 *
 * Parses, chunks, embeds, and indexes NEM 2023 textbooks into the
 * `curriculum_standards` ChromaDB collection for curriculum-grounded RAG.
 *
 * Pipeline:
 *   PDF → text extraction → recursive chunking (1000/200) → Ollama embeddings → ChromaDB upsert
 *
 * Usage:
 *   npm run curriculum:ingest                      # All grades
 *   npm run curriculum:ingest:grade1               # Grade 01_primaria_1 only (pilot)
 *   npm run curriculum:ingest -- --grade 02_primaria_2  # Specific grade
 *   npm run curriculum:ingest -- --clear           # Clear collection first, then ingest all
 *   npm run curriculum:ingest -- --dry-run         # Preview: count chunks without embedding
 */

import { ChromaClient, Collection, IncludeEnum } from 'chromadb';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, basename } from 'path';

// pdf-parse has no @types — use require with inline type
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (
  buf: Buffer,
  opts?: Record<string, unknown>
) => Promise<{ text: string; numpages: number }>;

// ─── Constants ────────────────────────────────────────────────────────────────

const COLLECTION_NAME = 'curriculum_standards';
const CURRICULUM_DIR  = join(__dirname, '../../data/curriculum/nem-2023');
const CHUNK_SIZE      = 1000;
const CHUNK_OVERLAP   = 200;
const BATCH_SIZE      = 50;
const EMBED_MODEL     = 'qwen3-embedding';

const CHROMA_HOST = process.env.CHROMA_HOST || 'localhost';
const CHROMA_PORT = process.env.CHROMA_PORT || '8000';
const OLLAMA_URL  = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const IS_DRY_RUN  = args.includes('--dry-run');
const CLEAR_FIRST = args.includes('--clear');
const gradeArgIdx = args.indexOf('--grade');
const GRADE_FILTER = gradeArgIdx !== -1 ? args[gradeArgIdx + 1] : null;

// ─── Subject / grade display maps ─────────────────────────────────────────────

const SUBJECT_DISPLAY: Record<string, string> = {
  libro_para_maestros:               'Libro para Maestros',
  multiples_lenguajes:               'Múltiples Lenguajes',
  proyectos_de_aula:                 'Proyectos de Aula',
  proyectos_comunitarios:            'Proyectos Comunitarios',
  proyectos_escolares:               'Proyectos Escolares',
  saberes_y_pensamiento_cientifico:  'Saberes y Pensamiento Científico',
  de_lo_humano_y_comunitario:        'De lo Humano y Comunitario',
  etica_naturaleza_y_sociedades:     'Ética, Naturaleza y Sociedades',
  humanidades:                       'Humanidades',
  lengua_y_literatura:               'Lengua y Literatura',
  nuestros_saberes:                  'Nuestros Saberes',
  saberes_cientificos:               'Saberes Científicos',
};

/** '01_primaria_1' → '1° Primaria' */
function gradeLabel(gradeDir: string): string {
  const m = gradeDir.match(/\d+_(primaria|secundaria)_(\d+)/);
  if (!m) return gradeDir;
  return `${m[2]}° ${m[1] === 'primaria' ? 'Primaria' : 'Secundaria'}`;
}

/** 'saberes_y_pensamiento_cientifico_primaria_1.pdf' → { subject, level, grade } */
function parseFilename(filename: string): {
  subjectCode: string;
  subjectDisplay: string;
  level: string;
  grade: string;
} | null {
  const base = filename.replace(/\.pdf$/i, '');
  // Format: {subject}_{primaria|secundaria}_{grade_num}
  const m = base.match(/^(.+)_(primaria|secundaria)_(\d+)$/);
  if (!m) return null;
  const subjectCode = m[1];
  return {
    subjectCode,
    subjectDisplay: SUBJECT_DISPLAY[subjectCode] ?? subjectCode.replace(/_/g, ' '),
    level: m[2],
    grade: m[3],
  };
}

// ─── Recursive Character Text Splitter ───────────────────────────────────────

const SEPARATORS = ['\n\n', '\n', '. ', ' '];

function recursiveSplit(text: string): string[] {
  const rawChunks = splitDown(text.trim(), 0);

  // Apply overlap: each chunk starts with the last CHUNK_OVERLAP chars of the previous
  if (rawChunks.length <= 1) return rawChunks;
  const result: string[] = [rawChunks[0]];
  for (let i = 1; i < rawChunks.length; i++) {
    const prev = result[i - 1];
    const tail = prev.length > CHUNK_OVERLAP ? prev.slice(-CHUNK_OVERLAP) : prev;
    result.push(tail + ' ' + rawChunks[i]);
  }
  return result;
}

function splitDown(text: string, sepIdx: number): string[] {
  if (text.length <= CHUNK_SIZE) return text ? [text] : [];

  const sep = SEPARATORS[sepIdx];
  if (sep === undefined) {
    // Hard char split as last resort
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      chunks.push(text.slice(i, i + CHUNK_SIZE));
    }
    return chunks;
  }

  const parts = text.split(sep).filter(p => p.trim().length > 0);
  if (parts.length <= 1) return splitDown(text, sepIdx + 1);

  const chunks: string[] = [];
  let current = '';

  for (const part of parts) {
    const joined = current ? `${current}${sep}${part}` : part;
    if (joined.length <= CHUNK_SIZE) {
      current = joined;
    } else {
      if (current) chunks.push(current.trim());
      if (part.length > CHUNK_SIZE) {
        chunks.push(...splitDown(part, sepIdx + 1));
        current = '';
      } else {
        current = part;
      }
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ─── Embedding ────────────────────────────────────────────────────────────────

async function embed(text: string): Promise<number[] | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json() as { embedding: number[] };
    return data.embedding;
  } catch (err) {
    return null;
  }
}

/** Ping Ollama — throws if not running. */
async function assertOllamaOnline(): Promise<void> {
  const res = await fetch(`${OLLAMA_URL}/api/tags`).catch(() => null);
  if (!res || !res.ok) {
    throw new Error(
      `Ollama is not running at ${OLLAMA_URL}\n` +
      'Start it with: ollama serve'
    );
  }
  // Verify the embedding model exists
  const data = await res.json() as { models: { name: string }[] };
  const has = data.models?.some(m => m.name.startsWith(EMBED_MODEL));
  if (!has) {
    throw new Error(
      `Embedding model "${EMBED_MODEL}" not found in Ollama.\n` +
      `Pull it with: ollama pull ${EMBED_MODEL}`
    );
  }
}

// ─── ChromaDB helpers ─────────────────────────────────────────────────────────

async function getCollection(
  client: ChromaClient,
  clear: boolean
): Promise<Collection> {
  if (clear) {
    try {
      await client.deleteCollection({ name: COLLECTION_NAME });
      console.log(`  Deleted existing "${COLLECTION_NAME}" collection.`);
    } catch {
      // Collection didn't exist — fine
    }
  }
  return client.getOrCreateCollection({
    name: COLLECTION_NAME,
    metadata: {
      description: 'NEM 2023 curriculum textbooks — Primaria & Secundaria',
      source: 'https://github.com/incognia/CONALITEG',
      license: 'CC0-1.0',
    },
  });
}

// ─── Ingest a single PDF ──────────────────────────────────────────────────────

interface Chunk {
  id: string;
  text: string;
  metadata: {
    grade_level: string;   // '1° Primaria'
    grade_dir: string;     // '01_primaria_1'
    subject: string;       // 'Saberes y Pensamiento Científico'
    subject_code: string;  // 'saberes_y_pensamiento_cientifico'
    book_title: string;    // 'Saberes y Pensamiento Científico — 1° Primaria'
    source_file: string;   // filename
    source_page: number;   // estimated
    chunk_index: number;
  };
}

async function extractChunks(
  pdfPath: string,
  gradeDir: string
): Promise<Chunk[]> {
  const filename = basename(pdfPath);
  const parsed = parseFilename(filename);
  if (!parsed) {
    console.warn(`  ⚠  Cannot parse filename: ${filename} — skipping`);
    return [];
  }

  const buf = readFileSync(pdfPath);
  const { text, numpages } = await pdfParse(buf, { max: 0 });

  const grade = gradeLabel(gradeDir);
  const bookTitle = `${parsed.subjectDisplay} — ${grade}`;
  const totalLen = text.length;

  const allChunks = recursiveSplit(text);
  const chunks: Chunk[] = [];
  let offset = 0;

  for (let i = 0; i < allChunks.length; i++) {
    const chunkText = allChunks[i];
    // Estimate page based on character position in original text
    const estimatedPage = Math.max(
      1,
      Math.ceil((offset / Math.max(totalLen, 1)) * numpages)
    );

    // Deterministic ID — safe for upsert idempotency
    const safeGrade = gradeDir.replace(/\W/g, '_');
    const safeSubject = parsed.subjectCode.slice(0, 30);
    const id = `nem_${safeGrade}_${safeSubject}_p${String(estimatedPage).padStart(4, '0')}_c${String(i).padStart(4, '0')}`;

    chunks.push({
      id,
      text: chunkText,
      metadata: {
        grade_level:  grade,
        grade_dir:    gradeDir,
        subject:      parsed.subjectDisplay,
        subject_code: parsed.subjectCode,
        book_title:   bookTitle,
        source_file:  filename,
        source_page:  estimatedPage,
        chunk_index:  i,
      },
    });

    offset += chunkText.length - CHUNK_OVERLAP; // approximate original position
  }

  return chunks;
}

// ─── Flush a batch to ChromaDB ────────────────────────────────────────────────

async function flushBatch(
  collection: Collection,
  batch: Chunk[],
  batchNum: number,
  totalBatches: number
): Promise<{ embedded: number; failed: number }> {
  let embedded = 0;
  let failed = 0;

  process.stdout.write(
    `    Batch ${batchNum}/${totalBatches}: embedding ${batch.length} chunks...`
  );

  const embedStart = Date.now();
  const ids: string[]                 = [];
  const embeddings: number[][]        = [];
  const documents: string[]           = [];
  const metadatas: Chunk['metadata'][] = [];

  for (const chunk of batch) {
    const vec = await embed(chunk.text);
    if (!vec) {
      process.stdout.write('✗');
      failed++;
      // Still upsert without embedding so the document is searchable by metadata
    } else {
      process.stdout.write('.');
      embedded++;
    }
    ids.push(chunk.id);
    if (vec) embeddings.push(vec);
    documents.push(chunk.text);
    metadatas.push(chunk.metadata);
  }

  const msPerChunk = Math.round((Date.now() - embedStart) / batch.length);
  process.stdout.write(` ${msPerChunk}ms/chunk\n`);

  // Upsert to ChromaDB — idempotent (re-run safe)
  await collection.upsert({
    ids,
    embeddings: embeddings.length === batch.length ? embeddings : undefined,
    documents,
    metadatas,
  });

  return { embedded, failed };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   NEM 2023 Curriculum Ingest — curriculum_standards          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  if (IS_DRY_RUN)  console.log('  MODE: DRY-RUN (no embeddings or ChromaDB writes)\n');
  if (GRADE_FILTER) console.log(`  FILTER: --grade ${GRADE_FILTER}\n`);
  if (CLEAR_FIRST)  console.log('  ACTION: --clear (will delete collection before ingest)\n');

  // 1. Validate curriculum directory
  if (!existsSync(CURRICULUM_DIR)) {
    throw new Error(
      `Curriculum directory not found: ${CURRICULUM_DIR}\n` +
      'Run "npm run curriculum:fetch" first to download the textbooks.'
    );
  }

  // 2. Discover grade dirs
  const allGradeDirs = readdirSync(CURRICULUM_DIR)
    .filter(d => statSync(join(CURRICULUM_DIR, d)).isDirectory())
    .sort();

  const gradeDirs = GRADE_FILTER
    ? allGradeDirs.filter(d => d.startsWith(GRADE_FILTER))
    : allGradeDirs;

  if (gradeDirs.length === 0) {
    throw new Error(`No grade directories found matching "${GRADE_FILTER}"`);
  }

  // 3. Discover PDFs
  const pdfFiles: { gradeDir: string; path: string; filename: string }[] = [];
  for (const gradeDir of gradeDirs) {
    const dir = join(CURRICULUM_DIR, gradeDir);
    for (const f of readdirSync(dir)) {
      if (f.toLowerCase().endsWith('.pdf')) {
        pdfFiles.push({ gradeDir, path: join(dir, f), filename: f });
      }
    }
  }

  if (pdfFiles.length === 0) {
    throw new Error(
      'No PDF files found in the curriculum directory.\n' +
      'Run "npm run curriculum:fetch" first to download the textbooks.\n' +
      '(If files are present, ensure they are not LFS pointers — check with "head -1 <file.pdf)")'
    );
  }

  console.log(`Found ${pdfFiles.length} PDFs across ${gradeDirs.length} grade dir(s):`);
  for (const gradeDir of gradeDirs) {
    const count = pdfFiles.filter(f => f.gradeDir === gradeDir).length;
    console.log(`  ${gradeDir}: ${count} file(s)`);
  }
  console.log('');

  if (IS_DRY_RUN) {
    // Parse + chunk only — no embeddings
    let totalChunks = 0;
    for (const { gradeDir, path, filename } of pdfFiles) {
      process.stdout.write(`  Parsing ${filename}...`);
      const chunks = await extractChunks(path, gradeDir);
      process.stdout.write(` ${chunks.length} chunks\n`);
      totalChunks += chunks.length;
    }
    console.log(`\n  Total chunks (dry-run): ${totalChunks}`);
    console.log(`  Batches of ${BATCH_SIZE}: ~${Math.ceil(totalChunks / BATCH_SIZE)}`);
    console.log('\nDry-run complete — no data written.');
    return;
  }

  // 4. Check Ollama
  console.log('Checking Ollama...');
  await assertOllamaOnline();
  console.log(`  Ollama online ✓ — model: ${EMBED_MODEL}\n`);

  // 5. Connect ChromaDB
  console.log('Connecting to ChromaDB...');
  const chroma = new ChromaClient({ path: `http://${CHROMA_HOST}:${CHROMA_PORT}` });
  await chroma.listCollections(); // will throw if unavailable
  console.log(`  ChromaDB connected ✓ (${CHROMA_HOST}:${CHROMA_PORT})\n`);

  const collection = await getCollection(chroma, CLEAR_FIRST);
  console.log(`  Collection: "${COLLECTION_NAME}" ready\n`);

  // 6. Ingest
  const startTime = Date.now();
  let grandTotalChunks    = 0;
  let grandTotalEmbedded  = 0;
  let grandTotalFailed    = 0;

  for (let fi = 0; fi < pdfFiles.length; fi++) {
    const { gradeDir, path, filename } = pdfFiles[fi];
    console.log(`[${fi + 1}/${pdfFiles.length}] ${gradeDir}/${filename}`);

    // Extract chunks
    process.stdout.write('  Parsing PDF...');
    let chunks: Chunk[];
    try {
      chunks = await extractChunks(path, gradeDir);
    } catch (err) {
      console.error(`\n  ✗ Parse failed: ${err} — skipping`);
      continue;
    }
    console.log(` ${chunks.length} chunks from ${chunks[0]?.metadata.book_title ?? filename}`);

    if (chunks.length === 0) continue;

    // Batch embed + upsert
    const numBatches = Math.ceil(chunks.length / BATCH_SIZE);
    let fileEmbedded = 0;
    let fileFailed   = 0;

    for (let b = 0; b < numBatches; b++) {
      const batch = chunks.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
      const { embedded, failed } = await flushBatch(
        collection, batch, b + 1, numBatches
      );
      fileEmbedded += embedded;
      fileFailed   += failed;
    }

    console.log(
      `  ✔ ${fileEmbedded} embedded, ${fileFailed} failed ` +
      `(${chunks.length} total chunks)\n`
    );

    grandTotalChunks   += chunks.length;
    grandTotalEmbedded += fileEmbedded;
    grandTotalFailed   += fileFailed;
  }

  // 7. Summary
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const elapsedDisplay = elapsed >= 60
    ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
    : `${elapsed}s`;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`✅  Ingest complete in ${elapsedDisplay}`);
  console.log(`    Total chunks : ${grandTotalChunks}`);
  console.log(`    Embedded     : ${grandTotalEmbedded}`);
  console.log(`    Failed       : ${grandTotalFailed}`);
  console.log(`    Collection   : ${COLLECTION_NAME}`);
  console.log('');
  console.log('Verify with:');
  console.log('  npm run curriculum:query -- "Fricción y fuerza"');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('\n❌  Fatal error:', err.message || err);
  process.exit(1);
});
