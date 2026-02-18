/**
 * Test Script: JSON Homework Generation
 *
 * Verifies that the homework service generates structured JSON questions
 * instead of relying on regex parsing.
 *
 * Usage:
 *   npx tsx src/utils/test-json-homework.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import { homeworkService } from '../services/homework.service';

async function main(): Promise<void> {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     JSON HOMEWORK GENERATION TEST                              ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  const testCases = [
    { topic: 'Fracciones', subject: 'Matemáticas' },
    { topic: 'El ciclo del agua', subject: 'Ciencias' },
    { topic: 'Verbos en pasado', subject: 'Español' },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of testCases) {
    console.log(`\n  Testing: ${test.topic} (${test.subject})`);
    console.log('  ' + '─'.repeat(50));

    try {
      const result = await homeworkService.generateMasterContent(test.topic, test.subject);

      console.log(`    Content length: ${result.content.length} chars`);
      console.log(`    Questions: ${result.questions.length}`);

      if (result.questions.length === 0) {
        console.log('    ❌ FAILED: No questions generated');
        failed++;
        continue;
      }

      // Display questions
      console.log('    Questions:');
      for (const q of result.questions) {
        const preview = q.text.substring(0, 60) + (q.text.length > 60 ? '...' : '');
        console.log(`      ${q.id}. [${q.type}] ${preview}`);
      }

      // Validate question structure
      const validStructure = result.questions.every(q =>
        typeof q.id === 'number' &&
        typeof q.text === 'string' &&
        q.text.length > 3 &&
        (q.type === 'open' || q.type === 'choice')
      );

      if (validStructure) {
        console.log('    ✅ PASSED: Valid JSON structure');
        passed++;
      } else {
        console.log('    ❌ FAILED: Invalid question structure');
        failed++;
      }
    } catch (error) {
      console.log(`    ❌ ERROR: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  }

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                         SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Passed: ${passed}/${testCases.length}`);
  console.log(`  Failed: ${failed}/${testCases.length}`);
  console.log('');

  if (failed > 0) {
    console.log('❌ Some tests failed - JSON generation needs attention');
    process.exit(1);
  } else {
    console.log('✅ All tests passed - JSON homework generation working!');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Test script error:', error);
  process.exit(1);
});
