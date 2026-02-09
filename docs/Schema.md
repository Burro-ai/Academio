# Database Schema Documentation

> **Purpose:** This file documents the SQLite database schema for the Academio platform.
> **Location:** `server/data/sqlite.db`

---

## Entity Relationship Overview

```
┌─────────────┐     ┌─────────────────────┐     ┌─────────────┐
│   schools   │────<│  school_memberships │>────│    users    │
└─────────────┘     └─────────────────────┘     └─────────────┘
       │                                               │
       │                                               │
       ▼                                               ▼
┌─────────────┐                               ┌─────────────────┐
│ classrooms  │>──────────────────────────────│ student_profiles│
└─────────────┘                               └─────────────────┘
       │                                               │
       │                                               │
       ▼                                               ▼
┌─────────────┐                               ┌─────────────────┐
│   lessons   │                               │  student_grades │
│  homework   │                               │learning_analytics│
└─────────────┘                               └─────────────────┘
```

---

## Core Tables

### schools
Multi-tenant support for different schools/organizations.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| name | TEXT NOT NULL | School name |
| domain | TEXT | School email domain |
| settings | TEXT | JSON settings |
| subscription_tier | TEXT | 'free', 'basic', 'premium' |
| max_students | INTEGER | Student limit |
| max_teachers | INTEGER | Teacher limit |
| is_active | INTEGER | 1 = active |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

### users
Unified user table for all roles (students, teachers, admins).

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| email | TEXT UNIQUE NOT NULL | Email address |
| password_hash | TEXT NOT NULL | bcrypt hash |
| role | TEXT NOT NULL | 'STUDENT', 'TEACHER', 'ADMIN' |
| name | TEXT | Display name |
| school_id | TEXT | FK to schools.id |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

### school_memberships
Links users to schools (supports multi-school membership).

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| user_id | TEXT NOT NULL | FK to users.id |
| school_id | TEXT NOT NULL | FK to schools.id |
| role | TEXT NOT NULL | Role within this school |
| is_primary | INTEGER | 1 = primary school |
| permissions | TEXT | JSON permissions |
| joined_at | DATETIME | Join timestamp |

---

## Classroom & Student Tables

### classrooms
Groups students by class/subject for targeted content delivery.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| teacher_id | TEXT NOT NULL | FK to users.id (teacher) |
| name | TEXT NOT NULL | Classroom name |
| subject | TEXT | Subject area |
| grade_level | TEXT | Grade level |
| school_id | TEXT | FK to schools.id |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

### student_profiles
Extended profile data for students (personalization info).

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| user_id | TEXT NOT NULL | FK to users.id |
| age | INTEGER | Student age |
| favorite_sports | TEXT | JSON array of interests |
| skills_to_improve | TEXT | JSON array of skills |
| learning_system_prompt | TEXT | Custom learning preferences |
| grade_level | TEXT | Current grade |
| classroom_id | TEXT | FK to classrooms.id |
| teacher_id | TEXT | FK to users.id (selected teacher) |
| school_id | TEXT | FK to schools.id |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

### student_grades
Academic performance tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| student_id | TEXT NOT NULL | Legacy FK to students.id |
| user_id | TEXT | FK to users.id |
| subject | TEXT NOT NULL | Subject area |
| assignment_type | TEXT | 'homework', 'quiz', 'test', 'project' |
| assignment_name | TEXT | Assignment name |
| grade | REAL NOT NULL | Points earned |
| max_grade | REAL NOT NULL | Maximum points |
| graded_at | DATETIME | Grading timestamp |

---

## Content Tables

### lessons
Teacher-created lessons with optional classroom targeting.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| teacher_id | TEXT NOT NULL | FK to users.id |
| title | TEXT NOT NULL | Lesson title |
| topic | TEXT NOT NULL | Lesson topic |
| subject | TEXT | Subject area |
| master_content | TEXT | Original content (personalized per student) |
| school_id | TEXT | FK to schools.id |
| **classroom_id** | TEXT | FK to classrooms.id (null = all students) |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

**Index:** `idx_lessons_classroom_id` on `classroom_id`

