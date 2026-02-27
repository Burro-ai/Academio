#!/usr/bin/env tsx
/**
 * fetch-nem-books.ts
 *
 * Downloads and organizes the 2023 NEM (Nueva Escuela Mexicana) textbooks
 * from the CONALITEG open repository using Git sparse checkout.
 *
 * Repo: https://github.com/incognia/CONALITEG (CC0-1.0 — public domain)
 * Approx size: ~6.4 GB (PDFs stored in Git LFS)
 *
 * Usage:
 *   npm run curriculum:fetch             # Full download
 *   npm run curriculum:fetch -- --dry-run  # Preview without downloading
 */

import { execSync, ExecSyncOptions } from 'child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
  rmSync,
  readFileSync,
  writeFileSync,
  statSync,
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ─── Configuration ────────────────────────────────────────────────────────────

const REPO_URL = 'https://github.com/incognia/CONALITEG.git';
const SPARSE_PATHS = ['Primaria/PDF', 'Secundaria/PDF'];

const OUTPUT_BASE = join(__dirname, '../../data/curriculum/nem-2023');
const JOURNAL_PATH = join(__dirname, '../../../JOURNAL.md');

const IS_DRY_RUN = process.argv.includes('--dry-run');

// ─── Subject code → human-readable name ──────────────────────────────────────

const SUBJECT_CODE_MAP: Record<string, string> = {
  // Shared
  LPM: 'libro_para_maestros',
  // Primaria
  MLA: 'multiples_lenguajes',
  PAA: 'proyectos_de_aula',
  PCA: 'proyectos_comunitarios',
  PEA: 'proyectos_escolares',
  SDA: 'saberes_y_pensamiento_cientifico',
  TPA: 'de_lo_humano_y_comunitario',
  // Secundaria
  ETA: 'etica_naturaleza_y_sociedades',
  HUA: 'humanidades',
  LEA: 'lengua_y_literatura',
  NLA: 'nuestros_saberes',
  SAA: 'saberes_cientificos',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string): void {
  const prefix = IS_DRY_RUN ? '[DRY-RUN] ' : '';
  console.log(`${prefix}${msg}`);
}

function run(cmd: string, cwd?: string, timeoutMs = 60_000): string {
  const opts: ExecSyncOptions = {
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
    timeout: timeoutMs,
    ...(cwd ? { cwd } : {}),
  };
  try {
    return (execSync(cmd, opts) as unknown as string).trim();
  } catch (err: any) {
    const stderr: string = err.stderr?.toString() || '';
    const stdout: string = err.stdout?.toString() || '';
    throw new Error(
      `Command failed: ${cmd}\n${stderr || stdout || err.message}`
    );
  }
}

function checkGitAvailable(): void {
  try {
    const version = run('git --version');
    log(`git available: ${version}`);
  } catch {
    throw new Error(
      'git is not installed or not on PATH.\n' +
      'Install Git from https://git-scm.com/ and retry.'
    );
  }
}

function checkGitLfsAvailable(): boolean {
  try {
    run('git lfs version');
    return true;
  } catch {
    return false;
  }
}

/** Returns true if the file starts with a Git-LFS pointer header. */
function isLfsPointer(filePath: string): boolean {
  try {
    const buf = Buffer.alloc(200);
    const fd = require('fs').openSync(filePath, 'r');
    require('fs').readSync(fd, buf, 0, 200, 0);
    require('fs').closeSync(fd);
    return buf.toString('utf8').startsWith(
      'version https://git-lfs.github.com/spec/v1'
    );
  } catch {
    return false;
  }
}

/**
 * Converts a NEM PDF filename to a human-readable name.
 *
 * Primaria:   P[1-6][CODE].pdf  →  {subject}_{level}_{grade}.pdf
 * Secundaria: S[1-3][CODE].pdf  →  {subject}_{level}_{grade}.pdf
 *
 * Returns null if the filename doesn't match the expected pattern.
 */
function buildOutputFilename(
  filename: string,
  level: 'primaria' | 'secundaria',
  gradeNum: string
): string | null {
  const base = filename.replace(/\.pdf$/i, '');

  // Standard NEM pattern: P1LPM or S2HUA etc.
  const match = base.match(/^[PS]\d([A-Z]{3})$/);
  if (match) {
    const code = match[1];
    const subjectName = SUBJECT_CODE_MAP[code];
    if (!subjectName) {
      log(`  ⚠  Unknown subject code: ${code} in "${filename}" — keeping original`);
      return filename;
    }
    return `${subjectName}_${level}_${gradeNum}.pdf`;
  }

  // Fallback: bare 3-letter code (e.g., LPM.pdf)
  const bareMatch = base.match(/^([A-Z]{3})$/);
  if (bareMatch) {
    const code = bareMatch[1];
    const subjectName = SUBJECT_CODE_MAP[code];
    if (!subjectName) return null;
    return `${subjectName}_${level}_${gradeNum}.pdf`;
  }

  return null; // Unrecognized — skip
}

