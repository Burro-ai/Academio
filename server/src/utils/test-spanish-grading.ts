/**
 * Spanish Grading Test Script
 *
 * Tests that homework grading AI responses are in Spanish (es-MX)
 * for students of different ages and grade levels.
 *
 * Usage:
 *   npm run test:grading
 *   npx tsx src/utils/test-spanish-grading.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import { ollamaService } from '../services/ollama.service';
import { getPedagogicalPersona } from '../services/aiGatekeeper.service';

// ============ Types ============

interface TestStudent {
  name: string;
  age: number;
  gradeLevel: string;
  userId?: string;
}

interface TestResult {
  student: string;
  passed: boolean;
  grade: number;
  feedback: string;
  analysis: {
    hasEnglish: boolean;
    englishWords: string[];
    hasSpanish: boolean;
    isValidJson: boolean;
  };
}

// ============ Test Configuration ============

const TEST_STUDENTS: TestStudent[] = [
  { name: 'Test Student 1 (Primaria)', age: 8, gradeLevel: 'primaria3' },
  { name: 'Test Student 2 (Secundaria)', age: 14, gradeLevel: 'secundaria2' },
  { name: 'Test Student 3 (Preparatoria)', age: 17, gradeLevel: 'preparatoria2' },
];

const TEST_HOMEWORK_CONTENT = `
# Tarea de Matemáticas: Fracciones

## Instrucciones
Resuelve los siguientes problemas de fracciones.

## Problemas

1. ¿Cuánto es $\\frac{1}{2} + \\frac{1}{4}$?

2. Si tienes una pizza dividida en 8 partes y te comes 3, ¿qué fracción queda?

3. Simplifica la fracción $\\frac{6}{8}$.
`;

const TEST_ANSWERS: { questionId: string; value: string }[] = [
  { questionId: 'q1', value: '3/4' },
  { questionId: 'q2', value: '5/8' },
  { questionId: 'q3', value: '3/4' },
];

// Common English words that indicate the response is not in Spanish
const ENGLISH_INDICATORS = [
  'great', 'good', 'excellent', 'well done', 'nice', 'perfect',
  'correct', 'incorrect', 'wrong', 'right', 'answer',
  'student', 'homework', 'grade', 'feedback', 'work',
  'keep up', 'try again', 'next time', 'better', 'improvement',
  'understanding', 'concept', 'problem', 'solution', 'review',
  'the', 'this', 'that', 'your', 'you', 'and', 'but', 'or',
  'however', 'although', 'because', 'since', 'while',
];

// Spanish indicators to verify Spanish content
const SPANISH_INDICATORS = [
  'excelente', 'bien', 'correcto', 'incorrecto', 'respuesta',
  'estudiante', 'tarea', 'calificación', 'retroalimentación',
  'trabajo', 'sigue', 'intenta', 'próxima', 'mejor', 'mejora',
  'comprensión', 'concepto', 'problema', 'solución', 'revisa',
  'el', 'la', 'los', 'las', 'tu', 'tus', 'y', 'pero', 'o',
  'sin embargo', 'aunque', 'porque', 'ya que', 'mientras',
  'muy', 'buen', 'buena', 'felicidades', 'perfecto',
];

// ============ Helpers ============

function detectEnglishWords(text: string): string[] {
  const lowerText = text.toLowerCase();
  return ENGLISH_INDICATORS.filter(word =>
    new RegExp(`\\b${word}\\b`, 'i').test(lowerText)
  );
}

function hasSpanishContent(text: string): boolean {
  const lowerText = text.toLowerCase();
  return SPANISH_INDICATORS.some(word =>
    new RegExp(`\\b${word}\\b`, 'i').test(lowerText)
  );
}


// ============ Test Runner ============

async function runGradingTest(student: TestStudent): Promise<TestResult> {
  console.log(`\n  Testing: ${student.name}`);
  console.log(`    Age: ${student.age}, Grade: ${student.gradeLevel}`);

  try {
    // Get the appropriate persona for this student
    const persona = getPedagogicalPersona(student.age, student.gradeLevel);
    console.log(`    Persona: ${persona.name}`);

    // Build the grading prompt
    const answersFormatted = TEST_ANSWERS
      .map((a, i) => `Pregunta ${i + 1} (ID: ${a.questionId}):\nRespuesta del Estudiante: ${a.value}`)
      .join('\n\n');

    const systemPrompt = `# INSTRUCCIÓN PRIMARIA - IDIOMA OBLIGATORIO

DEBES RESPONDER EXCLUSIVAMENTE EN ESPAÑOL MEXICANO.
ESTÁ PROHIBIDO USAR INGLÉS EN CUALQUIER PARTE DE TU RESPUESTA.
NO "Great job", NO "Good work", NO "Excellent" - SOLO ESPAÑOL.

Eres una IA de evaluación educativa mexicana. Calificas tareas de estudiantes mexicanos.

## Tu Rol
- Proporcionar calificaciones justas y constructivas
- Dar retroalimentación alentadora EN ESPAÑOL MEXICANO
- Adaptar tu tono al nivel del estudiante: ${persona.gradeRange} (${persona.ageRange})

## Formato de Respuesta
Responde ÚNICAMENTE con JSON válido:
{
  "grade": <número 0-100>,
  "feedback": "<retroalimentación en ESPAÑOL MEXICANO>"
}

RECUERDA: El campo "feedback" DEBE estar 100% en español mexicano. Cero palabras en inglés.`;

    const prompt = `# IDIOMA: ESPAÑOL MEXICANO OBLIGATORIO
TODA tu respuesta DEBE estar en ESPAÑOL MEXICANO.
PROHIBIDO usar inglés. Ni una sola palabra en inglés.

Eres un evaluador educativo mexicano experto. Evalúa la entrega de tarea y proporciona retroalimentación constructiva.

## PERFIL DEL ESTUDIANTE
- Nivel académico: ${persona.gradeRange} (${persona.ageRange})
- Adapta tu retroalimentación al nivel y tono apropiado para su edad.

${persona.systemPromptSegment}

## Contenido de la Tarea
${TEST_HOMEWORK_CONTENT}

## Respuestas Entregadas por el Estudiante
${answersFormatted}

## Instrucciones de Evaluación
1. Evalúa cada respuesta por corrección, completitud y comprensión
2. Considera crédito parcial para respuestas parcialmente correctas
3. Proporciona una calificación numérica de 0 a 100
4. Escribe retroalimentación constructiva EN ESPAÑOL que:
   - Reconozca lo que el estudiante hizo bien
   - Explique cualquier error de manera alentadora
   - Sugiera cómo pueden mejorar

## Formato de Respuesta Obligatorio
{
  "grade": <número 0-100>,
  "feedback": "<retroalimentación EN ESPAÑOL MEXICANO>"
}

## Ejemplos de Retroalimentación Correcta (EN ESPAÑOL):
- "¡Excelente trabajo! Demostraste buena comprensión del tema."
- "Muy bien. Tu respuesta es correcta. Para la próxima, intenta incluir más detalles."
- "Buen intento. Revisa el concepto de fracciones y vuelve a intentarlo."
- "Tu razonamiento va por buen camino. Solo necesitas ajustar el último paso."

RECUERDA: SOLO ESPAÑOL MEXICANO. CERO INGLÉS.`;

    // Call AI directly
    const response = await ollamaService.generate(prompt, undefined, systemPrompt);

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      throw new Error('Invalid AI response format - no JSON found');
    }

    const result = JSON.parse(jsonMatch[0]) as { grade: number; feedback: string };
    const grade = Math.max(0, Math.min(100, result.grade));
    const feedback = result.feedback || 'Sin retroalimentación proporcionada.';

    // Analyze the feedback
    const englishWords = detectEnglishWords(feedback);
    const hasEnglish = englishWords.length > 0;
    const hasSpanish = hasSpanishContent(feedback);

    // Log results
    console.log(`    Grade: ${grade}`);
    console.log(`    Feedback Preview: ${feedback.substring(0, 100)}...`);
    console.log(`    English Words Found: ${englishWords.length > 0 ? englishWords.join(', ') : 'None'}`);
    console.log(`    Has Spanish: ${hasSpanish ? 'Yes' : 'No'}`);

    const passed = !hasEnglish && hasSpanish;
    console.log(`    Result: ${passed ? '✓ PASSED' : '✗ FAILED'}`);

    return {
      student: student.name,
      passed,
      grade,
      feedback,
      analysis: {
        hasEnglish,
        englishWords,
        hasSpanish,
        isValidJson: true,
      },
    };
  } catch (error) {
    console.log(`    Error: ${error instanceof Error ? error.message : String(error)}`);

    return {
      student: student.name,
      passed: false,
      grade: 0,
      feedback: '',
      analysis: {
        hasEnglish: false,
        englishWords: [],
        hasSpanish: false,
        isValidJson: false,
      },
    };
  }
}

// ============ Main ============

async function main(): Promise<void> {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     SPANISH GRADING TEST - Homework AI Feedback Verification  ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  const results: TestResult[] = [];

  console.log('Running grading tests for 3 different student profiles...');

  for (const student of TEST_STUDENTS) {
    const result = await runGradingTest(student);
    results.push(result);
  }

  // Summary
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                         SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    console.log(`\n${icon} ${result.student}`);
    console.log(`   Grade: ${result.grade}`);
    if (result.analysis.englishWords.length > 0) {
      console.log(`   ⚠️  English words found: ${result.analysis.englishWords.join(', ')}`);
    }
    console.log(`   Feedback:`);
    console.log(`   "${result.feedback}"`);
  }

  console.log('\n');
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│                         FINAL RESULT                           │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log(`│  Tests Passed: ${passed}/3                                               │`);
  console.log(`│  Tests Failed: ${failed}                                                 │`);
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');

  if (failed > 0) {
    console.log('❌ Some tests failed - AI is still returning English content');
    process.exit(1);
  } else {
    console.log('✅ All tests passed - AI grading feedback is in Spanish!');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Test script error:', error);
  process.exit(1);
});
