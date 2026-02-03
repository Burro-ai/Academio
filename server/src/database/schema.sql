-- Academio Database Schema

-- ============================================
-- TEACHER INTERFACE TABLES (Created first for foreign key dependencies)
-- ============================================

-- Teachers table: teacher accounts
CREATE TABLE IF NOT EXISTS teachers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Classrooms table: classroom definitions
CREATE TABLE IF NOT EXISTS classrooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    subject TEXT,
    grade_level TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

-- Students table: student profiles
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

-- ============================================
-- STUDENT INTERFACE TABLES
-- ============================================

-- Sessions table: stores chat sessions with topic context
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL DEFAULT 'general',
    title TEXT NOT NULL,
    student_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
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
    student_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    grade REAL NOT NULL,
    max_grade REAL NOT NULL DEFAULT 100,
    assignment_name TEXT,
    assignment_type TEXT CHECK (assignment_type IN ('homework', 'test', 'quiz', 'project', 'participation')),
    graded_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Learning analytics: tracks AI copilot usage patterns
CREATE TABLE IF NOT EXISTS learning_analytics (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
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
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Teacher chat sessions: for material generation
CREATE TABLE IF NOT EXISTS teacher_chat_sessions (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    title TEXT,
    material_type TEXT CHECK (material_type IN ('lesson', 'presentation', 'test', 'homework', 'general')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
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

CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_student_id ON sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_classrooms_teacher_id ON classrooms(teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_classroom_id ON students(classroom_id);
CREATE INDEX IF NOT EXISTS idx_student_grades_student_id ON student_grades(student_id);
CREATE INDEX IF NOT EXISTS idx_student_grades_subject ON student_grades(subject);
CREATE INDEX IF NOT EXISTS idx_learning_analytics_student_id ON learning_analytics(student_id);
CREATE INDEX IF NOT EXISTS idx_learning_analytics_session_id ON learning_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_learning_analytics_struggle ON learning_analytics(struggle_score DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_chat_sessions_teacher_id ON teacher_chat_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_chat_messages_session_id ON teacher_chat_messages(session_id);
