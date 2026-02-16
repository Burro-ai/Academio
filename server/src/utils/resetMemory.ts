/**
 * Memory Reset Utility
 *
 * This script resets the ChromaDB long-term memory system.
 * Use with caution - this will DELETE all stored memories.
 *
 * Usage:
 *   npx tsx src/utils/resetMemory.ts [--all | --student <student_id>]
 *
 * Options:
 *   --all                 Reset ALL student memories (destructive)
 *   --student <id>        Reset memory for a specific student only
 *   --verify              Verify SQLite-ChromaDB synchronization only
 *   --help                Show this help message
 */

import { memoryService } from '../services/memory.service';
import { getDb, initializeDatabase } from '../database/db';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface CommandArgs {
  action: 'all' | 'student' | 'verify' | 'help';
  studentId?: string;
}

function parseArgs(): CommandArgs {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { action: 'help' };
  }

  if (args.includes('--all')) {
    return { action: 'all' };
  }

  if (args.includes('--verify')) {
    return { action: 'verify' };
  }

  const studentIndex = args.indexOf('--student');
  if (studentIndex !== -1 && args[studentIndex + 1]) {
    return { action: 'student', studentId: args[studentIndex + 1] };
  }

  return { action: 'help' };
}

function showHelp(): void {
  console.log(`
Memory Reset Utility
====================

This script manages the ChromaDB long-term memory system.

Usage:
  npx tsx src/utils/resetMemory.ts [options]

Options:
  --all                 Reset ALL student memories (DESTRUCTIVE)
  --student <id>        Reset memory for a specific student only
  --verify              Verify SQLite-ChromaDB synchronization
  --help, -h            Show this help message

Examples:
  # Verify synchronization (safe, read-only)
  npx tsx src/utils/resetMemory.ts --verify

  # Reset a specific student's memory
  npx tsx src/utils/resetMemory.ts --student abc123-uuid-here

  # Reset ALL memories (use with caution!)
  npx tsx src/utils/resetMemory.ts --all

Environment Variables:
  CHROMA_HOST           ChromaDB host (default: localhost)
  CHROMA_PORT           ChromaDB port (default: 8000)
`);
}

async function resetAllMemory(): Promise<void> {
  console.log('\n⚠️  WARNING: This will delete ALL student memories!');
  console.log('    This action cannot be undone.\n');

  // In a production script, you'd want to add a confirmation prompt here
  // For simplicity, we'll proceed directly

  console.log('Resetting all memory collections...');
  const success = await memoryService.resetAllMemory();

  if (success) {
    console.log('✅ All memory collections have been reset.');
  } else {
    console.error('❌ Failed to reset memory collections.');
    process.exit(1);
  }
}

async function resetStudentMemory(studentId: string): Promise<void> {
  console.log(`\nResetting memory for student: ${studentId}`);

  // First, get current stats
  const stats = await memoryService.getStudentMemoryStats(studentId);
  console.log(`  Current memories: ${stats.totalMemories}`);

  if (stats.totalMemories === 0) {
    console.log('  No memories to reset.');
    return;
  }

  const success = await memoryService.resetStudentMemory(studentId);

  if (success) {
    console.log('✅ Student memory has been reset.');
  } else {
    console.error('❌ Failed to reset student memory.');
    process.exit(1);
  }
}

async function verifySync(): Promise<void> {
  console.log('\nVerifying SQLite-ChromaDB synchronization...\n');

  // Get all student IDs from SQLite
  const db = getDb();
  const studentProfiles = db.prepare(`
    SELECT user_id, u.name
    FROM student_profiles sp
    JOIN users u ON sp.user_id = u.id
  `).all() as { user_id: string; name: string }[];

  console.log(`Found ${studentProfiles.length} student profiles in SQLite:`);
  for (const profile of studentProfiles.slice(0, 5)) {
    console.log(`  - ${profile.name} (${profile.user_id})`);
  }
  if (studentProfiles.length > 5) {
    console.log(`  ... and ${studentProfiles.length - 5} more`);
  }

  const studentIds = studentProfiles.map(p => p.user_id);
  const result = await memoryService.verifySynchronization(studentIds);

  console.log('\n--- Synchronization Report ---');
  console.log(`In Sync: ${result.inSync ? '✅ Yes' : '❌ No'}`);

  if (result.orphanedCollections.length > 0) {
    console.log(`\nOrphaned Collections (in ChromaDB but not SQLite):`);
    for (const id of result.orphanedCollections) {
      console.log(`  - ${id}`);
    }
  }

  if (result.missingCollections.length > 0) {
    console.log(`\nMissing Collections (in SQLite but not ChromaDB):`);
    for (const id of result.missingCollections) {
      console.log(`  - ${id}`);
    }
  }

  if (result.inSync) {
    console.log('\n✅ Everything is synchronized.');
  } else {
    console.log('\n⚠️  Run the server to auto-fix synchronization issues.');
  }

  // Show memory stats for a few students
  console.log('\n--- Sample Memory Stats ---');
  for (const profile of studentProfiles.slice(0, 3)) {
    const stats = await memoryService.getStudentMemoryStats(profile.user_id);
    console.log(`${profile.name}: ${stats.totalMemories} memories`);
    if (stats.oldestMemory && stats.newestMemory) {
      console.log(`  Oldest: ${stats.oldestMemory}`);
      console.log(`  Newest: ${stats.newestMemory}`);
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.action === 'help') {
    showHelp();
    return;
  }

  console.log('Initializing services...');

  // Initialize database first (needed for --verify)
  await initializeDatabase();

  // Initialize memory service
  await memoryService.initialize();

  if (!memoryService.isAvailable()) {
    console.error('❌ ChromaDB is not available. Make sure ChromaDB is running.');
    console.error('   Default: http://localhost:8000');
    console.error('   Configure with CHROMA_HOST and CHROMA_PORT environment variables.');
    process.exit(1);
  }

  console.log('✅ Connected to ChromaDB\n');

  switch (args.action) {
    case 'all':
      await resetAllMemory();
      break;
    case 'student':
      if (!args.studentId) {
        console.error('❌ Student ID is required.');
        process.exit(1);
      }
      await resetStudentMemory(args.studentId);
      break;
    case 'verify':
      await verifySync();
      break;
  }

  console.log('\nDone.');
  process.exit(0);
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