/**
 * Computes the output subfolder name from level + grade directory.
 *
 *   primaria  / 01 → 01_primaria_1
 *   primaria  / 06 → 06_primaria_6
 *   secundaria/ 01 → 07_secundaria_1
 *   secundaria/ 03 → 09_secundaria_3
 */
function getOutputDirName(
  level: 'primaria' | 'secundaria',
  gradeDir: string
): string {
  const gradeNum = parseInt(gradeDir, 10);
  if (isNaN(gradeNum)) return `${gradeDir}_${level}`;
  if (level === 'primaria') {
    return `${String(gradeNum).padStart(2, '0')}_primaria_${gradeNum}`;
  }
  return `${String(gradeNum + 6).padStart(2, '0')}_secundaria_${gradeNum}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   NEM 2023 Textbook Downloader — Academio Curriculum     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  if (IS_DRY_RUN) {
    console.log('  MODE: DRY-RUN — no files will be downloaded or written\n');
  }

  // 1. Pre-flight
  checkGitAvailable();
  const hasLfs = checkGitLfsAvailable();
  log(`git-lfs: ${hasLfs ? 'available ✓' : 'NOT found — LFS pointers will not resolve'}`);

  if (IS_DRY_RUN) {
    log('\nWould execute the following steps:');
    log(`  1. git clone --no-checkout --filter=blob:none --depth=1 \\`);
    log(`       ${REPO_URL} <tmpdir>`);
    log(`  2. git sparse-checkout init --cone`);
    log(`  3. git sparse-checkout set ${SPARSE_PATHS.join(' ')}`);
    log(`  4. git checkout`);
    if (hasLfs) {
      log(`  5. git lfs pull --include="${SPARSE_PATHS.map(p => p + '/**').join(',')}"`);
    }
    log('\nWould organize files into:');
    for (let g = 1; g <= 6; g++) {
      const dir = getOutputDirName('primaria', String(g).padStart(2, '0'));
      log(`  ${OUTPUT_BASE}/${dir}/`);
    }
    for (let g = 1; g <= 3; g++) {
      const dir = getOutputDirName('secundaria', String(g).padStart(2, '0'));
      log(`  ${OUTPUT_BASE}/${dir}/`);
    }
    log('\nDry-run complete. No changes made.');
    return;
  }

  // 2. Prepare output directory
  mkdirSync(OUTPUT_BASE, { recursive: true });
  log(`\nOutput directory: ${OUTPUT_BASE}`);

  // 3. Clone into temp dir
  const tempDir = join(tmpdir(), `nem-conaliteg-${Date.now()}`);
  log(`Temp directory:   ${tempDir}\n`);

  try {
    log('📥  Step 1/4 — Cloning repository (metadata only, no blobs yet)...');
    run(
      `git clone --no-checkout --filter=blob:none --depth=1 ${REPO_URL} "${tempDir}"`,
      undefined,
      180_000 // 3 min for metadata
    );
    log('     Clone complete.\n');

    log('📐  Step 2/4 — Configuring sparse checkout...');
    run('git sparse-checkout init --cone', tempDir);
    run(`git sparse-checkout set ${SPARSE_PATHS.join(' ')}`, tempDir);
    log('     Sparse paths set.\n');

    log('⬇   Step 3/4 — Checking out blobs (this downloads ~6 GB — be patient)...');
    log('     Progress: watching git fetch in background...');
    run('git checkout', tempDir, 3_600_000); // 60 min
    log('     Checkout complete.\n');

    // 4. LFS detection + pull
    if (hasLfs) {
      let samplePointer: string | null = null;

      outer:
      for (const sparse of SPARSE_PATHS) {
        const baseDir = join(tempDir, sparse);
        if (!existsSync(baseDir)) continue;
        for (const gDir of readdirSync(baseDir)) {
          const gradeDir = join(baseDir, gDir);
          if (!statSync(gradeDir).isDirectory()) continue;
          for (const f of readdirSync(gradeDir)) {
            if (f.toLowerCase().endsWith('.pdf')) {
              samplePointer = join(gradeDir, f);
              break outer;
            }
          }
        }
      }

      if (samplePointer && isLfsPointer(samplePointer)) {
        log('🔗  Step 4/4 — LFS pointers detected. Pulling actual PDF content (~6 GB)...');
        const includeGlob = SPARSE_PATHS.map(p => `${p}/**`).join(',');
        run(
          `git lfs pull --include="${includeGlob}"`,
          tempDir,
          3_600_000 // 60 min
        );
        log('     LFS pull complete.\n');
      } else if (samplePointer) {
        log('✅  Step 4/4 — Files appear to be direct blobs (no LFS). Skipping pull.\n');
      } else {
        log('⚠   Step 4/4 — No PDF files found in checkout. The repo structure may have changed.\n');
      }
    }

    // 5. Organize files
    log('📂  Organizing files by grade...');
    let totalCopied = 0;
    const countsByGrade: Record<string, number> = {};

    for (const sparse of SPARSE_PATHS) {
      const level: 'primaria' | 'secundaria' = sparse.startsWith('Primaria')
        ? 'primaria'
        : 'secundaria';
      const sourceBase = join(tempDir, sparse);

      if (!existsSync(sourceBase)) {
        log(`  ⚠  Source not found: ${sourceBase} — skipping`);
        continue;
      }

      for (const gradeDir of readdirSync(sourceBase).sort()) {
        const sourceGradeDir = join(sourceBase, gradeDir);
        if (!statSync(sourceGradeDir).isDirectory()) continue;

        const outputDirName = getOutputDirName(level, gradeDir);
        const outputGradeDir = join(OUTPUT_BASE, outputDirName);
        mkdirSync(outputGradeDir, { recursive: true });

        const pdfFiles = readdirSync(sourceGradeDir).filter(f =>
          f.toLowerCase().endsWith('.pdf')
        );

        countsByGrade[outputDirName] = 0;

        for (const pdfFile of pdfFiles) {
          const srcPath = join(sourceGradeDir, pdfFile);

          if (isLfsPointer(srcPath)) {
            log(`  ⚠  LFS pointer not resolved — skipping: ${pdfFile}`);
            continue;
          }

          const outputFilename =
            buildOutputFilename(pdfFile, level, String(parseInt(gradeDir, 10))) ??
            pdfFile;

          const dstPath = join(outputGradeDir, outputFilename);
          copyFileSync(srcPath, dstPath);
          log(`  ✔  ${pdfFile}  →  ${outputDirName}/${outputFilename}`);
          countsByGrade[outputDirName]++;
          totalCopied++;
        }
      }
    }

    // 6. Cleanup
    log('\n🧹  Cleaning up temp directory...');
    rmSync(tempDir, { recursive: true, force: true });
    log('     Temp directory removed.');

    // 7. Summary
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    const elapsedMin = Math.floor(elapsedSec / 60);
    const elapsedDisplay = elapsedMin > 0
      ? `${elapsedMin}m ${elapsedSec % 60}s`
      : `${elapsedSec}s`;

    console.log('');
    console.log(`✅  DONE — ${totalCopied} PDFs organized in ${elapsedDisplay}`);
    console.log(`📁  Output: ${OUTPUT_BASE}`);
    for (const [dir, count] of Object.entries(countsByGrade)) {
      console.log(`    ${dir}: ${count} file${count !== 1 ? 's' : ''}`);
    }

    if (totalCopied === 0) {
      console.error(
        '\n❌  No PDFs were copied.\n' +
        '    This likely means git-lfs is not installed and the checkout\n' +
        '    only downloaded LFS pointers.\n' +
        '    Install git-lfs (https://git-lfs.com/) and retry.'
      );
      process.exit(1);
    }

    // 8. Update JOURNAL.md
    const dateStr = new Date().toISOString().split('T')[0];
    const gradeLines = Object.entries(countsByGrade)
      .map(([dir, count]) => `  - ${dir}: ${count} PDFs`)
      .join('\n');

    const journalEntry =
      `\n## ${dateStr} — NEM 2023 Curriculum Acquisition\n` +
      `- Downloaded ${totalCopied} NEM 2023 textbooks via git sparse checkout\n` +
      `- Source: https://github.com/incognia/CONALITEG (CC0-1.0 public domain)\n` +
      `- Output: \`server/data/curriculum/nem-2023/\`\n` +
      `- Files organized by grade, renamed to human-readable subject names\n` +
      `${gradeLines}\n` +
      `- Elapsed: ${elapsedDisplay}\n`;

    try {
      const existing = readFileSync(JOURNAL_PATH, 'utf8');
      const insertAt = existing.indexOf('\n---\n') + 1;
      const updated =
        existing.slice(0, insertAt) + journalEntry + existing.slice(insertAt);
      writeFileSync(JOURNAL_PATH, updated, 'utf8');
      log('\n📝  JOURNAL.md updated.');
    } catch (err) {
      log(`\n⚠   Could not update JOURNAL.md: ${err}`);
    }

  } catch (err) {
    // Ensure temp dir is cleaned up on failure
    if (existsSync(tempDir)) {
      log('\n🧹  Cleaning up temp directory after error...');
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        log(`  ⚠  Could not remove ${tempDir} — remove it manually.`);
      }
    }
    throw err;
  }
}

main().catch(err => {
  console.error('\n❌  Fatal error:', err.message || err);
  process.exit(1);
});
