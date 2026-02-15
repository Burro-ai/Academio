-- Academio Database Schema

-- ============================================
-- MULTI-SCHOOL ARCHITECTURE
-- ============================================

-- Schools (top-level entity for multi-tenancy)
CREATE TABLE IF NOT EXISTS schools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT,                    -- For SSO/email matching
    settings TEXT DEFAULT '{}',     -- JSON config
    subscription_tier TEXT DEFAULT 'free',
    max_students INTEGER DEFAULT 100,
    max_teachers INTEGER DEFAULT 10,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- School memberships (multi-school support for teachers)
CREATE TABLE IF NOT EXISTS school_memberships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    school_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('STUDENT', 'TEACHER', 'ADMIN')),
    is_primary INTEGER DEFAULT 1,
    permissions TEXT DEFAULT '{}',  -- JSON: granular permissions
    joined_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, school_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- ============================================
-- UNIFIED AUTH SYSTEM (Role-based: STUDENT or TEACHER)
-- ============================================

-- Unified users table (replaces separate teachers/students auth)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('STUDENT', 'TEACHER')),
    name TEXT NOT NULL,
    avatar_url TEXT,
    school_id TEXT,                 -- Primary school (nullable for migration)
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL
);

-- Unique email per school (allows same email at different schools)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_school ON users(email, school_id);

-- ============================================
-- TEACHER INTERFACE TABLES
-- ============================================

-- Classrooms table: classroom definitions
CREATE TABLE IF NOT EXISTS classrooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    subject TEXT,
    grade_level TEXT,
    school_id TEXT,                 -- School scope (nullable for migration)
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- ============================================
-- STUDENT PROFILES (Extended data for AI personalization)
-- ============================================

-- Student profiles: extended data for personalization
CREATE TABLE IF NOT EXISTS student_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    age INTEGER,
    favorite_sports TEXT,        -- JSON array
    skills_to_improve TEXT,      -- JSON array
    grade_history TEXT,          -- JSON object
    learning_system_prompt TEXT, -- Personal AI customization
    grade_level TEXT,
    classroom_id TEXT,
    teacher_id TEXT,             -- Primary teacher (backwards compatible)
    teacher_ids TEXT,            -- JSON array of multiple teacher IDs
    school_id TEXT,              -- School scope (nullable for migration)
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE SET NULL,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- Legacy students table (kept for backward compatibility during migration)
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    avatar_url TEXT,
    grade_level TEXT,
    classroom_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE SET NULL
);

-- Legacy teachers table (kept for backward compatibility)
CREATE TABLE IF NOT EXISTS teachers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- STUDENT INTERFACE TABLES
-- ============================================

-- Sessions table: stores chat sessions with topic context
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL DEFAULT 'general',
    title TEXT NOT NULL,
    student_id TEXT,               -- Legacy FK (kept for migration)
    user_id TEXT,                  -- New FK to users table
    school_id TEXT,                -- School scope (nullable for migration)
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- Messages table: stores all chat messages
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    attachments TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- ============================================
-- MORE TEACHER INTERFACE TABLES
-- ============================================

