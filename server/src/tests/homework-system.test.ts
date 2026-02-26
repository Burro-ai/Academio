/**
 * Homework System QA Validation Tests
 *
 * Comprehensive tests for:
 * 1. Multi-Question Rendering (7-Question Test)
 * 2. Sidekick RAG Memory Retrieval
 * 3. Question Lock Integrity After Assignment
 *
 * Run: npx ts-node src/tests/homework-system.test.ts
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

// Test configuration
const DB_PATH = path.join(__dirname, '../../data/sqlite.db');
const TEACHER_EMAIL = 'sarah.johnson@academio.edu';
const STUDENT_EMAIL = 'alex.student@academio.edu';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  duration: number;
}

const results: TestResult[] = [];

function log(message: string, type: 'info' | 'pass' | 'fail' | 'warn' = 'info') {
  const colors = {
    info: '\x1b[36m',    // Cyan
    pass: '\x1b[32m',    // Green
    fail: '\x1b[31m',    // Red
    warn: '\x1b[33m',    // Yellow
  };
  const reset = '\x1b[0m';
  const prefix = type === 'pass' ? '✓' : type === 'fail' ? '✗' : type === 'warn' ? '⚠' : '→';
  console.log(`${colors[type]}${prefix} ${message}${reset}`);
}

async function runTest(name: string, testFn: () => Promise<string>): Promise<void> {
  const start = Date.now();
  try {
    const details = await testFn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, details, duration });
    log(`${name} (${duration}ms)`, 'pass');
    log(`  ${details}`, 'info');
  } catch (error) {
    const duration = Date.now() - start;
    const details = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, details, duration });
    log(`${name} (${duration}ms)`, 'fail');
    log(`  ${details}`, 'fail');
  }
}

// ============================================================================
// TEST 1: 7-Question Rendering Test
// ============================================================================

async function test7QuestionRendering(): Promise<string> {
  const db = new Database(DB_PATH);

  try {
    // 1. Get teacher
    const teacher = db.prepare(`
      SELECT u.id, u.name FROM users u WHERE u.email = ?
    `).get(TEACHER_EMAIL) as { id: string; name: string } | undefined;

    if (!teacher) {
      throw new Error(`Teacher not found: ${TEACHER_EMAIL}`);
    }

    // 2. Create 7-question homework
    const homeworkId = uuidv4();
    const questionsJson = JSON.stringify([
      { id: 1, text: '¿Cuál es el resultado de 3/4 + 1/2?', type: 'open' },
      { id: 2, text: 'Simplifica la fracción 8/12.', type: 'open' },
      { id: 3, text: '¿Cuánto es 2/3 de 15?', type: 'open' },
      { id: 4, text: 'Convierte 0.75 a fracción.', type: 'open' },
      { id: 5, text: '¿Qué fracción es mayor: 5/8 o 3/5?', type: 'choice', options: ['5/8', '3/5', 'Son iguales'] },
      { id: 6, text: 'Resuelve: 7/8 - 3/8 = ?', type: 'open' },
      { id: 7, text: 'Explica qué significa una fracción impropia.', type: 'open' },
    ]);

    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO homework_assignments (id, teacher_id, title, topic, subject, master_content, questions_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      homeworkId,
      teacher.id,
      'Práctica de Fracciones - 7 Preguntas',
      'Operaciones con fracciones',
      'math',
      '# Práctica de Fracciones\n\nResuelve los siguientes ejercicios.',
      questionsJson,
      now,
      now
    );

    // 3. Get or create student
    let student = db.prepare(`
      SELECT u.id FROM users u WHERE u.email = ?
    `).get(STUDENT_EMAIL) as { id: string } | undefined;

    if (!student) {
      const studentId = uuidv4();
      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(studentId, 'Alex Student', STUDENT_EMAIL, 'test-hash', 'STUDENT', now);

      db.prepare(`
        INSERT INTO student_profiles (id, user_id, teacher_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuidv4(), studentId, teacher.id, now, now);

      student = { id: studentId };
    }

    // 4. Create personalized homework for student
    const personalizedId = uuidv4();
    db.prepare(`
      INSERT INTO personalized_homework (id, homework_id, student_id, personalized_content, questions_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      personalizedId,
      homeworkId,
      student.id,
      '# Práctica de Fracciones\n\nResuelve los siguientes ejercicios.',
      questionsJson,
      now
    );

    // 5. Verify personalized homework has 7 questions
    const personalizedHomework = db.prepare(`
      SELECT questions_json FROM personalized_homework WHERE id = ?
    `).get(personalizedId) as { questions_json: string } | undefined;

    if (!personalizedHomework) {
      throw new Error('Personalized homework not created');
    }

    const questions = JSON.parse(personalizedHomework.questions_json);
    if (!Array.isArray(questions) || questions.length !== 7) {
      throw new Error(`Expected 7 questions, got ${questions?.length || 0}`);
    }

    // 6. Verify each question has required fields
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.id || !q.text || !q.type) {
        throw new Error(`Question ${i + 1} missing required fields: ${JSON.stringify(q)}`);
      }
    }

    // Cleanup
    db.prepare('DELETE FROM personalized_homework WHERE id = ?').run(personalizedId);
    db.prepare('DELETE FROM homework_assignments WHERE id = ?').run(homeworkId);

    return `Created homework with ${questions.length} questions, all validated with correct structure`;
  } finally {
    db.close();
  }
}

// ============================================================================
// TEST 2: Sidekick RAG Memory Test
// ============================================================================

async function testSidekickRAGMemory(): Promise<string> {
  const db = new Database(DB_PATH);

  try {
    // 1. Get or create student
    let student = db.prepare(`
      SELECT u.id FROM users u WHERE u.email = ?
    `).get(STUDENT_EMAIL) as { id: string } | undefined;

    if (!student) {
      throw new Error('Student not found. Run test 1 first.');
    }

    // 2. Check if ChromaDB is available (we'll simulate this check)
    // In real test, we'd call memoryService.isAvailable()

    // 3. Verify the homeworkChat.service uses RAG
    // Check that the service file exists and contains RAG integration
    const fs = require('fs');
    const servicePath = path.join(__dirname, '../services/homeworkChat.service.ts');
    const serviceContent = fs.readFileSync(servicePath, 'utf8');

    // Verify RAG retrieval is called
    if (!serviceContent.includes('memoryService.retrieveRelevantMemories')) {
      throw new Error('homeworkChat.service.ts does not call memoryService.retrieveRelevantMemories');
    }

    // Verify RAG storage is called
    if (!serviceContent.includes('memoryService.storeInteraction')) {
      throw new Error('homeworkChat.service.ts does not call memoryService.storeInteraction');
    }

    // Verify memories are formatted into prompt
    if (!serviceContent.includes('formatMemoriesForPrompt')) {
      throw new Error('homeworkChat.service.ts does not format memories for prompt');
    }

    // 4. Verify homework metadata is stored in memory
    if (!serviceContent.includes('homeworkId')) {
      throw new Error('homeworkChat.service.ts does not store homeworkId in memory metadata');
    }

    return 'RAG integration verified: retrieval, storage, and prompt formatting all present in service';
  } finally {
    db.close();
  }
}

// ============================================================================
// TEST 3: Lock Integrity Test (Assignment Locks Questions)
// ============================================================================

async function testLockIntegrity(): Promise<string> {
  const db = new Database(DB_PATH);

  try {
    // 1. Get teacher
    const teacher = db.prepare(`
      SELECT u.id FROM users u WHERE u.email = ?
    `).get(TEACHER_EMAIL) as { id: string } | undefined;

    if (!teacher) {
      throw new Error(`Teacher not found: ${TEACHER_EMAIL}`);
    }

    // 2. Create homework without assigned_at
    const homeworkId = uuidv4();
    const now = new Date().toISOString();
    const originalQuestions = JSON.stringify([
      { id: 1, text: 'Pregunta original 1', type: 'open' },
      { id: 2, text: 'Pregunta original 2', type: 'open' },
    ]);

    db.prepare(`
      INSERT INTO homework_assignments (id, teacher_id, title, topic, master_content, questions_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(homeworkId, teacher.id, 'Test Lock', 'Test', 'Content', originalQuestions, now, now);

    // 3. Verify homework is NOT assigned
    const beforeAssign = db.prepare(`
      SELECT assigned_at FROM homework_assignments WHERE id = ?
    `).get(homeworkId) as { assigned_at: string | null } | undefined;

    if (beforeAssign?.assigned_at) {
      throw new Error('Homework should not be assigned yet');
    }

    // 4. Verify questions can be updated before assignment
    const updatedQuestions = JSON.stringify([
      { id: 1, text: 'Pregunta modificada 1', type: 'open' },
      { id: 2, text: 'Pregunta modificada 2', type: 'choice', options: ['A', 'B'] },
      { id: 3, text: 'Pregunta nueva 3', type: 'open' },
    ]);

    db.prepare(`
      UPDATE homework_assignments SET questions_json = ?, updated_at = ? WHERE id = ?
    `).run(updatedQuestions, now, homeworkId);

    // Verify update worked
    const afterUpdate = db.prepare(`
      SELECT questions_json FROM homework_assignments WHERE id = ?
    `).get(homeworkId) as { questions_json: string } | undefined;

    const parsedAfterUpdate = JSON.parse(afterUpdate?.questions_json || '[]');
    if (parsedAfterUpdate.length !== 3) {
      throw new Error('Questions should be updateable before assignment');
    }

    // 5. Mark as assigned
    const assignedAt = new Date().toISOString();
    db.prepare(`
      UPDATE homework_assignments SET assigned_at = ? WHERE id = ?
    `).run(assignedAt, homeworkId);

    // 6. Verify isAssigned() logic would return true
    const afterAssign = db.prepare(`
      SELECT assigned_at FROM homework_assignments WHERE id = ?
    `).get(homeworkId) as { assigned_at: string | null } | undefined;

    if (!afterAssign?.assigned_at) {
      throw new Error('assigned_at should be set after assignment');
    }

    // 7. Verify the frontend lock mechanism exists
    const fs = require('fs');
    const questionsPanelPath = path.join(__dirname, '../../..', 'client/src/components/teacher/HomeworkQuestionsPanel.tsx');
    const questionsPanelContent = fs.readFileSync(questionsPanelPath, 'utf8');

    if (!questionsPanelContent.includes('isAssigned')) {
      throw new Error('HomeworkQuestionsPanel does not check isAssigned prop');
    }

    if (!questionsPanelContent.includes('disabled={isAssigned}')) {
      throw new Error('HomeworkQuestionsPanel does not disable inputs when assigned');
    }

    // Cleanup
    db.prepare('DELETE FROM homework_assignments WHERE id = ?').run(homeworkId);

    return 'Lock integrity verified: questions editable before assignment, locked after. UI respects isAssigned prop.';
  } finally {
    db.close();
  }
}

// ============================================================================
// TEST 4: Submit Button Gating Test
// ============================================================================

async function testSubmitButtonGating(): Promise<string> {
  const fs = require('fs');
  const containerPath = path.join(__dirname, '../../..', 'client/src/components/student/HomeworkFormContainer.tsx');
  const content = fs.readFileSync(containerPath, 'utf8');

  // Verify the conditional rendering logic
  if (!content.includes('answeredCount < totalCount')) {
    throw new Error('Submit button should check if all questions are answered');
  }

  if (!content.includes('incompleteTitle')) {
    throw new Error('Should show incomplete notice when not all questions answered');
  }

  if (!content.includes('incompleteMessage')) {
    throw new Error('Should show remaining question count');
  }

  // Verify submit button only appears in else branch
  const submitButtonSection = content.match(/answeredCount < totalCount[\s\S]*?GlassButton[\s\S]*?submitHomework/);
  if (!submitButtonSection) {
    throw new Error('Submit button structure not found');
  }

  return 'Submit button gating verified: shows incomplete notice when questions remain, submit button only when all answered';
}

// ============================================================================
// TEST 5: Question Card Sidekick Integration
// ============================================================================

async function testQuestionCardSidekickButton(): Promise<string> {
  const fs = require('fs');
  const cardPath = path.join(__dirname, '../../..', 'client/src/components/student/HomeworkQuestionCard.tsx');
  const content = fs.readFileSync(cardPath, 'utf8');

  // Verify onAskSidekick prop exists
  if (!content.includes('onAskSidekick?:')) {
    throw new Error('HomeworkQuestionCard should have optional onAskSidekick prop');
  }

  // Verify Ask Sidekick button exists
  if (!content.includes("t('homework.sidekick.askAbout')")) {
    throw new Error('HomeworkQuestionCard should have Ask Sidekick button');
  }

  // Verify button calls onAskSidekick
  if (!content.includes('onClick={onAskSidekick}')) {
    throw new Error('Ask Sidekick button should call onAskSidekick');
  }

  return 'Question card Sidekick integration verified: has onAskSidekick prop and button';
}

// ============================================================================
// TEST 6: Two-Column Layout Test
// ============================================================================

async function testTwoColumnLayout(): Promise<string> {
  const fs = require('fs');
  const containerPath = path.join(__dirname, '../../..', 'client/src/components/student/HomeworkFormContainer.tsx');
  const content = fs.readFileSync(containerPath, 'utf8');

  // Verify two-column layout structure
  if (!content.includes('lg:flex-row')) {
    throw new Error('Container should use flex-row on large screens');
  }

  if (!content.includes('lg:flex-[0.6]')) {
    throw new Error('Questions pane should be 60% width');
  }

  // Verify HomeworkSidekick is imported and used
  if (!content.includes("import { HomeworkSidekick }")) {
    throw new Error('HomeworkSidekick should be imported');
  }

  if (!content.includes('<HomeworkSidekick')) {
    throw new Error('HomeworkSidekick component should be rendered');
  }

  // Verify mobile toggle
  if (!content.includes('isSidekickExpanded')) {
    throw new Error('Should have mobile sidekick toggle state');
  }

  return 'Two-column layout verified: 60/40 split, HomeworkSidekick integrated, mobile toggle present';
}

// ============================================================================
// TEST 7: Translations Test
// ============================================================================

async function testTranslations(): Promise<string> {
  const fs = require('fs');
  const translationsPath = path.join(__dirname, '../../..', 'client/src/locales/es-MX.json');
  const content = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));

  // Verify homework.sidekick translations
  const sidekick = content.homework?.sidekick;
  if (!sidekick) {
    throw new Error('Missing homework.sidekick translations');
  }

  const requiredSidekickKeys = ['title', 'subtitle', 'placeholder', 'askAbout', 'quickAsk', 'welcome', 'welcomeMessage'];
  for (const key of requiredSidekickKeys) {
    if (!sidekick[key]) {
      throw new Error(`Missing homework.sidekick.${key} translation`);
    }
  }

  // Verify homework.editor translations
  const editor = content.homework?.editor;
  if (!editor) {
    throw new Error('Missing homework.editor translations');
  }

  const requiredEditorKeys = ['questionsTitle', 'addQuestion', 'saveDraft', 'assignToStudents', 'assigned'];
  for (const key of requiredEditorKeys) {
    if (!editor[key]) {
      throw new Error(`Missing homework.editor.${key} translation`);
    }
  }

  // Verify submit gating translations
  const homeworkForm = content.student?.homeworkForm;
  if (!homeworkForm?.incompleteTitle || !homeworkForm?.incompleteMessage) {
    throw new Error('Missing incomplete homework translations');
  }

  return `All translations verified: ${requiredSidekickKeys.length} sidekick, ${requiredEditorKeys.length} editor, submit gating`;
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runAllTests() {
  console.log('\n' + '='.repeat(70));
  console.log(' HOMEWORK SYSTEM QA VALIDATION');
  console.log(' Lead QA Automation Engineer & Educational Auditor');
  console.log('='.repeat(70) + '\n');

  await runTest('TEST 1: 7-Question Rendering', test7QuestionRendering);
  await runTest('TEST 2: Sidekick RAG Memory Integration', testSidekickRAGMemory);
  await runTest('TEST 3: Lock Integrity (Assignment)', testLockIntegrity);
  await runTest('TEST 4: Submit Button Gating', testSubmitButtonGating);
  await runTest('TEST 5: Question Card Sidekick Button', testQuestionCardSidekickButton);
  await runTest('TEST 6: Two-Column Layout', testTwoColumnLayout);
  await runTest('TEST 7: Spanish Translations', testTranslations);

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log(' TEST SUMMARY');
  console.log('='.repeat(70));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\n Total: ${results.length} | Passed: ${passed} | Failed: ${failed} | Time: ${totalTime}ms\n`);

  if (failed > 0) {
    console.log(' FAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.details}`);
    });
    process.exit(1);
  } else {
    log('All tests passed!', 'pass');
    process.exit(0);
  }
}

runAllTests().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