### homework_assignments
Homework with optional classroom targeting.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| teacher_id | TEXT NOT NULL | FK to users.id |
| title | TEXT NOT NULL | Assignment title |
| topic | TEXT NOT NULL | Assignment topic |
| subject | TEXT | Subject area |
| master_content | TEXT | Original content |
| due_date | TEXT | Due date (ISO format) |
| school_id | TEXT | FK to schools.id |
| **classroom_id** | TEXT | FK to classrooms.id (null = all students) |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

**Index:** `idx_homework_assignments_classroom_id` on `classroom_id`

### personalized_lessons
Student-specific versions of lessons.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| lesson_id | TEXT NOT NULL | FK to lessons.id |
| student_id | TEXT NOT NULL | FK to student_profiles.id |
| personalized_content | TEXT | AI-personalized content |
| created_at | DATETIME | Creation timestamp |

### personalized_homework
Student-specific versions of homework.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| homework_id | TEXT NOT NULL | FK to homework_assignments.id |
| student_id | TEXT NOT NULL | FK to student_profiles.id |
| personalized_content | TEXT | AI-personalized content |
| created_at | DATETIME | Creation timestamp |

---

## Chat & Analytics Tables

### sessions
AI chat sessions for students.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| topic | TEXT NOT NULL | Session topic (math, science, etc.) |
| title | TEXT | Session title |
| student_id | TEXT | Legacy FK |
| user_id | TEXT | FK to users.id |
| school_id | TEXT | FK to schools.id |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

### messages
Chat messages within sessions.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| session_id | TEXT NOT NULL | FK to sessions.id |
| role | TEXT NOT NULL | 'user' or 'assistant' |
| content | TEXT NOT NULL | Message text |
| created_at | DATETIME | Creation timestamp |

### learning_analytics
Tracks student learning patterns for intervention detection.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| student_id | TEXT NOT NULL | Legacy FK |
| user_id | TEXT | FK to users.id |
| session_id | TEXT NOT NULL | FK to sessions.id |
| subject | TEXT | Subject area |
| topic | TEXT | Specific topic |
| questions_asked | INTEGER | Question count |
| time_spent_seconds | INTEGER | Time in session |
| struggle_score | REAL | 0-1 scale (higher = struggling) |
| resolved | INTEGER | 1 = resolved |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

---

## Teacher Chat Tables

### teacher_chat_sessions
AI assistant sessions for teachers.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| teacher_id | TEXT | Legacy FK |
| user_id | TEXT | FK to users.id |
| title | TEXT | Session title |
| material_type | TEXT | 'lesson', 'presentation', 'test', 'homework' |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

### teacher_chat_messages
Messages in teacher AI sessions.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| session_id | TEXT NOT NULL | FK to teacher_chat_sessions.id |
| role | TEXT NOT NULL | 'user' or 'assistant' |
| content | TEXT NOT NULL | Message text |
| created_at | DATETIME | Creation timestamp |

---

## Legacy Tables (Backwards Compatibility)

### teachers
Legacy teacher table (data mirrored to users table).

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| name | TEXT NOT NULL | Teacher name |
| email | TEXT UNIQUE NOT NULL | Email |
| password_hash | TEXT NOT NULL | bcrypt hash |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

### students
Legacy student table (data mirrored to users + student_profiles).

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| classroom_id | TEXT | FK to classrooms.id |
| name | TEXT NOT NULL | Student name |
| email | TEXT | Email |
| grade_level | TEXT | Grade level |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

---

## Migrations

### addClassroomColumns (2026-02-09)
Adds `classroom_id` to lessons and homework tables for existing databases.

```sql
ALTER TABLE lessons ADD COLUMN classroom_id TEXT
  REFERENCES classrooms(id) ON DELETE SET NULL;
CREATE INDEX idx_lessons_classroom_id ON lessons(classroom_id);

ALTER TABLE homework_assignments ADD COLUMN classroom_id TEXT
  REFERENCES classrooms(id) ON DELETE SET NULL;
CREATE INDEX idx_homework_assignments_classroom_id ON homework_assignments(classroom_id);
```

### migrateToMultiSchool (2026-02-08)
Migrates single-school data to multi-school architecture:
1. Creates default school
2. Updates all tables with `school_id`
3. Creates school memberships for all users
