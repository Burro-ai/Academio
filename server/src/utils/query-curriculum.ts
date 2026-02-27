#!/usr/bin/env tsx
/**
 * query-curriculum.ts
 *
 * Validates that the curriculum_standards ChromaDB collection is populated
 * and can retrieve semantically relevant chunks for a given query.
 *
 * Usage:
 *   npm run curriculum:query -- "Fricción y fuerza"
 *   npm run curriculum:query -- "fracciones equivalentes"
 *   npm run curriculum:query -- "ecosistemas marinos"
 *
 * Direct:
 *   tsx src/utils/query-curriculum.ts "Fricción y fuerza"
 */

import { ChromaClient, IncludeEnum } from 'chromadb';

// ─── Config ───────────────────────────────────────────────────────────────────

const COLLECTION_NAME = 'curriculum_standards';
const EMBED_MODEL     = 'qwen3-embedding';
const TOP_K           = 5;

const CHROMA_HOST = process.env.CHROMA_HOST || 'localhost';
const CHROMA_PORT = process.env.CHROMA_PORT || '8000';
const OLLAMA_URL  = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  });
  if (!res.ok) throw new Error(`Ollama embed failed: HTTP ${res.status}`);
  const data = await res.json() as { embedding: number[] };
  if (!data.embedding?.length) throw new Error('Ollama returned empty embedding');
  return data.embedding;
}

function truncate(text: string, maxLen = 300): string {
  return text.length <= maxLen ? text : text.slice(0, maxLen) + '…';
}

/** L2 distance → cosine-style similarity (0–1) */
function distToSimilarity(dist: number): number {
  return Math.round((1 / (1 + dist)) * 100) / 100;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Accept query from: npm run curriculum:query -- "text"
  // or direct: tsx query-curriculum.ts "text"
  const rawArgs = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const query = rawArgs.join(' ').trim();

  if (!query) {
    console.error('Usage: npm run curriculum:query -- "<search query>"');
    console.error('Example: npm run curriculum:query -- "Fricción y fuerza"');
    process.exit(1);
  }

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   Curriculum RAG — Query Validation                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`Query: "${query}"\n`);

  // 1. Connect ChromaDB
  process.stdout.write('Connecting to ChromaDB...');
  const chroma = new ChromaClient({ path: `http://${CHROMA_HOST}:${CHROMA_PORT}` });
  try {
    await chroma.listCollections();
  } catch {
    throw new Error(
      `ChromaDB not reachable at ${CHROMA_HOST}:${CHROMA_PORT}\n` +
      'Start it with: docker run -p 8000:8000 chromadb/chroma'
    );
  }
  console.log(' ✓\n');

  // 2. Get collection — check existence first (getCollection requires embeddingFunction in v1.x)
  const existingCollections = await chroma.listCollections();
  const collectionNames = (existingCollections as unknown as Array<{ name: string } | string>)
    .map(c => (typeof c === 'string' ? c : c.name));

  if (!collectionNames.includes(COLLECTION_NAME)) {
    throw new Error(
      `Collection "${COLLECTION_NAME}" not found.\n` +
      'Run "npm run curriculum:ingest -- --grade 01_primaria_1" first.'
    );
  }

  const collection = await chroma.getOrCreateCollection({ name: COLLECTION_NAME });

  const count = await collection.count();
  console.log(`Collection "${COLLECTION_NAME}": ${count} chunks indexed\n`);

  if (count === 0) {
    throw new Error(
      'Collection is empty. Run "npm run curriculum:ingest" to populate it.'
    );
  }

  // 3. Embed query
  process.stdout.write(`Embedding query via Ollama (${EMBED_MODEL})...`);
  const queryVec = await embed(query);
  console.log(` ✓ (dim: ${queryVec.length})\n`);

  // 4. Query
  const results = await collection.query({
    queryEmbeddings: [queryVec],
    nResults: TOP_K,
    include: [
      IncludeEnum.Documents,
      IncludeEnum.Metadatas,
      IncludeEnum.Distances,
    ],
  });

  const docs      = results.documents?.[0]      ?? [];
  const metas     = results.metadatas?.[0]      ?? [];
  const distances = results.distances?.[0]      ?? [];

  if (docs.length === 0) {
    console.log('No results found. The query may not match any indexed content.');
    return;
  }

  // 5. Print results
  console.log(`Top ${docs.length} results:\n`);
  console.log('─'.repeat(70));

  for (let i = 0; i < docs.length; i++) {
    const meta = metas[i] as Record<string, string | number> | null ?? {};
    const similarity = distToSimilarity(distances[i] ?? 999);

    console.log(`[${i + 1}] Similarity: ${similarity} | ${meta.book_title ?? '—'}`);
    console.log(
      `    Grade: ${meta.grade_level ?? '—'}  |  ` +
      `Subject: ${meta.subject ?? '—'}  |  ` +
      `Page ~${meta.source_page ?? '?'}  |  ` +
      `Chunk ${meta.chunk_index ?? '?'}`
    );
    console.log(`    "${truncate(docs[i] ?? '', 280)}"`);
    console.log('─'.repeat(70));
  }

  // 6. Verdict
  const topSim = distToSimilarity(distances[0] ?? 999);
  console.log('');
  if (topSim >= 0.5) {
    console.log(`✅  RAG validation PASSED — top similarity ${topSim} (threshold: 0.5)`);
    console.log(`    Curriculum grounding for "${query}" is working correctly.`);
  } else if (topSim >= 0.3) {
    console.log(`⚠   RAG validation PARTIAL — top similarity ${topSim}`);
    console.log('    Results found but confidence is moderate.');
    console.log('    Consider ingesting more grade levels for better coverage.');
  } else {
    console.log(`❌  RAG validation WEAK — top similarity ${topSim}`);
    console.log('    Query may be outside the ingested curriculum scope.');
    console.log('    Try ingesting all grades: npm run curriculum:ingest');
  }
  console.log('');
}

main().catch(err => {
  console.error('\n❌  Error:', err.message || err);
  process.exit(1);
});
