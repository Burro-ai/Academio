# SCHEMA.md - Academio Database Schema

> **Purpose:** Document all database tables, relationships, and constraints.
> **Last Updated:** 2026-02-07
> **Database:** SQLite (server/data/sqlite.db)
> **Schema Version:** v2.0 (Multi-school architecture)

---

## Entity Relationship Diagram

```
┌─────────────────┐
│     schools     │
├─────────────────┤
│ id (PK)         │
│ name            │
│ domain          │
│ settings        │◄───────────────────────────────────────┐
│ subscription    │                                        │
│ max_students    │                                        │
│ max_teachers    │                                        │
│ is_active       │                                        │
│ created_at      │                                        │
└─────────────────┘                                        │
        │                                                  │
        │ 1:N                                              │
        ▼                                                  │
┌─────────────────────┐                                    │
│ school_memberships  │                                    │
├─────────────────────┤                                    │
│ id (PK)             │                                    │
│ user_id (FK)        │────────────────────────┐           │
│ school_id (FK)      │                        │           │
│ role                │                        │           │
│ is_primary          │                        │           │
│ permissions         │                        │           │
│ joined_at           │                        │           │
└─────────────────────┘                        │           │
                                               │           │
┌─────────────────┐                            │           │
│     users       │◄───────────────────────────┘           │
├─────────────────┤                                        │
│ id (PK)         │                                        │
│ email           │                                        │
│ password_hash   │                                        │
│ role            │                                        │
│ name            │                                        │
│ avatar_url      │                                        │
│ school_id (FK)  │────────────────────────────────────────┘
│ created_at      │
│ updated_at      │
└─────────────────┘
        │
        │ 1:1
        ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│student_profiles │       │   classrooms    │       │    sessions     │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │       │ id (PK)         │
│ user_id (FK)    │──┐    │ name            │       │ topic           │
│ age             │  │    │ teacher_id (FK) │◄──────│ title           │
│ favorite_sports │  │    │ subject         │       │ user_id (FK)    │
│ skills_to_impr. │  │    │ grade_level     │       │ school_id (FK)  │
│ grade_history   │  │    │ school_id (FK)  │       │ created_at      │
│ learning_prompt │  │    │ created_at      │       │ updated_at      │
│ grade_level     │  │    └─────────────────┘       └─────────────────┘
│ classroom_id(FK)│──┼──────────┘                          │
│ teacher_id (FK) │  │                                     │
│ school_id (FK)  │  │                                     │
│ created_at      │  │                                     ▼
│ updated_at      │  │                            ┌─────────────────┐
└─────────────────┘  │                            │    messages     │
                     │                            ├─────────────────┤
                     │                            │ id (PK)         │
                     ▼                            │ session_id (FK) │
┌─────────────────┐  │                            │ role            │
│ student_grades  │  │                            │ content         │
├─────────────────┤  │                            │ timestamp       │
│ id (PK)         │  │                            │ attachments     │
│ student_id (FK) │◄─┤                            └─────────────────┘
│ user_id (FK)    │  │
│ subject         │  │
│ grade           │  │
│ max_grade       │  │
│ assignment_name │  │
│ assignment_type │  │
│ graded_at       │  │
└─────────────────┘  │
                     │
┌─────────────────┐  │
│learning_analytics│ │
├─────────────────┤  │
│ id (PK)         │  │
│ student_id (FK) │◄─┤
│ user_id (FK)    │  │
│ session_id (FK) │  │
│ subject         │  │
│ topic           │  │
│ questions_asked │  │
│ time_spent_secs │  │
│ struggle_score  │  │
│ resolved        │  │
│ created_at      │  │
│ updated_at      │  │
└─────────────────┘  │
                     │
┌─────────────────────────┐     ┌─────────────────────────┐
│ teacher_chat_sessions   │     │ teacher_chat_messages   │
├─────────────────────────┤     ├─────────────────────────┤
│ id (PK)                 │◄────│ id (PK)                 │
│ teacher_id (FK)         │◄─┘  │ session_id (FK)         │
│ user_id (FK)            │     │ role                    │
│ title                   │     │ content                 │
│ material_type           │     │ timestamp               │
│ created_at              │     └─────────────────────────┘
│ updated_at              │
└─────────────────────────┘
```

---

## Multi-School Architecture

### Overview

The database now supports multi-tenancy via the `schools` table. Key features:

1. **School-scoped data**: All user data is associated with a school
2. **Multi-school membership**: Teachers can belong to multiple schools
3. **Role-based access**: Users have roles within each school membership
4. **Subscription tiers**: Schools have configurable limits

### schools

Top-level entity for multi-tenancy.

```sql
CREATE TABLE schools (
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
```

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID v4 primary key |
| name | TEXT | School display name |
| domain | TEXT | For SSO/email domain matching |
| settings | TEXT | JSON config object |
| subscription_tier | TEXT | 'free', 'basic', 'premium', 'enterprise' |
| max_students | INTEGER | Student limit for subscription |
| max_teachers | INTEGER | Teacher limit for subscription |
| is_active | INTEGER | 0=inactive, 1=active |

### school_memberships

Junction table for user-school relationships with role.

```sql
CREATE TABLE school_memberships (
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
```

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID v4 primary key |
| user_id | TEXT | FK to users |
| school_id | TEXT | FK to schools |
| role | TEXT | 'STUDENT', 'TEACHER', or 'ADMIN' |
| is_primary | INTEGER | 1 if this is user's primary school |
| permissions | TEXT | JSON object with granular permissions |
| joined_at | TEXT | When user joined this school |

---

## Core Tables

### users

Core user authentication table for both students and teachers.

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('STUDENT', 'TEACHER')),
    name TEXT NOT NULL,
    avatar_url TEXT,
    school_id TEXT,                 -- Primary school
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX idx_users_email_school ON users(email, school_id);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| email | TEXT | NOT NULL | User's email address |
| password_hash | TEXT | NOT NULL | bcrypt hashed password |
| role | TEXT | NOT NULL, CHECK | 'STUDENT' or 'TEACHER' |
| name | TEXT | NOT NULL | Display name |
| avatar_url | TEXT | - | Profile picture URL |
| school_id | TEXT | FK | Primary school (nullable for migration) |
| created_at | TEXT | DEFAULT NOW | Account creation time |
| updated_at | TEXT | DEFAULT NOW | Last profile update |

**Note:** Email uniqueness is per-school (same email can exist in different schools).

---

### student_profiles

Extended profile data for student users with personalization.

```sql
CREATE TABLE student_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    age INTEGER,
    favorite_sports TEXT,        -- JSON array
    skills_to_improve TEXT,      -- JSON array
    grade_history TEXT,          -- JSON object
    learning_system_prompt TEXT, -- Personal AI customization
    grade_level TEXT,
    classroom_id TEXT,
    teacher_id TEXT,             -- Selected teacher
    school_id TEXT,              -- School scope
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE SET NULL,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID v4 primary key |
| user_id | TEXT | FK to users (unique) |
| age | INTEGER | Student's age |
| favorite_sports | TEXT | JSON array of interests |
| skills_to_improve | TEXT | JSON array of skills |
| grade_history | TEXT | JSON object with grades by subject |
| learning_system_prompt | TEXT | Custom AI prompt for this student |
| grade_level | TEXT | e.g., "6th Grade" |
| classroom_id | TEXT | FK to classrooms |
| teacher_id | TEXT | FK to users (teacher) |
| school_id | TEXT | FK to schools |

---

### sessions

Chat sessions for student-AI conversations.

```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL DEFAULT 'general',
    title TEXT NOT NULL,
    student_id TEXT,               -- Legacy FK
    user_id TEXT,                  -- New FK to users
    school_id TEXT,                -- School scope
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID v4 primary key |
| topic | TEXT | Subject area (math, science, etc.) |
| title | TEXT | Session title |
| student_id | TEXT | Legacy FK (deprecated) |
| user_id | TEXT | FK to users table |
| school_id | TEXT | FK to schools |

**Note:** Both `student_id` and `user_id` exist for migration. Use `user_id` for new code.

---

### student_grades

Grade history for students with assignment tracking.

