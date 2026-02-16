/**
 * Create Test Students (No ChromaDB Required)
 *
 * Creates 3 test students with complete profiles and chat history.
 * Works without ChromaDB - just SQLite.
 *
 * Usage:
 *   npx tsx src/utils/create-test-students.ts
 */

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { initializeDatabase, getDb, closeDatabase } from '../database/db';

// Load environment variables
dotenv.config();

// Fixed IDs for consistent testing
const STUDENT_A_ID = 'rag-test-student-a-00000001';
const STUDENT_B_ID = 'rag-test-student-b-00000002';
const STUDENT_C_ID = 'rag-test-student-c-00000003';
const TEST_TEACHER_ID = 'rag-test-teacher-00000000';

interface TestStudent {
  id: string;
  name: string;
  email: string;
  age: number;
  gradeLevel: string;
  topic: string;
  subject: string;
  favoriteSports: string[];
  skillsToImprove: string[];
  qaInjections: { question: string; answer: string }[];
}

const TEST_STUDENTS: TestStudent[] = [
  {
    id: STUDENT_A_ID,
    name: 'Sofia Martinez (RAG Test)',
    email: 'sofia.rag@test.academio.edu',
    age: 8,
    gradeLevel: 'primaria2',
    topic: 'Fracciones',
    subject: 'math',
    favoriteSports: ['futbol', 'natacion'],
    skillsToImprove: ['matematicas', 'lectura'],
    qaInjections: [
      {
        question: '¿Qué es una fracción?',
        answer: 'Una fracción es como dividir algo en partes iguales. Imagina que tienes una pizza y la cortas en pedazos iguales. Si cortas la pizza en 2 pedazos iguales, cada pedazo es "la mitad" o $\\frac{1}{2}$ de la pizza.',
      },
      {
        question: '¿Cómo se escribe "la mitad"?',
        answer: 'La mitad se escribe como $\\frac{1}{2}$. El número de abajo (2) nos dice en cuántas partes cortamos la pizza, y el de arriba (1) nos dice cuántas partes tomamos. Si tu pizza tiene 2 pedazos y tomas 1, tienes la mitad.',
      },
      {
        question: '¿Qué significa un cuarto?',
        answer: 'Un cuarto es cuando divides algo en 4 partes iguales y tomas una. Se escribe $\\frac{1}{4}$. Piensa en tu pizza cortada en 4 pedazos iguales - cada pedazo es un cuarto de la pizza.',
      },
      {
        question: '¿Cuál es más grande, la mitad o un cuarto?',
        answer: 'La mitad ($\\frac{1}{2}$) es más grande que un cuarto ($\\frac{1}{4}$). Imagina dos pizzas iguales: si una la cortas en 2 y otra en 4, los pedazos de la primera pizza serán más grandes.',
      },
      {
        question: '¿Cómo sumo dos cuartos?',
        answer: 'Si tienes $\\frac{1}{4}$ y le sumas otro $\\frac{1}{4}$, tienes $\\frac{2}{4}$. Eso es lo mismo que la mitad. Es como tomar 2 pedazos de una pizza cortada en 4 - tienes la mitad de la pizza.',
      },
    ],
  },
  {
    id: STUDENT_B_ID,
    name: 'Carlos Ramirez (RAG Test)',
    email: 'carlos.rag@test.academio.edu',
    age: 17,
    gradeLevel: 'preparatoria2',
    topic: 'Segunda Ley de Newton',
    subject: 'physics',
    favoriteSports: ['formula1', 'karting', 'videojuegos'],
    skillsToImprove: ['fisica', 'calculo'],
    qaInjections: [
      {
        question: '¿Qué establece la Segunda Ley de Newton?',
        answer: 'La Segunda Ley de Newton establece que $F = ma$, donde la fuerza neta sobre un objeto es igual a su masa multiplicada por su aceleración. En Fórmula 1, esto explica por qué los autos más ligeros aceleran más rápido con el mismo motor.',
      },
      {
        question: '¿Por qué la masa afecta la aceleración?',
        answer: 'De $F = ma$, despejamos $a = \\frac{F}{m}$. A mayor masa, menor aceleración para la misma fuerza. En Fórmula 1, cada kilogramo extra en el auto reduce la aceleración. Por eso los equipos optimizan cada gramo del vehículo.',
      },
      {
        question: '¿Cómo aplica esto al frenado?',
        answer: 'Al frenar, la fuerza de fricción genera una aceleración negativa (desaceleración). En Fórmula 1, los frenos de carbono generan fuerzas de hasta 5G. Usando $a = \\frac{F}{m}$, vemos que un auto de 800kg con frenado de 40,000N experimenta $a = 50 m/s^2$.',
      },
      {
        question: '¿Qué papel juega la aerodinámica?',
        answer: 'La aerodinámica genera fuerza descendente (downforce). Esta fuerza adicional aumenta la fricción entre neumáticos y pista, permitiendo mayor aceleración en curvas. En Fórmula 1, el downforce puede exceder el peso del auto a altas velocidades.',
      },
      {
        question: '¿Por qué los autos de F1 tienen DRS?',
        answer: 'El DRS (Drag Reduction System) reduce la resistencia aerodinámica al abrir el alerón trasero. Esto disminuye la fuerza de arrastre, permitiendo mayor aceleración según $a = \\frac{F_{motor} - F_{arrastre}}{m}$. La velocidad máxima aumenta aproximadamente 10-15 km/h.',
      },
    ],
  },
  {
    id: STUDENT_C_ID,
    name: 'Andrea Lopez (RAG Test)',
    email: 'andrea.rag@test.academio.edu',
    age: 20,
    gradeLevel: 'universidad2',
    topic: 'Oferta y Demanda',
    subject: 'economics',
    favoriteSports: ['tenis', 'yoga'],
    skillsToImprove: ['microeconomia', 'estadistica'],
    qaInjections: [
      {
        question: '¿Cómo se determina el precio de equilibrio?',
        answer: 'El precio de equilibrio $P^*$ se determina donde la cantidad demandada iguala la cantidad ofrecida: $Q_d(P^*) = Q_s(P^*)$. Algebraicamente, si $Q_d = a - bP$ y $Q_s = c + dP$, entonces $P^* = \\frac{a-c}{b+d}$.',
      },
      {
        question: '¿Qué mide la elasticidad precio de la demanda?',
        answer: 'La elasticidad precio de la demanda $\\varepsilon_d = \\frac{\\%\\Delta Q_d}{\\%\\Delta P} = \\frac{dQ}{dP} \\cdot \\frac{P}{Q}$ mide la sensibilidad de la cantidad demandada ante cambios en el precio. $|\\varepsilon_d| > 1$ indica demanda elástica; $|\\varepsilon_d| < 1$, inelástica.',
      },
      {
        question: '¿Cómo afecta un impuesto al equilibrio?',
        answer: 'Un impuesto unitario $t$ desplaza la curva de oferta verticalmente: $P_s = P_d + t$. El nuevo equilibrio tiene precio más alto y cantidad menor. La incidencia fiscal se reparte según las elasticidades: $\\frac{\\Delta P_d}{t} = \\frac{\\varepsilon_s}{\\varepsilon_s - \\varepsilon_d}$.',
      },
      {
        question: '¿Qué determina la pendiente de la curva de oferta?',
        answer: 'La pendiente de la oferta refleja los costos marginales de producción. Si $C(Q) = aQ^2 + bQ + c$, entonces $MC = 2aQ + b$. Igualando $P = MC$, obtenemos $Q_s = \\frac{P - b}{2a}$, donde $\\frac{1}{2a}$ es la pendiente de la oferta.',
      },
      {
        question: '¿Cómo calcular el excedente del consumidor?',
        answer: 'El excedente del consumidor es $CS = \\int_0^{Q^*} P_d(Q) dQ - P^* \\cdot Q^*$. Geométricamente, es el área del triángulo bajo la curva de demanda y sobre el precio de equilibrio. Para demanda lineal $P = a - bQ$, $CS = \\frac{(a - P^*)^2}{2b}$.',
      },
    ],
  },
];

