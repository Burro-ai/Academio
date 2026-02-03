import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';

let db: Database.Database;

export const getDb = (): Database.Database => {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return db;
};

export const initializeDatabase = async (): Promise<void> => {
  // Ensure data directory exists
  const dataDir = path.dirname(config.paths.database);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Create database connection
  db = new Database(config.paths.database);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Read and execute schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  // Execute each statement separately
  const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    db.exec(statement);
  }

  console.log('Database initialized successfully');

  // Seed with dummy data for testing
  seedDatabase();
};

export const closeDatabase = (): void => {
  if (db) {
    db.close();
  }
};

/**
 * Seeds the database with dummy data for testing
 */
export const seedDatabase = (): void => {
  // Check if data already exists
  const existingStudents = db.prepare('SELECT COUNT(*) as count FROM students').get() as { count: number };
  if (existingStudents.count > 0) {
    console.log('Database already has data, skipping seed');
    return;
  }

  console.log('Seeding database with dummy data...');

  // Create default teacher (password_hash column matches schema)
  const teacherId = uuidv4();
  db.prepare(`
    INSERT INTO teachers (id, name, email, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(teacherId, 'Ms. Sarah Johnson', 'sarah.johnson@academio.edu', config.teacherPassword);

  // Create classrooms
  const classrooms = [
    { id: uuidv4(), name: 'Mathematics 101', subject: 'math', gradeLevel: '6th Grade' },
    { id: uuidv4(), name: 'Science Explorer', subject: 'science', gradeLevel: '6th Grade' },
    { id: uuidv4(), name: 'History & Geography', subject: 'history', gradeLevel: '6th Grade' },
    { id: uuidv4(), name: 'English Language Arts', subject: 'english', gradeLevel: '6th Grade' },
  ];

  for (const classroom of classrooms) {
    db.prepare(`
      INSERT INTO classrooms (id, teacher_id, name, subject, grade_level, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(classroom.id, teacherId, classroom.name, classroom.subject, classroom.gradeLevel);
  }

  // Create students with realistic data
  const studentNames = [
    { first: 'Emma', last: 'Rodriguez' },
    { first: 'Liam', last: 'Chen' },
    { first: 'Sophia', last: 'Patel' },
    { first: 'Noah', last: 'Williams' },
    { first: 'Olivia', last: 'Johnson' },
    { first: 'Ethan', last: 'Brown' },
    { first: 'Ava', last: 'Garcia' },
    { first: 'Mason', last: 'Martinez' },
    { first: 'Isabella', last: 'Davis' },
    { first: 'Lucas', last: 'Wilson' },
    { first: 'Mia', last: 'Anderson' },
    { first: 'Jackson', last: 'Taylor' },
    { first: 'Charlotte', last: 'Thomas' },
    { first: 'Aiden', last: 'Moore' },
    { first: 'Harper', last: 'Jackson' },
  ];

  const students: { id: string; name: string; email: string; classroomId: string; basePerformance: number }[] = [];

  for (let i = 0; i < studentNames.length; i++) {
    const student = studentNames[i];
    const studentId = uuidv4();
    const classroomIndex = i % classrooms.length;
    const email = `${student.first.toLowerCase()}.${student.last.toLowerCase()}@student.academio.edu`;
    const gradeLevel = '6th Grade';
    const basePerformance = 60 + Math.random() * 30; // 60-90 base

    db.prepare(`
      INSERT INTO students (id, classroom_id, name, email, grade_level, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(studentId, classrooms[classroomIndex].id, `${student.first} ${student.last}`, email, gradeLevel);

    students.push({ id: studentId, name: `${student.first} ${student.last}`, email, classroomId: classrooms[classroomIndex].id, basePerformance });
  }

  // Create grades for each student (using grade/max_grade columns to match schema)
  const subjects = ['math', 'science', 'history', 'geography', 'english'];
  const assignmentTypes = ['homework', 'quiz', 'test', 'project', 'participation'];

  for (const student of students) {
    for (const subject of subjects) {
      // 3-5 grades per subject
      const gradeCount = 3 + Math.floor(Math.random() * 3);

      for (let i = 0; i < gradeCount; i++) {
        const gradeId = uuidv4();
        const assignmentType = assignmentTypes[Math.floor(Math.random() * assignmentTypes.length)];
        const maxGrade = assignmentType === 'test' ? 100 : assignmentType === 'quiz' ? 50 : 20;

        // Add some variance to base performance
        let scorePercent = student.basePerformance + (Math.random() - 0.5) * 20;
        scorePercent = Math.min(100, Math.max(40, scorePercent)); // Clamp between 40-100

        const grade = Math.round((scorePercent / 100) * maxGrade);
        const daysAgo = Math.floor(Math.random() * 60);

        db.prepare(`
          INSERT INTO student_grades (id, student_id, subject, assignment_type, assignment_name, grade, max_grade, graded_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, date('now', '-' || ? || ' days'))
        `).run(gradeId, student.id, subject, assignmentType, `${subject.charAt(0).toUpperCase() + subject.slice(1)} ${assignmentType} ${i + 1}`, grade, maxGrade, daysAgo);
      }
    }

    // Create a session for each student to link learning_analytics
    const sessionId = uuidv4();
    const subjectForSession = subjects[Math.floor(Math.random() * subjects.length)];

    db.prepare(`
      INSERT INTO sessions (id, topic, title, student_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now', '-' || ? || ' hours'), datetime('now'))
    `).run(sessionId, subjectForSession, `${student.name} - ${subjectForSession} session`, student.id, Math.floor(Math.random() * 48));

    // Calculate struggle score based on performance
    const struggleScore = student.basePerformance < 70 ? 0.3 + Math.random() * 0.5 : Math.random() * 0.3;
    const questionsAsked = Math.floor(Math.random() * 50) + 5;
    const timeSpent = (15 + Math.floor(Math.random() * 30)) * 60; // in seconds

    // Create learning analytics for each student (matches schema with session_id)
    const analyticsId = uuidv4();
    db.prepare(`
      INSERT INTO learning_analytics (
        id, student_id, session_id, subject, topic, questions_asked,
        time_spent_seconds, struggle_score, resolved, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      analyticsId,
      student.id,
      sessionId,
      subjectForSession,
      'General topics',
      questionsAsked,
      timeSpent,
      struggleScore,
      struggleScore < 0.3 ? 1 : 0
    );
  }

  console.log(`Seeded database with:`);
  console.log(`  - 1 teacher`);
  console.log(`  - ${classrooms.length} classrooms`);
  console.log(`  - ${students.length} students`);
  console.log(`  - ${students.length * subjects.length * 4} grades (approximately)`);
  console.log(`  - ${students.length} sessions`);
  console.log(`  - ${students.length} learning analytics records`);
};
