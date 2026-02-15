import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
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

  // Ensure few-shot-prompts directory exists
  if (!fs.existsSync(config.paths.fewShotPrompts)) {
    fs.mkdirSync(config.paths.fewShotPrompts, { recursive: true });
  }

  // Create database connection
  db = new Database(config.paths.database);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Add classroom columns if they don't exist (migration for existing DBs)
  // Must run BEFORE schema to avoid index creation errors
  addClassroomColumns();

  // Add teacher_ids column for multiple teachers support
  addTeacherIdsColumn();

  // Read and execute schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  // Execute each statement separately, skipping index creation for classroom_id if already done
  const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    try {
      db.exec(statement);
    } catch (err: unknown) {
      // Ignore "index already exists" errors from migration
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (!errorMessage.includes('already exists')) {
        throw err;
      }
    }
  }

  console.log('Database initialized successfully');

  // Seed with dummy data for testing
  await seedDatabase();
};

export const closeDatabase = (): void => {
  if (db) {
    db.close();
  }
};

/**
 * Seeds the database with dummy data for testing
 * Uses the new unified user system with JWT auth and multi-school architecture
 */
export const seedDatabase = async (): Promise<void> => {
  // Check if data already exists in the new users table
  const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (existingUsers.count > 0) {
    console.log('Database already has data, skipping seed');
    // Run migration for existing data
    await migrateToMultiSchool();
    return;
  }

  console.log('Seeding database with dummy data...');

  // Create default school first
  const defaultSchoolId = uuidv4();
  db.prepare(`
    INSERT INTO schools (id, name, domain, settings, subscription_tier, max_students, max_teachers, is_active, created_at, updated_at)
    VALUES (?, 'Academio Demo School', 'academio.edu', '{}', 'premium', 500, 50, 1, datetime('now'), datetime('now'))
  `).run(defaultSchoolId);

  console.log(`Created default school: ${defaultSchoolId}`);

  // Hash password for seeded users (using async bcrypt)
  const defaultPasswordHash = await bcrypt.hash('password123', 10);

  // Create teachers
  const teacherData = [
    { name: 'Ms. Sarah Johnson', email: 'sarah.johnson@academio.edu' },
    { name: 'Mr. David Kim', email: 'david.kim@academio.edu' },
  ];

  const teacherIds: string[] = [];

  for (const teacher of teacherData) {
    const teacherId = uuidv4();
    teacherIds.push(teacherId);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, name, school_id, created_at, updated_at)
      VALUES (?, ?, ?, 'TEACHER', ?, ?, datetime('now'), datetime('now'))
    `).run(teacherId, teacher.email, defaultPasswordHash, teacher.name, defaultSchoolId);

    // Create school membership for teacher
    db.prepare(`
      INSERT INTO school_memberships (id, user_id, school_id, role, is_primary, permissions, joined_at)
      VALUES (?, ?, ?, 'TEACHER', 1, '{}', datetime('now'))
    `).run(uuidv4(), teacherId, defaultSchoolId);

    // Also insert into legacy teachers table for backward compatibility
    db.prepare(`
      INSERT INTO teachers (id, name, email, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(teacherId, teacher.name, teacher.email, defaultPasswordHash);
  }

  const teacherId = teacherIds[0]; // Use first teacher for classrooms

  // Create classrooms with school_id
  const classrooms = [
    { id: uuidv4(), name: 'Mathematics 101', subject: 'math', gradeLevel: '6th Grade' },
    { id: uuidv4(), name: 'Science Explorer', subject: 'science', gradeLevel: '6th Grade' },
    { id: uuidv4(), name: 'History & Geography', subject: 'history', gradeLevel: '6th Grade' },
    { id: uuidv4(), name: 'English Language Arts', subject: 'english', gradeLevel: '6th Grade' },
  ];

  for (const classroom of classrooms) {
    db.prepare(`
      INSERT INTO classrooms (id, teacher_id, name, subject, grade_level, school_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(classroom.id, teacherId, classroom.name, classroom.subject, classroom.gradeLevel, defaultSchoolId);
  }

  // Student data for seeding
  const studentData = [
    { first: 'Emma', last: 'Rodriguez', age: 11, sports: ['soccer', 'swimming'], skills: ['math', 'problem-solving'] },
    { first: 'Liam', last: 'Chen', age: 12, sports: ['basketball', 'tennis'], skills: ['vocabulary', 'reading'] },
    { first: 'Sophia', last: 'Patel', age: 11, sports: ['dance', 'gymnastics'], skills: ['writing', 'creativity'] },
    { first: 'Noah', last: 'Williams', age: 12, sports: ['football', 'baseball'], skills: ['critical thinking'] },
    { first: 'Olivia', last: 'Johnson', age: 11, sports: ['volleyball'], skills: ['math', 'science'] },
    { first: 'Ethan', last: 'Brown', age: 12, sports: ['soccer', 'basketball'], skills: ['history', 'geography'] },
    { first: 'Ava', last: 'Garcia', age: 11, sports: ['cheerleading', 'dance'], skills: ['english', 'vocabulary'] },
    { first: 'Mason', last: 'Martinez', age: 12, sports: ['baseball'], skills: ['math', 'logic'] },
    { first: 'Isabella', last: 'Davis', age: 11, sports: ['swimming', 'track'], skills: ['science', 'critical thinking'] },
    { first: 'Lucas', last: 'Wilson', age: 12, sports: ['basketball', 'football'], skills: ['reading', 'comprehension'] },
    { first: 'Mia', last: 'Anderson', age: 11, sports: ['gymnastics'], skills: ['writing', 'creativity'] },
    { first: 'Jackson', last: 'Taylor', age: 12, sports: ['hockey', 'lacrosse'], skills: ['problem-solving'] },
    { first: 'Charlotte', last: 'Thomas', age: 11, sports: ['tennis', 'swimming'], skills: ['vocabulary', 'reading'] },
    { first: 'Aiden', last: 'Moore', age: 12, sports: ['soccer'], skills: ['math', 'science'] },
    { first: 'Harper', last: 'Jackson', age: 11, sports: ['dance', 'volleyball'], skills: ['english', 'history'] },
    // Additional students
    { first: 'Alex', last: 'Turner', age: 12, sports: ['skateboarding', 'swimming'], skills: ['science', 'math'] },
    { first: 'Zoe', last: 'Martinez', age: 11, sports: ['soccer', 'track'], skills: ['reading', 'writing'] },
    { first: 'Ryan', last: 'Cooper', age: 12, sports: ['basketball', 'video games'], skills: ['problem-solving', 'logic'] },
  ];

  const students: { id: string; name: string; email: string; classroomId: string; basePerformance: number }[] = [];

  for (let i = 0; i < studentData.length; i++) {
    const student = studentData[i];
    const userId = uuidv4();
    const profileId = uuidv4();
    const classroomIndex = i % classrooms.length;
    const email = `${student.first.toLowerCase()}.${student.last.toLowerCase()}@student.academio.edu`;
    const gradeLevel = '6th Grade';
    const basePerformance = 60 + Math.random() * 30; // 60-90 base
    const fullName = `${student.first} ${student.last}`;

    // Insert into unified users table with school_id
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, name, school_id, created_at, updated_at)
      VALUES (?, ?, ?, 'STUDENT', ?, ?, datetime('now'), datetime('now'))
    `).run(userId, email, defaultPasswordHash, fullName, defaultSchoolId);

    // Create school membership for student
    db.prepare(`
      INSERT INTO school_memberships (id, user_id, school_id, role, is_primary, permissions, joined_at)
      VALUES (?, ?, ?, 'STUDENT', 1, '{}', datetime('now'))
    `).run(uuidv4(), userId, defaultSchoolId);

    // Insert into student_profiles table with personalization data and school_id
    db.prepare(`
      INSERT INTO student_profiles (id, user_id, age, favorite_sports, skills_to_improve, grade_level, classroom_id, school_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      profileId,
      userId,
      student.age,
      JSON.stringify(student.sports),
      JSON.stringify(student.skills),
      gradeLevel,
      classrooms[classroomIndex].id,
      defaultSchoolId
    );

    // Also insert into legacy students table for backward compatibility
    db.prepare(`
      INSERT INTO students (id, classroom_id, name, email, grade_level, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(userId, classrooms[classroomIndex].id, fullName, email, gradeLevel);

    students.push({ id: userId, name: fullName, email, classroomId: classrooms[classroomIndex].id, basePerformance });
  }

  // Create grades for each student
  const subjects = ['math', 'science', 'history', 'geography', 'english'];
  const assignmentTypes = ['homework', 'quiz', 'test', 'project', 'participation'];

  for (const student of students) {
    for (const subject of subjects) {
      const gradeCount = 3 + Math.floor(Math.random() * 3);

      for (let i = 0; i < gradeCount; i++) {
        const gradeId = uuidv4();
        const assignmentType = assignmentTypes[Math.floor(Math.random() * assignmentTypes.length)];
        const maxGrade = assignmentType === 'test' ? 100 : assignmentType === 'quiz' ? 50 : 20;

        let scorePercent = student.basePerformance + (Math.random() - 0.5) * 20;
        scorePercent = Math.min(100, Math.max(40, scorePercent));

        const grade = Math.round((scorePercent / 100) * maxGrade);
        const daysAgo = Math.floor(Math.random() * 60);

        db.prepare(`
          INSERT INTO student_grades (id, student_id, user_id, subject, assignment_type, assignment_name, grade, max_grade, graded_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now', '-' || ? || ' days'))
        `).run(gradeId, student.id, student.id, subject, assignmentType, `${subject.charAt(0).toUpperCase() + subject.slice(1)} ${assignmentType} ${i + 1}`, grade, maxGrade, daysAgo);
      }
    }

    // Create a session for each student with user_id and school_id
    const sessionId = uuidv4();
    const subjectForSession = subjects[Math.floor(Math.random() * subjects.length)];

    db.prepare(`
      INSERT INTO sessions (id, topic, title, student_id, user_id, school_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' hours'), datetime('now'))
    `).run(sessionId, subjectForSession, `${student.name} - ${subjectForSession} session`, student.id, student.id, defaultSchoolId, Math.floor(Math.random() * 48));

    // Create learning analytics with user_id
    const struggleScore = student.basePerformance < 70 ? 0.3 + Math.random() * 0.5 : Math.random() * 0.3;
    const questionsAsked = Math.floor(Math.random() * 50) + 5;
    const timeSpent = (15 + Math.floor(Math.random() * 30)) * 60;

    const analyticsId = uuidv4();
    db.prepare(`
      INSERT INTO learning_analytics (
        id, student_id, user_id, session_id, subject, topic, questions_asked,
        time_spent_seconds, struggle_score, resolved, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      analyticsId,
      student.id,
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
  console.log(`  - 1 default school`);
  console.log(`  - 1 teacher (unified users table)`);
  console.log(`  - ${classrooms.length} classrooms`);
  console.log(`  - ${students.length} students (with profiles)`);
  console.log(`  - ${students.length * subjects.length * 4} grades (approximately)`);
  console.log(`  - ${students.length} sessions`);
  console.log(`  - ${students.length} learning analytics records`);
  console.log(`  - Default password for all users: password123`);
};

/**
 * Add classroom_id columns to lessons and homework tables if they don't exist
 */
export const addClassroomColumns = (): void => {
  // Check if lessons table exists first
  const lessonsTableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='lessons'"
  ).get();

  if (lessonsTableExists) {
    // Check if classroom_id column exists in lessons table
    const lessonsInfo = db.prepare("PRAGMA table_info(lessons)").all() as { name: string }[];
    const hasLessonsClassroomId = lessonsInfo.some(col => col.name === 'classroom_id');

    if (!hasLessonsClassroomId) {
      console.log('Adding classroom_id column to lessons table...');
      db.exec('ALTER TABLE lessons ADD COLUMN classroom_id TEXT REFERENCES classrooms(id) ON DELETE SET NULL');
      db.exec('CREATE INDEX IF NOT EXISTS idx_lessons_classroom_id ON lessons(classroom_id)');
    }
  }

  // Check if homework_assignments table exists first
  const homeworkTableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='homework_assignments'"
  ).get();

  if (homeworkTableExists) {
    // Check if classroom_id column exists in homework_assignments table
    const homeworkInfo = db.prepare("PRAGMA table_info(homework_assignments)").all() as { name: string }[];
    const hasHomeworkClassroomId = homeworkInfo.some(col => col.name === 'classroom_id');

    if (!hasHomeworkClassroomId) {
      console.log('Adding classroom_id column to homework_assignments table...');
      db.exec('ALTER TABLE homework_assignments ADD COLUMN classroom_id TEXT REFERENCES classrooms(id) ON DELETE SET NULL');
      db.exec('CREATE INDEX IF NOT EXISTS idx_homework_assignments_classroom_id ON homework_assignments(classroom_id)');
    }
  }
};

/**
 * Add teacher_ids column to student_profiles for multiple teacher support
 */
export const addTeacherIdsColumn = (): void => {
  // Check if student_profiles table exists first
  const profilesTableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='student_profiles'"
  ).get();

  if (profilesTableExists) {
    // Check if teacher_ids column exists
    const profilesInfo = db.prepare("PRAGMA table_info(student_profiles)").all() as { name: string }[];
    const hasTeacherIds = profilesInfo.some(col => col.name === 'teacher_ids');

    if (!hasTeacherIds) {
      console.log('Adding teacher_ids column to student_profiles table...');
      db.exec('ALTER TABLE student_profiles ADD COLUMN teacher_ids TEXT');
    }
  }
};

/**
 * Migrates existing data to multi-school architecture
 * Creates default school, populates user_id columns, creates school memberships
 */
export const migrateToMultiSchool = async (): Promise<void> => {
  // Check if migration already done (schools table has data)
  const existingSchools = db.prepare('SELECT COUNT(*) as count FROM schools').get() as { count: number };
  if (existingSchools.count > 0) {
    console.log('Multi-school migration already complete');
    return;
  }

  console.log('Running multi-school migration...');

  // Create default school
  const defaultSchoolId = uuidv4();
  db.prepare(`
    INSERT INTO schools (id, name, domain, settings, subscription_tier, max_students, max_teachers, is_active, created_at, updated_at)
    VALUES (?, 'Academio Demo School', 'academio.edu', '{}', 'premium', 500, 50, 1, datetime('now'), datetime('now'))
  `).run(defaultSchoolId);

  console.log(`Created default school: ${defaultSchoolId}`);

  // Update all users with default school_id
  const usersUpdated = db.prepare(`
    UPDATE users SET school_id = ? WHERE school_id IS NULL
  `).run(defaultSchoolId);
  console.log(`Updated ${usersUpdated.changes} users with school_id`);

  // Create school memberships for all users
  const users = db.prepare('SELECT id, role FROM users').all() as { id: string; role: string }[];
  for (const user of users) {
    const existingMembership = db.prepare(
      'SELECT 1 FROM school_memberships WHERE user_id = ? AND school_id = ?'
    ).get(user.id, defaultSchoolId);

    if (!existingMembership) {
      db.prepare(`
        INSERT INTO school_memberships (id, user_id, school_id, role, is_primary, permissions, joined_at)
        VALUES (?, ?, ?, ?, 1, '{}', datetime('now'))
      `).run(uuidv4(), user.id, defaultSchoolId, user.role);
    }
  }
  console.log(`Created school memberships for ${users.length} users`);

  // Update classrooms with school_id
  const classroomsUpdated = db.prepare(`
    UPDATE classrooms SET school_id = ? WHERE school_id IS NULL
  `).run(defaultSchoolId);
  console.log(`Updated ${classroomsUpdated.changes} classrooms with school_id`);

  // Update student_profiles with school_id
  const profilesUpdated = db.prepare(`
    UPDATE student_profiles SET school_id = ? WHERE school_id IS NULL
  `).run(defaultSchoolId);
  console.log(`Updated ${profilesUpdated.changes} student profiles with school_id`);

  // Update sessions with user_id (from student_id) and school_id
  const sessionsToMigrate = db.prepare(`
    SELECT s.id, s.student_id FROM sessions s WHERE s.user_id IS NULL AND s.student_id IS NOT NULL
  `).all() as { id: string; student_id: string }[];

  for (const session of sessionsToMigrate) {
    db.prepare(`
      UPDATE sessions SET user_id = ?, school_id = ? WHERE id = ?
    `).run(session.student_id, defaultSchoolId, session.id);
  }
  console.log(`Migrated ${sessionsToMigrate.length} sessions to user_id`);

  // Update student_grades with user_id (from student_id)
  const gradesToMigrate = db.prepare(`
    SELECT g.id, g.student_id FROM student_grades g WHERE g.user_id IS NULL AND g.student_id IS NOT NULL
  `).all() as { id: string; student_id: string }[];

  for (const grade of gradesToMigrate) {
    db.prepare(`
      UPDATE student_grades SET user_id = ? WHERE id = ?
    `).run(grade.student_id, grade.id);
  }
  console.log(`Migrated ${gradesToMigrate.length} grades to user_id`);

  // Update learning_analytics with user_id (from student_id)
  const analyticsToMigrate = db.prepare(`
    SELECT la.id, la.student_id FROM learning_analytics la WHERE la.user_id IS NULL AND la.student_id IS NOT NULL
  `).all() as { id: string; student_id: string }[];

  for (const analytics of analyticsToMigrate) {
    db.prepare(`
      UPDATE learning_analytics SET user_id = ? WHERE id = ?
    `).run(analytics.student_id, analytics.id);
  }
  console.log(`Migrated ${analyticsToMigrate.length} analytics records to user_id`);

  // Update teacher_chat_sessions with user_id (from teacher_id matching users table)
  const teacherSessionsToMigrate = db.prepare(`
    SELECT tcs.id, tcs.teacher_id, u.id as user_id
    FROM teacher_chat_sessions tcs
    LEFT JOIN users u ON u.id = tcs.teacher_id
    WHERE tcs.user_id IS NULL AND tcs.teacher_id IS NOT NULL
  `).all() as { id: string; teacher_id: string; user_id: string | null }[];

  for (const session of teacherSessionsToMigrate) {
    if (session.user_id) {
      db.prepare(`
        UPDATE teacher_chat_sessions SET user_id = ? WHERE id = ?
      `).run(session.user_id, session.id);
    }
  }
  console.log(`Migrated ${teacherSessionsToMigrate.length} teacher chat sessions to user_id`);

  // Update lessons with school_id
  const lessonsUpdated = db.prepare(`
    UPDATE lessons SET school_id = ? WHERE school_id IS NULL
  `).run(defaultSchoolId);
  console.log(`Updated ${lessonsUpdated.changes} lessons with school_id`);

  // Update homework_assignments with school_id
  const homeworkUpdated = db.prepare(`
    UPDATE homework_assignments SET school_id = ? WHERE school_id IS NULL
  `).run(defaultSchoolId);
  console.log(`Updated ${homeworkUpdated.changes} homework assignments with school_id`);

  console.log('Multi-school migration complete!');
};