async function main(): Promise<void> {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║         CREATE TEST STUDENTS - Academio AI Platform           ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Initialize database
  console.log('Initializing database...');
  await initializeDatabase();
  const db = getDb();
  console.log('✓ Database initialized\n');

  // Generate password hash for 'password123'
  const passwordHash = await bcrypt.hash('password123', 10);

  // Create test teacher if not exists
  const existingTeacher = db.prepare('SELECT id FROM users WHERE id = ?').get(TEST_TEACHER_ID);
  if (!existingTeacher) {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, name, created_at, updated_at)
      VALUES (?, 'test.teacher@test.academio.edu', ?, 'TEACHER', 'Test Teacher (RAG)', datetime('now'), datetime('now'))
    `).run(TEST_TEACHER_ID, passwordHash);
    console.log('✓ Created test teacher\n');
  }

  for (const student of TEST_STUDENTS) {
    console.log(`Creating: ${student.name}...`);

    try {
      // Delete existing data first (for re-runs)
      db.prepare('DELETE FROM lesson_chat_messages WHERE session_id IN (SELECT id FROM lesson_chat_sessions WHERE student_id = ?)').run(student.id);
      db.prepare('DELETE FROM lesson_chat_sessions WHERE student_id = ?').run(student.id);
      db.prepare('DELETE FROM personalized_lessons WHERE student_id = ?').run(student.id);
      db.prepare('DELETE FROM lessons WHERE id = ?').run(`lesson-${student.id}`);
      db.prepare('DELETE FROM student_profiles WHERE user_id = ?').run(student.id);
      db.prepare('DELETE FROM users WHERE id = ?').run(student.id);

      // 1. Create user
      db.prepare(`
        INSERT INTO users (id, email, password_hash, role, name, created_at, updated_at)
        VALUES (?, ?, ?, 'STUDENT', ?, datetime('now'), datetime('now'))
      `).run(student.id, student.email, passwordHash, student.name);
      console.log('  ✓ User created');

      // 2. Create student profile with complete data
      const profileId = `profile-${student.id}`;
      db.prepare(`
        INSERT INTO student_profiles (
          id, user_id, age, grade_level, favorite_sports, skills_to_improve,
          teacher_id, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        profileId,
        student.id,
        student.age,
        student.gradeLevel,
        JSON.stringify(student.favoriteSports),
        JSON.stringify(student.skillsToImprove),
        TEST_TEACHER_ID
      );
      console.log('  ✓ Profile created');

      // 3. Create lesson
      const lessonId = `lesson-${student.id}`;
      const lessonContent = `# ${student.topic}

Esta lección cubre los conceptos fundamentales de ${student.topic}.

## Objetivos de Aprendizaje
- Comprender los principios básicos
- Aplicar el conocimiento en problemas prácticos
- Desarrollar pensamiento crítico

## Contenido Principal
El tema de ${student.topic} es fundamental para tu desarrollo académico en ${student.subject}.`;

      db.prepare(`
        INSERT INTO lessons (id, teacher_id, title, topic, subject, master_content, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(lessonId, TEST_TEACHER_ID, `Lección: ${student.topic}`, student.topic, student.subject, lessonContent);
      console.log('  ✓ Lesson created');

      // 4. Create personalized lesson
      const personalizedLessonId = `personalized-${student.id}`;
      const personalizedContent = `# ${student.topic} - Personalizado

${lessonContent}

## Personalización
Esta versión ha sido adaptada para ti considerando:
- Tu edad: ${student.age} años
- Tu nivel académico: ${student.gradeLevel}
- Tus intereses: ${student.favoriteSports.join(', ')}`;

      db.prepare(`
        INSERT INTO personalized_lessons (id, lesson_id, student_id, personalized_content, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(personalizedLessonId, lessonId, student.id, personalizedContent);
      console.log('  ✓ Personalized lesson created');

      // 5. Create chat session
      const sessionId = `session-${student.id}`;
      db.prepare(`
        INSERT INTO lesson_chat_sessions (id, personalized_lesson_id, student_id, created_at, updated_at)
        VALUES (?, ?, ?, datetime('now'), datetime('now'))
      `).run(sessionId, personalizedLessonId, student.id);
      console.log('  ✓ Chat session created');

      // 6. Inject Q&A pairs into chat history
      for (let i = 0; i < student.qaInjections.length; i++) {
        const qa = student.qaInjections[i];
        const userMsgId = uuidv4();
        const assistantMsgId = uuidv4();

        db.prepare(`
          INSERT INTO lesson_chat_messages (id, session_id, role, content, timestamp)
          VALUES (?, ?, 'user', ?, datetime('now', '-${(student.qaInjections.length - i) * 5} minutes'))
        `).run(userMsgId, sessionId, qa.question);

        db.prepare(`
          INSERT INTO lesson_chat_messages (id, session_id, role, content, timestamp)
          VALUES (?, ?, 'assistant', ?, datetime('now', '-${(student.qaInjections.length - i) * 5 - 1} minutes'))
        `).run(assistantMsgId, sessionId, qa.answer);
      }
      console.log(`  ✓ ${student.qaInjections.length} Q&A pairs injected`);

      console.log(`  ✓ Complete!\n`);

    } catch (error) {
      console.error(`  ✗ Error: ${error}\n`);
    }
  }

  // Print credentials
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ TEST STUDENT LOGIN CREDENTIALS                              │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│ Password for all: password123                               │');
  console.log('├─────────────────────────────────────────────────────────────┤');

  for (const student of TEST_STUDENTS) {
    const emoji = student.age <= 10 ? '🧒' : student.age <= 17 ? '🧑' : '👩‍🎓';
    console.log(`│ ${emoji} ${student.name.padEnd(40)}│`);
    console.log(`│    Email: ${student.email.padEnd(45)}│`);
    console.log(`│    Age: ${String(student.age).padEnd(3)} | Grade: ${student.gradeLevel.padEnd(15)}│`);
    console.log('├─────────────────────────────────────────────────────────────┤');
  }

  console.log('│                                                             │');
  console.log('│ Go to: http://localhost:5173/login                          │');
  console.log('│ Use email above + password: password123                     │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');

  closeDatabase();
  console.log('Done!');
}

main().catch(console.error);