```sql
CREATE TABLE student_grades (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,      -- Legacy FK
    user_id TEXT,                  -- New FK to users
    subject TEXT NOT NULL,
    grade REAL NOT NULL,
    max_grade REAL NOT NULL DEFAULT 100,
    assignment_name TEXT,
    assignment_type TEXT CHECK (assignment_type IN ('homework', 'test', 'quiz', 'project', 'participation')),
    graded_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

### learning_analytics

Tracks student AI usage patterns for struggle detection.

```sql
CREATE TABLE learning_analytics (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,      -- Legacy FK
    user_id TEXT,                  -- New FK to users
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
```

**Struggle Score:** 0-1 scale. Values > 0.7 trigger intervention alerts.

---

### classrooms

Classroom groupings for students.

```sql
CREATE TABLE classrooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    subject TEXT,
    grade_level TEXT,
    school_id TEXT,                -- School scope
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);
```

---

### teacher_chat_sessions

Chat sessions for teacher AI assistant (material generation).

```sql
CREATE TABLE teacher_chat_sessions (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,      -- Legacy FK
    user_id TEXT,                  -- New FK to users
    title TEXT,
    material_type TEXT CHECK (material_type IN ('lesson', 'presentation', 'test', 'homework', 'general')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## Legacy Tables

### students (Legacy - Deprecated)

> **Status:** Being phased out. Use `users` + `student_profiles` instead.

```sql
CREATE TABLE students (
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
```

### teachers (Legacy - Deprecated)

> **Status:** Being phased out. Use `users` with `role='TEACHER'` instead.

```sql
CREATE TABLE teachers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## Indexes

```sql
-- Schools & Memberships
CREATE INDEX idx_schools_domain ON schools(domain);
CREATE INDEX idx_school_memberships_user_id ON school_memberships(user_id);
CREATE INDEX idx_school_memberships_school_id ON school_memberships(school_id);
CREATE INDEX idx_school_memberships_school_role ON school_memberships(school_id, role);

-- Users
CREATE UNIQUE INDEX idx_users_email_school ON users(email, school_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_school_id ON users(school_id);
CREATE INDEX idx_users_school_role ON users(school_id, role);

-- Sessions
CREATE INDEX idx_sessions_updated_at ON sessions(updated_at DESC);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_school_id ON sessions(school_id);

-- Classrooms
CREATE INDEX idx_classrooms_teacher_id ON classrooms(teacher_id);
CREATE INDEX idx_classrooms_school_id ON classrooms(school_id);

-- Student Profiles
CREATE INDEX idx_student_profiles_user_id ON student_profiles(user_id);
CREATE INDEX idx_student_profiles_classroom_id ON student_profiles(classroom_id);
CREATE INDEX idx_student_profiles_teacher_id ON student_profiles(teacher_id);
CREATE INDEX idx_student_profiles_school_id ON student_profiles(school_id);

-- Grades & Analytics
CREATE INDEX idx_student_grades_user_id ON student_grades(user_id);
CREATE INDEX idx_learning_analytics_user_id ON learning_analytics(user_id);
CREATE INDEX idx_learning_analytics_struggle ON learning_analytics(struggle_score DESC);

-- Teacher Chat
CREATE INDEX idx_teacher_chat_sessions_user_id ON teacher_chat_sessions(user_id);
```

---

## Migration Notes

### Completed Migrations

1. **v2.0: Multi-school architecture** (2026-02-07)
   - Added `schools` and `school_memberships` tables
   - Added `school_id` to: users, classrooms, student_profiles, sessions, lessons, homework_assignments
   - Added `user_id` shadow columns to: sessions, student_grades, learning_analytics, teacher_chat_sessions
   - Created migration function in `db.ts` to backfill existing data

### Legacy Compatibility

During migration, both `student_id`/`teacher_id` (legacy) and `user_id` (new) columns exist:
- Query files check both columns with fallback: `WHERE user_id = ? OR (user_id IS NULL AND student_id = ?)`
- New records populate both columns for backward compatibility
- Legacy tables (`students`, `teachers`) still exist but are deprecated

### Future Work

1. **Archive legacy tables**: Rename `students` → `_archived_students`, `teachers` → `_archived_teachers`
2. **Remove shadow columns**: After verification period, remove legacy FK columns
3. **Add classroom_enrollments**: Many-to-many student-classroom relationships

---

## Backup & Recovery

Database file location: `server/data/sqlite.db`

```bash
# Backup
cp server/data/sqlite.db server/data/sqlite.db.backup

# Reset (will re-seed and run migrations on next server start)
rm server/data/sqlite.db
npm run dev:server

# Verify migration
# The server logs should show:
# - "Created default school: <uuid>"
# - "Updated X users with school_id"
# - "Created school memberships for X users"
```