-- Student grades history
CREATE TABLE IF NOT EXISTS student_grades (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,      -- Legacy FK (kept for migration)
    user_id TEXT,                  -- New FK to users table
    subject TEXT NOT NULL,
    grade REAL NOT NULL,
    max_grade REAL NOT NULL DEFAULT 100,
    assignment_name TEXT,
    assignment_type TEXT CHECK (assignment_type IN ('homework', 'test', 'quiz', 'project', 'participation')),
    graded_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Learning analytics: tracks AI copilot usage patterns
CREATE TABLE IF NOT EXISTS learning_analytics (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,      -- Legacy FK (kept for migration)
    user_id TEXT,                  -- New FK to users table
    session_id TEXT NOT NULL,
    subject TEXT,
    topic TEXT,
    questions_asked INTEGER DEFAULT 0,
    time_spent_seconds INTEGER DEFAULT 0,
    struggle_score REAL DEFAULT 0,
    resolved INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Teacher chat sessions: for material generation
CREATE TABLE IF NOT EXISTS teacher_chat_sessions (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,      -- Legacy FK (kept for migration)
    user_id TEXT,                  -- New FK to users table
    title TEXT,
    material_type TEXT CHECK (material_type IN ('lesson', 'presentation', 'test', 'homework', 'general')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Teacher chat messages
CREATE TABLE IF NOT EXISTS teacher_chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES teacher_chat_sessions(id) ON DELETE CASCADE
);

-- ============================================
-- INDEXES
-- ============================================

-- Schools & Memberships
CREATE INDEX IF NOT EXISTS idx_schools_domain ON schools(domain);
CREATE INDEX IF NOT EXISTS idx_school_memberships_user_id ON school_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_school_memberships_school_id ON school_memberships(school_id);
CREATE INDEX IF NOT EXISTS idx_school_memberships_school_role ON school_memberships(school_id, role);

-- Messages
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);

-- Sessions (both legacy and new FK)
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_student_id ON sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_school_id ON sessions(school_id);

-- Classrooms
CREATE INDEX IF NOT EXISTS idx_classrooms_teacher_id ON classrooms(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classrooms_school_id ON classrooms(school_id);

-- Legacy students (kept for migration)
CREATE INDEX IF NOT EXISTS idx_students_classroom_id ON students(classroom_id);

-- Student grades (both legacy and new FK)
CREATE INDEX IF NOT EXISTS idx_student_grades_student_id ON student_grades(student_id);
CREATE INDEX IF NOT EXISTS idx_student_grades_user_id ON student_grades(user_id);
CREATE INDEX IF NOT EXISTS idx_student_grades_subject ON student_grades(subject);

-- Learning analytics (both legacy and new FK)
CREATE INDEX IF NOT EXISTS idx_learning_analytics_student_id ON learning_analytics(student_id);
CREATE INDEX IF NOT EXISTS idx_learning_analytics_user_id ON learning_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_analytics_session_id ON learning_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_learning_analytics_struggle ON learning_analytics(struggle_score DESC);

-- Teacher chat sessions (both legacy and new FK)
CREATE INDEX IF NOT EXISTS idx_teacher_chat_sessions_teacher_id ON teacher_chat_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_chat_sessions_user_id ON teacher_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_teacher_chat_messages_session_id ON teacher_chat_messages(session_id);

-- ============================================
-- LESSON & HOMEWORK SYSTEM (AI Customization Loop)
-- ============================================

-- Lessons (teacher-created master content)
CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    subject TEXT,
    master_content TEXT NOT NULL,
    classroom_id TEXT,             -- Target classroom (null = all students)
    school_id TEXT,                -- School scope (nullable for migration)
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE SET NULL,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- Personalized lessons (per student - AI generated)
CREATE TABLE IF NOT EXISTS personalized_lessons (
    id TEXT PRIMARY KEY,
    lesson_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    personalized_content TEXT NOT NULL,
    viewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(lesson_id, student_id)
);

-- Homework assignments (teacher-created master content)
CREATE TABLE IF NOT EXISTS homework_assignments (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    subject TEXT,
    master_content TEXT NOT NULL,
    due_date TEXT,
    classroom_id TEXT,             -- Target classroom (null = all students)
    school_id TEXT,                -- School scope (nullable for migration)
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE SET NULL,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- Personalized homework (per student - AI generated)
CREATE TABLE IF NOT EXISTS personalized_homework (
    id TEXT PRIMARY KEY,
    homework_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    personalized_content TEXT NOT NULL,
    submitted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (homework_id) REFERENCES homework_assignments(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(homework_id, student_id)
);

-- ============================================
-- ADDITIONAL INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_school_id ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_school_role ON users(school_id, role);
CREATE INDEX IF NOT EXISTS idx_student_profiles_user_id ON student_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_classroom_id ON student_profiles(classroom_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_teacher_id ON student_profiles(teacher_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_school_id ON student_profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_lessons_teacher_id ON lessons(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lessons_classroom_id ON lessons(classroom_id);
CREATE INDEX IF NOT EXISTS idx_lessons_school_id ON lessons(school_id);
CREATE INDEX IF NOT EXISTS idx_personalized_lessons_lesson_id ON personalized_lessons(lesson_id);
CREATE INDEX IF NOT EXISTS idx_personalized_lessons_student_id ON personalized_lessons(student_id);
CREATE INDEX IF NOT EXISTS idx_homework_assignments_teacher_id ON homework_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_homework_assignments_classroom_id ON homework_assignments(classroom_id);
CREATE INDEX IF NOT EXISTS idx_homework_assignments_school_id ON homework_assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_personalized_homework_homework_id ON personalized_homework(homework_id);
CREATE INDEX IF NOT EXISTS idx_personalized_homework_student_id ON personalized_homework(student_id);

-- ============================================
-- LESSON CHAT SYSTEM (Interactive AI Tutoring)
-- ============================================

-- Lesson Chat Sessions (one per student per lesson)
CREATE TABLE IF NOT EXISTS lesson_chat_sessions (
    id TEXT PRIMARY KEY,
    personalized_lesson_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (personalized_lesson_id) REFERENCES personalized_lessons(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(personalized_lesson_id, student_id)
);

-- Lesson Chat Messages
CREATE TABLE IF NOT EXISTS lesson_chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES lesson_chat_sessions(id) ON DELETE CASCADE
);

-- ============================================
-- HOMEWORK SUBMISSIONS SYSTEM (Structured Grading)
-- ============================================

-- Homework Submissions (structured answers + grading)
CREATE TABLE IF NOT EXISTS homework_submissions (
    id TEXT PRIMARY KEY,
    personalized_homework_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    answers TEXT NOT NULL,                    -- JSON array of {questionId, value}
    submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
    grade REAL,                               -- 0-100
    feedback TEXT,
    ai_suggested_grade REAL,
    ai_suggested_feedback TEXT,
    graded_by TEXT,                           -- Teacher user ID
    graded_at TEXT,
    FOREIGN KEY (personalized_homework_id) REFERENCES personalized_homework(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(personalized_homework_id, student_id)
);

-- ============================================
-- LESSON CHAT & HOMEWORK SUBMISSIONS INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_lesson_chat_sessions_lesson ON lesson_chat_sessions(personalized_lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_chat_sessions_student ON lesson_chat_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_chat_messages_session ON lesson_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_lesson_chat_messages_timestamp ON lesson_chat_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_homework ON homework_submissions(personalized_homework_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_student ON homework_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_pending ON homework_submissions(graded_at) WHERE graded_at IS NULL;
