# ARCHITECT.md - Academio System Architecture

> **Purpose:** Document the high-level architecture, data flow, and system design decisions.
> **Last Updated:** 2026-02-22

---

## System Overview

Academio is an AI-powered tutoring platform with two portals:
1. **Student Portal** - Socratic AI tutor that guides students through learning
2. **Teacher Portal** - Student monitoring, analytics, and AI-assisted material generation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (React + Vite)                          │
│                              http://localhost:5174                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  LoginPage  │  │  Student    │  │  Teacher    │  │  Admin              │ │
│  │             │  │  Dashboard  │  │  Dashboard  │  │  Portal             │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│         │                │                │                   │             │
│         └────────────────┴────────────────┴───────────────────┘             │
│                                    │                                        │
│                          ┌─────────┴─────────┐                              │
│                          │  AuthContext      │                              │
│                          │  TeacherContext   │                              │
│                          │  ChatContext      │                              │
│                          └─────────┬─────────┘                              │
│                                    │                                        │
│                          ┌─────────┴─────────┐                              │
│                          │  API Services     │                              │
│                          │  (REST + SSE)     │                              │
│                          └─────────┬─────────┘                              │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                                     │ HTTP/SSE
                                     │
┌────────────────────────────────────┼────────────────────────────────────────┐
│                        SERVER (Express + TypeScript)                        │
│                           http://localhost:3001                             │
├────────────────────────────────────┼────────────────────────────────────────┤
│                          ┌─────────┴─────────┐                              │
│                          │     Routes        │                              │
│                          │  /api/auth/*      │                              │
│                          │  /api/chat/*      │                              │
│                          │  /api/students/*  │                              │
│                          │  /api/classroom/* │                              │
│                          │  /api/lessons/*   │                              │
│                          │  /api/homework/*  │                              │
│                          └─────────┬─────────┘                              │
│                                    │                                        │
│                          ┌─────────┴─────────┐                              │
│                          │   Controllers     │                              │
│                          └─────────┬─────────┘                              │
│                                    │                                        │
│                          ┌─────────┴─────────┐                              │
│                          │    Services       │                              │
│                          └────┬─────────┬────┘                              │
│                               │         │                                   │
│              ┌────────────────┘         └────────────────┐                  │
│              │                                           │                  │
│    ┌─────────┴─────────┐                    ┌───────────┴───────────┐      │
│    │  SQLite Database  │                    │  Ollama (DeepSeek)    │      │
│    │  server/data/     │                    │  localhost:11434      │      │
│    │  sqlite.db        │                    │                       │      │
│    └───────────────────┘                    └───────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### 1. Authentication Flow (JWT-Based)

> **IMPORTANT:** All authenticated requests must include the JWT token in the Authorization header.
> Pattern: `Authorization: Bearer <token>`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           AUTHENTICATION FLOW                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐     POST /api/auth/login      ┌──────────┐                    │
│  │  Client  │  ─────────────────────────►   │  Server  │                    │
│  │          │  { email, password }          │          │                    │
│  │          │                               │          │                    │
│  │          │  ◄─────────────────────────   │          │                    │
│  │          │  { user, token, redirectTo }  │          │                    │
│  └──────────┘                               └──────────┘                    │
│       │                                          │                          │
│       │  1. Store token: localStorage            │  1. Find user by email   │
│       │     .setItem('academio_token', token)    │  2. bcrypt.compare()     │
│       │  2. AuthContext.setUser(user)            │  3. jwt.sign(payload)    │
│       │  3. Navigate to dashboard                │                          │
│       ▼                                          ▼                          │
│  ┌──────────────────┐                    ┌──────────────────┐               │
│  │ StudentDashboard │                    │ JWT Payload:     │               │
│  │ TeacherDashboard │                    │ { id, email,     │               │
│  │                  │                    │   role, schoolId,│               │
│  │                  │                    │   iat, exp }     │               │
│  └──────────────────┘                    └──────────────────┘               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2. Authenticated Request Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      AUTHENTICATED API REQUEST FLOW                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Client                          Server                                      │
│    │                               │                                         │
│    │  GET /api/homework            │                                         │
│    │  Authorization: Bearer <JWT>  │                                         │
│    │  ─────────────────────────►   │                                         │
│    │                               │                                         │
│    │                    ┌──────────┴──────────┐                              │
│    │                    │  authMiddleware     │                              │
│    │                    │  1. Extract token   │                              │
│    │                    │  2. jwt.verify()    │                              │
│    │                    │  3. req.user = {    │                              │
│    │                    │       id, email,    │                              │
│    │                    │       role, ...}    │                              │
│    │                    └──────────┬──────────┘                              │
│    │                               │                                         │
│    │                    ┌──────────┴──────────┐                              │
│    │                    │  teacherOnly        │                              │
│    │                    │  (role check)       │                              │
│    │                    └──────────┬──────────┘                              │
│    │                               │                                         │
│    │                    ┌──────────┴──────────┐                              │
│    │                    │  Controller         │                              │
│    │                    │  Uses req.user.id   │                              │
│    │                    └──────────┬──────────┘                              │
│    │                               │                                         │
│    │  ◄────────────────────────────│                                         │
│    │  { homework: [...] }          │                                         │
│    │                               │                                         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3. Session Ownership & Chat Persistence

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                   SESSION OWNERSHIP (Chat History Persistence)               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. CREATE SESSION (linked to user)                                          │
│  ─────────────────────────────────────                                       │
│  Client: POST /api/sessions { topic: "math" }                                │
│          Authorization: Bearer <JWT>                                         │
│                                                                              │
│  Server: sessionController.create(req)                                       │
│          → userId = req.user.id        // From JWT                           │
│          → schoolId = req.user.schoolId                                      │
│          → sessionsQueries.create(topic, title, userId, schoolId)            │
│                                                                              │
│  Database: INSERT INTO sessions (user_id, school_id, topic, ...)             │
│                                                                              │
│  2. GET USER'S SESSIONS                                                      │
│  ─────────────────────────────────────                                       │
│  Client: GET /api/sessions                                                   │
│          Authorization: Bearer <JWT>                                         │
│                                                                              │
│  Server: sessionController.getAll(req)                                       │
│          → userId = req.user.id                                              │
│          → sessionsQueries.getByUserId(userId)  // Only user's sessions      │
│                                                                              │
│  3. CHAT WITH SESSION VERIFICATION                                           │
│  ─────────────────────────────────────                                       │
│  Client: GET /api/chat/stream?sessionId=X&message=Y                          │
│          Authorization: Bearer <JWT>                                         │
│                                                                              │
│  Server: chatController.streamChat(req)                                      │
│          → session = sessionsQueries.getById(sessionId)                      │
│          → IF (req.user.id !== session.userId) THROW 403 "Access denied"     │
│          → Use req.user.id for AI personalization context                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2. Student Chat Flow (SSE Streaming)

```
┌──────────┐                              ┌──────────┐                    ┌─────────┐
│  Client  │                              │  Server  │                    │ Ollama  │
│          │                              │          │                    │         │
│  useChat │  GET /api/chat/stream        │  chat.   │                    │DeepSeek │
│  hook    │  ?sessionId=X&message=Y      │controller│                    │  Model  │
│          │  ─────────────────────────►  │          │                    │         │
│          │                              │          │  POST /api/generate│         │
│          │                              │          │  ─────────────────►│         │
│          │                              │          │                    │         │
│          │  ◄─ SSE: data: {"token"}     │          │  ◄─ stream tokens  │         │
│          │  ◄─ SSE: data: {"token"}     │          │  ◄─ stream tokens  │         │
│          │  ◄─ SSE: data: {"done":true} │          │  ◄─ done           │         │
│          │                              │          │                    │         │
└──────────┘                              └──────────┘                    └─────────┘
     │                                          │
     │  Append tokens to message                │  Save complete message
     │  in real-time                            │  to messages table
     ▼                                          ▼
┌──────────────────┐                    ┌──────────────────┐
│ ChatCanvas       │                    │ messages table   │
│ renders stream   │                    │ sessions table   │
└──────────────────┘                    └──────────────────┘
```

### 3. Teacher Dashboard Flow

```
┌──────────────┐                         ┌──────────────┐
│   Teacher    │                         │    Server    │
│   Portal     │                         │              │
│              │  GET /api/students      │              │
│              │  ────────────────────►  │              │
│              │                         │              │
│              │  ◄────────────────────  │              │
│              │  [students with stats]  │              │
│              │                         │              │
│              │  GET /api/students/:id  │              │
│              │  ────────────────────►  │              │
│              │                         │              │
│              │  ◄────────────────────  │              │
│              │  {profile, grades,      │              │
│              │   analytics, sessions}  │              │
└──────────────┘                         └──────────────┘
```

---

## API Contracts

### Authentication Endpoints

| Method | Endpoint | Request Body | Response | Auth Required |
|--------|----------|--------------|----------|---------------|
| POST | `/api/auth/register` | `{email, password, name, role}` | `{user, token, redirectTo}` | No |
| POST | `/api/auth/login` | `{email, password}` | `{user, token, redirectTo}` | No |
| POST | `/api/auth/logout` | - | `{message}` | Yes |
| GET | `/api/auth/me` | - | `{user, profile?}` | Yes |
| PUT | `/api/auth/profile` | `{name?, avatarUrl?}` | `{user}` | Yes |
| PUT | `/api/auth/password` | `{currentPassword, newPassword}` | `{message}` | Yes |
| POST | `/api/auth/verify` | - | `{valid, user}` | Yes |

### Chat Endpoints

| Method | Endpoint | Request/Query | Response | Auth Required |
|--------|----------|---------------|----------|---------------|
| GET | `/api/chat/stream` | `?sessionId&message&topic?` | SSE stream | Yes (Student) |
| GET | `/api/sessions` | - | `[sessions]` | Yes |
| POST | `/api/sessions` | `{topic}` | `{session}` | Yes |
| GET | `/api/sessions/:id` | - | `{session, messages}` | Yes |
| DELETE | `/api/sessions/:id` | - | `{message}` | Yes |

### Student Management Endpoints

| Method | Endpoint | Request/Query | Response | Auth Required |
|--------|----------|---------------|----------|---------------|
| GET | `/api/students` | `?classroomId?` | `[students]` | Yes (Teacher) |
| GET | `/api/students/:id` | - | `{student, profile, grades, analytics}` | Yes (Teacher) |
| GET | `/api/students/:id/grades` | - | `[grades]` | Yes (Teacher) |
| GET | `/api/students/:id/activity` | - | `[analytics]` | Yes (Teacher) |

### Classroom Endpoints

| Method | Endpoint | Request/Query | Response | Auth Required |
|--------|----------|---------------|----------|---------------|
| GET | `/api/classroom` | - | `{stats, recentActivity}` | Yes (Teacher) |
| GET | `/api/classroom/struggling` | - | `[students]` | Yes (Teacher) |

### Lesson Endpoints

| Method | Endpoint | Request Body | Response | Auth Required |
|--------|----------|--------------|----------|---------------|
| GET | `/api/lessons` | - | `[lessons]` | Yes (Teacher) |
| POST | `/api/lessons` | `{title, subject, gradeLevel, content}` | `{lesson}` | Yes (Teacher) |
| GET | `/api/lessons/:id` | - | `{lesson}` | Yes (Teacher) |
| PUT | `/api/lessons/:id` | `{title?, content?, ...}` | `{lesson}` | Yes (Teacher) |
| DELETE | `/api/lessons/:id` | - | `{message}` | Yes (Teacher) |

### Homework Endpoints

| Method | Endpoint | Request Body | Response | Auth Required |
|--------|----------|--------------|----------|---------------|
| GET | `/api/homework` | - | `[homework]` | Yes (Teacher) |
| POST | `/api/homework` | `{title, subject, dueDate, ...}` | `{homework}` | Yes (Teacher) |
| GET | `/api/homework/:id` | - | `{homework}` | Yes |
| PUT | `/api/homework/:id` | `{...updates}` | `{homework}` | Yes (Teacher) |
| DELETE | `/api/homework/:id` | - | `{message}` | Yes (Teacher) |

### Interactive Lesson Chat Endpoints

| Method | Endpoint | Request/Query | Response | Auth Required |
|--------|----------|---------------|----------|---------------|
| GET | `/api/student/lesson-chat/stream` | `?lessonId&message` | SSE stream | Yes (Student) |
| GET | `/api/student/lesson-chat/:lessonId` | - | `{session, messages, lesson}` | Yes (Student) |
| POST | `/api/student/lesson-chat/:lessonId/personalize` | - | `{personalizedContent}` | Yes (Student) |
| GET | `/api/teacher/students/:id/lesson-chats` | - | `[sessions]` | Yes (Teacher) |
| GET | `/api/teacher/lesson-chats/:sessionId` | - | `{session, messages, lesson}` | Yes (Teacher) |

### Homework Submission Endpoints

| Method | Endpoint | Request Body | Response | Auth Required |
|--------|----------|--------------|----------|---------------|
| POST | `/api/student/homework/:id/submit` | `{answers: [{questionId, value}]}` | `{message, submissionId}` | Yes (Student) |
| GET | `/api/student/homework/:id/submission` | - | `{submitted, submission?}` | Yes (Student) |
| GET | `/api/teacher/homework/pending` | - | `[submissions]` | Yes (Teacher) |
| GET | `/api/teacher/homework/:id/submissions` | - | `{submissions, stats}` | Yes (Teacher) |
| PUT | `/api/teacher/homework/submissions/:id/grade` | `{grade, feedback}` | `{message, submission}` | Yes (Teacher) |
| POST | `/api/teacher/homework/submissions/:id/regenerate-ai` | - | `{aiSuggestedGrade, aiSuggestedFeedback}` | Yes (Teacher) |

---

## Interactive Data Flow Diagrams

### 4. Lesson Chat Flow (Student ↔ AI Tutor)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         LESSON CHAT FLOW                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Student opens lesson → LessonChatInterface.tsx                              │
│       │                                                                      │
│       │  GET /api/student/lesson-chat/:lessonId                              │
│       ▼                                                                      │
│  ┌────────────────────────────────────────────────────────────┐              │
│  │  lesson_chat_sessions                                       │              │
│  │  ┌─────────────────────────────────────────────────────┐   │              │
│  │  │ id | personalized_lesson_id | student_id | timestamps│   │              │
│  │  └─────────────────────────────────────────────────────┘   │              │
│  │                    │                                        │              │
│  │                    ▼                                        │              │
│  │  lesson_chat_messages                                       │              │
│  │  ┌─────────────────────────────────────────────────────┐   │              │
│  │  │ id | session_id | role | content | timestamp        │   │              │
│  │  └─────────────────────────────────────────────────────┘   │              │
│  └────────────────────────────────────────────────────────────┘              │
│       │                                                                      │
│       │  Student sends message                                               │
│       │  GET /api/student/lesson-chat/stream?lessonId=X&message=Y            │
│       ▼                                                                      │
│  ┌────────────────────────────────────────────────────────────┐              │
│  │  lessonChat.service.ts                                      │              │
│  │  1. Get/create session                                      │              │
│  │  2. Load lesson content (personalized_lessons)              │              │
│  │  3. Build Socratic system prompt with lesson context        │              │
│  │  4. Include last 10 messages for continuity                 │              │
│  │  5. Stream response from AI                                 │              │
│  │  6. Save messages to DB                                     │              │
│  └────────────────────────────────────────────────────────────┘              │
│       │                                                                      │
│       │  SSE stream: {type: 'token', content: '...'} ...                     │
│       ▼                                                                      │
│  LessonChatInterface renders AI response in real-time                        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5. Homework Submission & Grading Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    HOMEWORK SUBMISSION & GRADING FLOW                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STUDENT FLOW                                                                │
│  ────────────                                                                │
│  1. Student opens homework → HomeworkFormContainer.tsx                       │
│       │                                                                      │
│       │  Parse questions from homework content                               │
│       │  (useHomeworkForm.ts extracts numbered/bulleted items)               │
│       ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐             │
│  │  HomeworkQuestionCard (for each question)                    │             │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │             │
│  │  │ Question 1  │  │ Question 2  │  │ Question 3  │          │             │
│  │  │ [textarea]  │  │ [textarea]  │  │ [textarea]  │          │             │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │             │
│  └─────────────────────────────────────────────────────────────┘             │
│       │                                                                      │
│       │  Submit: POST /api/student/homework/:id/submit                       │
│       │  Body: {answers: [{questionId, value}, ...]}                         │
│       ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐             │
│  │  homework_submissions                                        │             │
│  │  ┌───────────────────────────────────────────────────────┐  │             │
│  │  │ id | personalized_homework_id | student_id | answers  │  │             │
│  │  │ submitted_at | grade | feedback | ai_suggested_*      │  │             │
│  │  └───────────────────────────────────────────────────────┘  │             │
│  └─────────────────────────────────────────────────────────────┘             │
│       │                                                                      │
│       │  Background: AI generates grade suggestion                           │
│       │  (homeworkGrading.service.ts)                                        │
│       ▼                                                                      │
│  ai_suggested_grade: 85, ai_suggested_feedback: "Good work on..."            │
│                                                                              │
│  TEACHER FLOW                                                                │
│  ────────────                                                                │
│  1. Teacher views pending submissions                                        │
│       │  GET /api/teacher/homework/pending                                   │
│       ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐             │
│  │  HomeworkSubmissionsTab.tsx                                  │             │
│  │  Lists: student name, homework title, AI suggested grade     │             │
│  └─────────────────────────────────────────────────────────────┘             │
│       │                                                                      │
│       │  Click "View & Grade"                                                │
│       ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐             │
│  │  HomeworkGradingModal.tsx                                    │             │
│  │  ┌─────────────────────┐  ┌────────────────────────────────┐│             │
│  │  │ Student Answers     │  │ Grading Panel                  ││             │
│  │  │ Q1: [their answer]  │  │ AI Suggested: 85/100           ││             │
│  │  │ Q2: [their answer]  │  │ [Use AI Suggestion]            ││             │
│  │  │ Q3: [their answer]  │  │ Your Grade: [____]             ││             │
│  │  │                     │  │ Feedback: [__________]         ││             │
│  │  │                     │  │ [Submit Grade]                 ││             │
│  │  └─────────────────────┘  └────────────────────────────────┘│             │
│  └─────────────────────────────────────────────────────────────┘             │
│       │                                                                      │
│       │  PUT /api/teacher/homework/submissions/:id/grade                     │
│       │  Body: {grade: 88, feedback: "Excellent understanding..."}           │
│       ▼                                                                      │
│  Student can now see grade + feedback in HomeworkFormContainer               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Hierarchy

### Client-Side

```
App.tsx
├── DynamicBackground.tsx
├── LiquidEdgeFilter.tsx
└── Routes
    ├── LoginPage.tsx
    │   └── GlassCard, GlassButton, GlassInput
    │
    ├── StudentDashboard.tsx
    │   ├── Sidebar.tsx
    │   │   ├── TopicSelector.tsx
    │   │   └── ChatHistory.tsx
    │   ├── ChatCanvas.tsx
    │   │   ├── ChatMessage.tsx
    │   │   └── StreamingIndicator.tsx
    │   ├── ChatInput.tsx
    │   │   └── FileUploadButton.tsx
    │   ├── MyLessons.tsx → LessonChatInterface.tsx (full-screen)
    │   │   └── useLessonChat.ts (SSE streaming hook)
    │   └── MyHomework.tsx → HomeworkFormContainer.tsx (full-screen)
    │       ├── HomeworkQuestionCard.tsx
    │       └── useHomeworkForm.ts (form state hook)
    │
    ├── TeacherDashboard.tsx
    │   ├── TeacherSidebar.tsx
    │   ├── StudentList.tsx
    │   │   └── StudentCard.tsx
    │   ├── StudentProfile.tsx
    │   │   ├── GradeHistory.tsx
    │   │   ├── LearningActivity.tsx
    │   │   └── StudentLessonChats.tsx (view student's lesson chats)
    │   │       └── LessonChatViewer.tsx (read-only chat view)
    │   ├── LessonsPanel.tsx
    │   │   └── LessonCreator.tsx
    │   └── HomeworkPanel.tsx
    │       ├── HomeworkCreator.tsx
    │       ├── HomeworkSubmissionsTab.tsx (pending submissions list)
    │       └── HomeworkGradingModal.tsx (grade with AI suggestions)
    │
    └── AdminPage.tsx
        ├── AdminLogin.tsx
        └── PromptEditor.tsx
```

### Server-Side

```
server/src/
├── index.ts (Express app entry)
├── config/index.ts
├── routes/
│   └── index.ts (route aggregator)
├── controllers/
│   ├── auth.controller.ts
│   ├── chat.controller.ts
│   ├── student.controller.ts
│   ├── classroom.controller.ts
│   ├── lesson.controller.ts
│   ├── homework.controller.ts
│   ├── lessonChat.controller.ts       # NEW: Lesson chat streaming
│   └── homeworkSubmission.controller.ts # NEW: Homework submission & grading
├── services/
│   ├── ollama.service.ts
│   ├── student.service.ts
│   ├── lesson.service.ts
│   ├── homework.service.ts
│   ├── lessonChat.service.ts          # NEW: Socratic AI tutoring within lessons
│   └── homeworkGrading.service.ts     # NEW: AI grading suggestions
├── middleware/
│   ├── auth.middleware.ts
│   └── errorHandler.middleware.ts
└── database/
    ├── db.ts
    ├── schema.sql
    └── queries/
        ├── users.queries.ts
        ├── sessions.queries.ts
        ├── messages.queries.ts
        ├── studentProfiles.queries.ts
        ├── lessons.queries.ts
        ├── homework.queries.ts
        ├── lessonChat.queries.ts       # NEW: Lesson chat sessions & messages
        └── homeworkSubmissions.queries.ts # NEW: Homework submissions
```

---

## Key Design Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| SQLite over PostgreSQL | Simple local development, no external DB needed | Limited concurrent writes, not horizontally scalable |
| SSE over WebSockets | Simpler implementation for unidirectional streaming | No bidirectional real-time communication |
| JWT over Sessions | Stateless auth, easy to scale | Token revocation is complex |
| Ollama/DeepSeek | Local AI, no API costs, privacy | Requires local GPU, slower than cloud APIs |
| Single monorepo | Shared types, simpler deployment | Larger codebase, coupled releases |
| Liquid Glass UI | Modern Apple-inspired design | Higher CSS complexity, may not suit all users |

---

## Security Considerations

### Authentication & Authorization

1. **JWT Tokens**
   - 7-day expiry (`expiresIn: '7d'`)
   - Signed with `JWT_SECRET` from environment
   - Contains: `{ id, email, role, schoolId?, iat, exp }`
   - Stored in `localStorage` on client (key: `academio_token`)

2. **Password Security**
   - bcrypt hashing with 10 salt rounds
   - Minimum 6 character requirement

3. **Role-Based Access Control (RBAC)**
   - Two roles: `STUDENT`, `TEACHER`
   - Middleware enforces at route level:
     - `authMiddleware` - Requires valid JWT
     - `teacherOnly` - Requires `role: 'TEACHER'`
     - `studentOnly` - Requires `role: 'STUDENT'`
     - `optionalAuth` - Attaches user if token present, continues without

### Middleware Application by Route

| Route Pattern | Middleware | Access |
|---------------|------------|--------|
| `/api/auth/*` | None (public) | Everyone |
| `/api/sessions/*` | `authMiddleware` | Any authenticated user |
| `/api/chat/stream` | `optionalAuth` | Any (auth for personalization) |
| `/api/lessons/*` | `authMiddleware` + `teacherOnly` | Teachers only |
| `/api/homework/*` | `authMiddleware` + `teacherOnly` | Teachers only |
| `/api/students/*` | `authMiddleware` + `teacherOnly` | Teachers only |
| `/api/classroom/*` | `authMiddleware` + `teacherOnly` | Teachers only |
| `/api/student-portal/*` | `authMiddleware` + `studentOnly` | Students only |
| `/api/admin/*` | Legacy password auth | Admins only |

### Other Security Measures

4. **Input Validation**: Request validation in controllers before processing
5. **CORS**: Configured for specific client origin only
6. **File Uploads**: Limited to specific file types, size limits applied
7. **Session Ownership**: Users can only access their own sessions/data

---

## On-Demand Lesson Personalization Flow

> **Updated 2026-02-21:** Teacher-side mass personalization replaced with student-triggered on-demand personalization.

### Design Decision

| Old Approach | New Approach |
|-------------|--------------|
| Teacher assigns → AI immediately generates N personalized copies | Teacher assigns → `personalized_lessons` rows created with `masterContent` (instant, no AI) |
| Blocks assignment until all AI calls complete | Assignment is instant regardless of classroom size |
| All students get personalized content even if they never view the lesson | AI personalization runs only when the student explicitly requests it |
| `personalizeForStudentsInClassroom()` called on every `createLesson()` | `distributeToStudents()` called instead — only creates DB rows |

### Lesson Creation Flow (Teacher)

```
Teacher fills form (title, topic, subject, classroom)
       │
       ▼
"Generar con IA" button clicked
       │
       ▼
GET /api/lessons/generate-content/stream?topic=...
       │ SSE stream of tokens
       ▼
Live preview in LessonCreator (generating state)
       │
       ▼
Stream ends → editing state (SmartMarkdown reader + edit toggle)
       │
       ▼
"Asignar a estudiantes" button clicked
       │
       ▼
POST /api/lessons { title, topic, subject, masterContent, classroomId }
       │
       ▼
lessonService.createLesson()
   ├─ INSERT into lessons table (masterContent stored)
   └─ distributeToStudents() [background, non-blocking]
         │
         ▼
         For each student in classroom/teacher:
           INSERT INTO personalized_lessons
             (lesson_id, student_id, personalized_content = masterContent)
           Skip if row already exists
       │
       ▼
Response: { lesson } — immediate (distribution runs in background)
       │
       ▼
LessonCreator transitions to "assigned" state (success banner)
```

### On-Demand Personalization Flow (Student)

```
Student opens lesson → GET /api/student/lesson-chat/:lessonId
       │
       ▼
Response includes lesson.masterContent AND lesson.content (personalizedContent)
       │
       ▼
LessonChatInterface renders masterContent by default
  (displayContent = masterContent if !showPersonalized)
       │
       ▼  [student clicks "Personalizar mi lección"]
       │
       ▼
POST /api/student/lesson-chat/:lessonId/personalize
       │
       ▼
lessonService.personalizeOnDemand(personalizedLessonId, studentId)
   ├─ lessonsQueries.getPersonalizedById(id)  → verify ownership
   ├─ studentProfilesQueries.getById(studentId)  → get context
   ├─ lessonService.personalizeContent(masterContent, studentProfile)
   │     → AI Gatekeeper + Pedagogical Persona
   └─ lessonsQueries.updatePersonalizedContent(id, aiContent)
       │
       ▼
Response: { personalizedContent }
       │
       ▼
useLessonChat hook: setLesson(prev => { ...prev, content: personalizedContent })
setShowPersonalized(true)
       │
       ▼
displayContent switches to personalized version
"Personalizar mi lección" button fades out (AnimatePresence)
"Lección personalizada" badge fades in
```

### Key Components

| Component | Role in Flow |
|-----------|-------------|
| `LessonCreator.tsx` | Teacher: state machine UI for generating + assigning |
| `lesson.service.ts` | `distributeToStudents()` + `personalizeOnDemand()` |
| `lessons.queries.ts` | `getPersonalizedById()` + `updatePersonalizedContent()` |
| `lessonChat.controller.ts` | Includes `masterContent` in `getSession()` response; handles `personalizeLesson` |
| `LessonChatInterface.tsx` | Student: shows masterContent by default; Personalizar button triggers on-demand |
| `useLessonChat.ts` | Hook: `isPersonalizing`, `personalizeLesson()` callback |

### `personalized_lessons` Table as Cache

The `personalized_lessons` table serves a dual role:

1. **Visibility gate**: A row must exist for a student to see a lesson. `distributeToStudents()` creates rows for all eligible students when a lesson is assigned.
2. **AI content cache**: `personalized_content` starts as `masterContent`. After `personalizeOnDemand()` runs, it contains the AI-personalized version. Subsequent calls to `personalizeOnDemand()` always regenerate (no stale cache issue since student controls when to personalize).

---

## Teacher Interface — Detailed Specs

### File Structure

#### Client-Side

```
client/src/
├── components/
│   └── teacher/
│       ├── TeacherSidebar.tsx           # Navigation: Dashboard, Students, AI Assistant
│       ├── StudentList.tsx              # Grid/list of students in classroom
│       ├── StudentCard.tsx              # Student summary card (avatar, name, status)
│       ├── StudentProfile.tsx           # Detailed student view
│       ├── classroom/
│       │   ├── ClassroomOverview.tsx    # Aggregate class stats
│       │   └── SubjectSelector.tsx      # Filter by subject
│       └── assistant/
│           ├── TeacherChat.tsx          # ChatGPT-like interface for teachers
│           ├── TeacherChatInput.tsx     # Input with material type selector
│           ├── TeacherChatMessage.tsx   # Message bubble (supports markdown)
│           └── MaterialPreview.tsx      # Preview generated content
├── pages/
│   └── TeacherPage.tsx                  # Main teacher portal container
├── hooks/
│   ├── useTeacherChat.ts                # SSE streaming for teacher assistant
│   ├── useStudents.ts                   # Fetch/manage student data
│   └── useClassroom.ts                  # Classroom-level data
├── services/
│   └── teacherApi.ts                    # REST calls for teacher endpoints
└── context/
    └── TeacherContext.tsx               # Global teacher state
```

#### Server-Side

```
server/src/
├── controllers/
│   ├── teacher.controller.ts            # Teacher authentication, profile
│   ├── student.controller.ts            # Student CRUD, profiles
│   ├── classroom.controller.ts          # Classroom management
│   └── teacherChat.controller.ts        # AI assistant for teachers
├── services/
│   ├── student.service.ts               # Student data aggregation
│   ├── classroom.service.ts             # Class-level analytics
│   ├── grades.service.ts                # Grade history management
│   ├── learningAnalytics.service.ts     # Track student AI usage patterns
│   └── teacherAssistant.service.ts      # Material generation prompts
├── routes/
│   ├── teacher.routes.ts                # /api/teacher/*
│   ├── student.routes.ts                # /api/students/*
│   └── classroom.routes.ts              # /api/classroom/*
└── database/queries/
    ├── students.queries.ts              # Student data queries
    ├── grades.queries.ts                # Grade history queries
    └── analytics.queries.ts             # Learning analytics queries
```

### Database Schema (Teacher Tables)

```sql
CREATE TABLE teachers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE classrooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    subject TEXT,
    grade_level TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

CREATE TABLE learning_analytics (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    subject TEXT,
    topic TEXT,
    questions_asked INTEGER DEFAULT 0,
    time_spent_seconds INTEGER DEFAULT 0,
    struggle_score REAL DEFAULT 0,  -- 0-1 scale; > 0.7 triggers InterventionAlert
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE teacher_chat_sessions (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    title TEXT,
    material_type TEXT,  -- 'lesson', 'presentation', 'test', 'homework'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);
```

### API Endpoints (Teacher Portal)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/students` | List all students in teacher's classrooms | Teacher |
| GET | `/api/students/:id` | Student profile with grades & analytics | Teacher |
| GET | `/api/students/:id/grades` | Grade history | Teacher |
| GET | `/api/students/:id/activity` | AI copilot usage | Teacher |
| GET | `/api/classroom` | Classroom overview stats | Teacher |
| GET | `/api/classroom/struggling` | Students with high struggle_score | Teacher |
| GET | `/api/teacher/chat/stream` | SSE stream for material generation | Teacher |
| GET | `/api/teacher/students/:id/lesson-chats` | Student's lesson chat sessions | Teacher |
| GET | `/api/teacher/lesson-chats/:sessionId` | View specific lesson chat | Teacher |
| GET | `/api/teacher/homework/pending` | Pending ungraded submissions | Teacher |
| GET | `/api/teacher/homework/:id/submissions` | All submissions for a homework | Teacher |
| PUT | `/api/teacher/homework/submissions/:id/grade` | Grade a submission | Teacher |
| POST | `/api/teacher/homework/submissions/:id/regenerate-ai` | Regenerate AI suggestion | Teacher |

### Routing Structure

| Route | Component | Purpose |
|-------|-----------|---------|
| `/teacher` | `TeacherPage.tsx` | Main teacher dashboard |
| `/teacher/students` | `StudentList.tsx` | View all students |
| `/teacher/students/:id` | `StudentProfile.tsx` | Individual student details |
| `/teacher/assistant` | `TeacherChat.tsx` | AI material generator |
| `/teacher/classroom` | `ClassroomOverview.tsx` | Class-wide analytics |

### Struggle Detection Algorithm

The `struggle_score` (0-1) is calculated from:

```typescript
function calculateStruggleScore(analytics: LearningAnalytics): number {
    // Factors:
    // 1. Number of questions asked on same topic (weight: 0.3)
    // 2. Time spent without progress (weight: 0.2)
    // 3. Repetitive questions (weight: 0.3)
    // 4. Requesting clarification multiple times (weight: 0.2)
    // > 0.7 triggers InterventionAlert.tsx
}
```

---

## Project File Structure

```
academio/
├── CLAUDE.md          # Core behavioral instructions (agent memory)
├── ARCHITECT.md       # Architecture diagrams, API contracts, data flows
├── DESIGN.md          # Liquid Glass design system reference
├── SCHEMA.md          # Database schema definitions
├── JOURNAL.md         # Active development log (last 3 days)
├── HISTORY.md         # Archived journal entries (older than 3 days)
│
├── client/            # React Frontend
│   └── src/
│       ├── components/
│       │   ├── glass/         # GlassCard, GlassButton, GlassInput, SpecularSurface
│       │   ├── teacher/       # Teacher portal components
│       │   ├── student/       # Student portal components
│       │   ├── shared/        # SmartMarkdown (LaTeX renderer)
│       │   ├── effects/       # LiquidEdgeFilter, LiquidBorder
│       │   └── layout/        # DynamicBackground
│       ├── hooks/             # useLessonChat, useHomeworkForm, useSpecularHighlight, ...
│       ├── services/          # authInterceptor, authApi, lessonApi, teacherApi, api
│       ├── context/           # AuthContext, TeacherContext
│       ├── locales/
│       │   └── es-MX.json     # All frontend translations
│       └── styles/
│           └── liquid-glass-tokens.ts
│
├── server/            # Express Backend
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/          # lesson, homework, lessonChat, memory, aiGatekeeper, ...
│   │   ├── routes/
│   │   ├── middleware/        # auth, permissionRegistry, errorHandler
│   │   └── database/
│   │       ├── db.ts          # Init + migrations
│   │       └── queries/       # One file per entity
│   └── data/
│       ├── sqlite.db
│       ├── system-prompt.txt
│       └── teacher-system-prompt.txt
│
└── shared/            # Shared TypeScript Types
    └── types/
        ├── lesson.types.ts    # Lesson, Homework, Chat, Submission types
        ├── school.types.ts    # Multi-tenancy types
        └── auth.types.ts      # JWT payload, User, Role types
```

---

## Pedagogical Data Engineering (Added 2026-02-21)

### Multi-Dimensional Struggle Matrix

**File:** `server/src/services/analytics.service.ts`

Replaces the static struggle_score seed with a live, per-message calculation engine.

| Dimension | Weight | Signal |
|-----------|--------|--------|
| `socraticDepth` | 25% | Ratio of surface (¿Qué es?) vs deep (¿Por qué?, ¿Cómo?) questions — high surface = higher struggle |
| `errorPersistence` | 35% | Repeated confusion markers across consecutive messages — consecutive confusion runs add penalty |
| `frustrationSentiment` | 40% | Frustration keywords in last 3 messages (recency-weighted) + very terse responses |

**Developmental Calibration Multipliers** (applied after composite):

| Persona | Age | Multiplier | Rationale |
|---------|-----|-----------|-----------|
| the-storyteller | 7-9 | 0.70 | Younger students express confusion naturally |
| the-friendly-guide | 10-12 | 0.85 | Moderate normalization |
| the-structured-mentor | 13-15 | 1.00 | Reference baseline |
| the-academic-challenger | 16-18 | 1.10 | Silence masks struggle more at this age |
| the-research-colleague | 19+ | 1.20 | Explicit confusion = significant conceptual gap |

**Integration Point:** `lessonChat.service.ts` → `streamChat()` → after assistant response is saved, calls `analyticsService.calculateAndPersist(sessionId, allMessages, age, grade)` which writes `struggle_dimensions` (JSON) + `struggle_score` (composite) to `learning_analytics`.

**New DB columns:** `learning_analytics.struggle_dimensions TEXT`, `learning_analytics.comprehension_score REAL`, `learning_analytics.exit_ticket_passed INTEGER`

---

### Rubric-Based Grading Logic Map

**File:** `server/src/services/homeworkGrading.service.ts`

```
                   AI Evaluates 3 Dimensions
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    EXACTITUD (40%)  RAZONAMIENTO (40%) ESFUERZO (20%)
    Correctness of   Steps/process     Depth of answers,
    final answers    shown             all problems tried
          │               │               │
          └───────────────┼───────────────┘
                          ▼
               Weighted Grade = A*0.40 + R*0.40 + E*0.20
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
       rubric_scores JSON          ai_suggested_grade
    stored in homework_submissions   (weighted average)
```

**New DB column:** `homework_submissions.rubric_scores TEXT` (JSON: `{accuracy, reasoning, effort}`)

**Teacher Portal:** `HomeworkGradingModal.tsx` shows 3 progress bars (Exactitud/Razonamiento/Esfuerzo) when `rubricScores` is present in the submission.

---

### Exit Ticket System (Comprehension Verification)

**Files:** `server/src/services/exitTicket.service.ts`, `server/src/controllers/exitTicket.controller.ts`

Before a student can mark a lesson complete, the system generates 2-3 comprehension questions.

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/student/lessons/:lessonId/exit-ticket` | Generate 2-3 questions from lesson content |
| POST | `/api/student/lessons/:lessonId/exit-ticket/submit` | Evaluate answers; mark lesson viewed if passed |

**Flow:**
```
Student requests exit ticket
    → exitTicketService.generateQuestions(lessonContent, topic, age, grade)
    → AI generates 2-3 open-ended questions grounded in lesson content
    → Frontend displays questions with text inputs

Student submits answers
    → exitTicketService.evaluateAnswers(questions, answers, lessonContent, sessionId, age, grade)
    → AI evaluates: questionsCorrect, comprehensionScore (0-1), passed (>= 0.60), feedback
    → analyticsQueries.updateComprehensionScore(sessionId, score, passed)
    → if passed: lessonsQueries.markAsViewed(lessonId)
    → Returns ExitTicketResult to client
```

**Graceful Degradation:** If AI evaluation fails, auto-passes with `comprehensionScore: 0.5`.

**Translations:** `student.lessonChat.exitTicket.*` in `es-MX.json`

---

## Environment Dependencies

| Service | Default URL | Purpose |
|---------|-------------|---------|
| Vite Dev Server | http://localhost:5174 | Frontend development |
| Express Server | http://localhost:3001 | Backend API |
| Ollama | http://localhost:11434 | AI model inference |
| SQLite | server/data/sqlite.db | Data persistence |

---

## Pedagogical Data Engineering

> Added 2026-02-21. Implemented in `analytics.service.ts`, `homeworkGrading.service.ts`, `exitTicket.service.ts`.

### Multi-Dimensional Struggle Matrix

The struggle system produces four metrics per lesson-chat session. All values are floats in `[0, 1]`.

#### Dimension Formulas

**socraticDepth** — ratio of surface questions to all signaled questions:
```
surfaceQ = count of user messages matching SURFACE_QUESTION_MARKERS
deepQ    = count of user messages matching DEEP_QUESTION_MARKERS
totalSignaled = surfaceQ + deepQ

socraticDepth = 0                           if totalSignaled == 0
              = min(1, surfaceQ / totalSignaled)  otherwise
```

**errorPersistence** — repeated confusion across messages:
```
confusionCount = count of user messages matching CONFUSION_MARKERS
consecutiveRuns = count of consecutive confusion-message pairs
rawRate    = confusionCount / len(userMessages)
runPenalty = min(0.30, consecutiveRuns × 0.10)

errorPersistence = min(1, rawRate + runPenalty)
```

**frustrationSentiment** — recency-weighted resignation signals in last 3 messages:
```
For each of the last 3 user messages (index i):
  if matches FRUSTRATION_MARKERS  → signal += 1.0
  elif len(content) < 15 chars AND i >= (len - 2) → signal += 0.3

frustrationSentiment = min(1, totalSignal / 3)
```

**composite** — weighted combination with developmental calibration:
```
rawComposite = socraticDepth × 0.25
             + errorPersistence × 0.35
             + frustrationSentiment × 0.40

composite = min(1, max(0, rawComposite × developmentalMultiplier))
```

#### Developmental Calibration Multipliers

| Persona | Age | Grade | Multiplier | Rationale |
|---------|-----|-------|-----------|-----------|
| El Narrador (Storyteller) | 7-9 | 1º-3º Primaria | **0.70×** | High baseline confusion expression in young children |
| El Guía Amigable | 10-12 | 4º-6º Primaria | **0.85×** | Moderate normalization |
| El Mentor Estructurado | 13-15 | Secundaria | **1.00×** | Reference point |
| El Retador Académico | 16-18 | Preparatoria | **1.20×** | Silence often masks struggle; any expressed confusion is a strong signal |
| El Colega Investigador | 19+ | Universidad | **1.20×** | Explicit confusion = serious gap at university level |

#### Verified Example (Test 1)
```
Student: age=17, grade=preparatoria1 → the-academic-challenger → multiplier=1.20×
Messages: 3 × "¿Qué es...?" (surface questions)

socraticDepth    = 3 / (3 + 0) = 1.000
errorPersistence = 0.000
frustrationSentiment = 0.000
rawComposite     = 1.0×0.25 + 0×0.35 + 0×0.40 = 0.250
composite        = min(1, 0.250 × 1.20) = 0.300
```

---

### Rubric-Based Grading System

#### Formula
```
finalGrade = round(clamp(accuracy × 0.40 + reasoning × 0.40 + effort × 0.20, 0, 100))
```

| Dimension | Weight | Definition |
|-----------|--------|------------|
| **Exactitud** (accuracy) | 40% | Factual correctness of final answers |
| **Razonamiento** (reasoning) | 40% | Process/steps shown; logical justification |
| **Esfuerzo** (effort) | 20% | Depth of engagement; all problems attempted |

#### Verified Example (Test 2)
```
accuracy  = 85  →  85 × 0.40 = 34
reasoning = 20  →  20 × 0.40 =  8   ← low despite correct answers
effort    = 70  →  70 × 0.20 = 14
finalGrade = round(34 + 8 + 14) = 56
```

**Key insight:** A student who gets all answers right but shows no work scores 56, not 100. Razonamiento has equal weight to Exactitud to reward the learning *process*, not just the outcome.

#### Storage
`rubric_scores` column in `homework_submissions` stores JSON: `{ "accuracy": 85, "reasoning": 20, "effort": 70 }`.

---

### Exit Ticket System

**Purpose:** Verify comprehension before a student marks a lesson "complete".

**Pass threshold:** `comprehensionScore >= 0.60`

#### Flow
```
POST /api/student/lessons/:lessonId/exit-ticket
  → exitTicketService.generateQuestions(lessonContent, topic, age, grade)
  → Returns 2-3 open comprehension questions (JSON array)

POST /api/student/lessons/:lessonId/exit-ticket/submit
  body: { questions[], answers[] }
  → exitTicketService.evaluateAnswers(...)
  → AI evaluates: { questionsCorrect, comprehensionScore, passed, feedback }
  → analyticsQueries.updateComprehensionScore(sessionId, score, passed)
  → if passed: lessonsQueries.markAsViewed(lessonId)
  → Returns ExitTicketResult to client
```

**Graceful Degradation:** If AI evaluation fails → auto-passes with `comprehensionScore: 0.5`.

#### Verified Example (Test 3)
```
PASS: comprehensionScore = 0.75 ≥ 0.60 → markAsViewed() called → viewed_at = "2026-02-22 ..."
FAIL: comprehensionScore = 0.40 < 0.60 → markAsViewed() NOT called → viewed_at = NULL
```

#### New DB Columns (migrations in `db.ts`)
| Table | Column | Type | Purpose |
|-------|--------|------|---------|
| `homework_submissions` | `rubric_scores` | TEXT | JSON rubric dimension scores |
| `learning_analytics` | `struggle_dimensions` | TEXT | JSON StruggleDimensions object |
| `learning_analytics` | `comprehension_score` | REAL | Exit ticket score (0-1) |
| `learning_analytics` | `exit_ticket_passed` | INTEGER | 1 = passed, 0 = failed |

---

## Frontend SSE Architecture — `useAIPipe` Pattern (Added 2026-02-25)

### Overview

All real-time AI chat in the client goes through a single shared hook:
`client/src/hooks/useAIPipe.ts`

It centralizes the SSE reader loop, AbortController lifecycle, and JWT auth injection,
eliminating ~200 lines of duplicated code that previously existed across 4 hooks.

### Hook API

```typescript
export interface SSEEvent {
  type: 'start' | 'token' | 'done' | 'error';
  content?: string;
  sessionId?: string;
  userMessageId?: string;
  assistantMessageId?: string;
  error?: string;
}

interface UseAIPipeOptions {
  onStart?: (event: SSEEvent) => void;
  onDone?: (event: SSEEvent, fullText: string) => void;
  onError?: (message: string) => void;
  clearResponseOnDone?: boolean; // true = clear currentResponse in finally (lesson/homework chat)
}

interface UseAIPipeReturn {
  isStreaming: boolean;
  currentResponse: string;       // Accumulates token-by-token during stream
  error: string | null;
  pipe: (url: string) => Promise<void>; // Starts streaming; cancels any prior stream
  cancel: () => void;
}
```

### Internal Mechanics

```
useAIPipe() call
│
├── onStartRef.current = onStart  ← Sync ref update each render (no useEffect needed)
├── onDoneRef.current  = onDone   ← Callbacks always current; pipe() stays stable
├── onErrorRef.current = onError
│
└── pipe(url) → authenticatedFetch(url, { signal })
       │
       ├── SSE reader loop:
       │     'start'  → capture userMessageId + assistantMessageId into local vars
       │             → call onStart(event)
       │     'token'  → accumulate fullResponseText; setCurrentResponse()
       │     'done'   → enrich event with captured IDs; call onDone(enrichedEvent, fullText)
       │     'error'  → setError(); call onError()
       │
       └── finally: setIsStreaming(false)
                    if clearResponseOnDone → setCurrentResponse('')
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Callback refs (not useMemo) | `pipe()` is stable even as callers pass new inline functions each render |
| `authenticatedFetch` internally | JWT auto-injected for all `/api/*` calls; no manual token handling |
| `clearResponseOnDone` flag | Lesson/homework hooks maintain message arrays — clear after done; general chat keeps visible |
| `capturedAssistantMessageId` | Server `done` event doesn't always echo IDs; captured from `start` and forwarded |
| `cancel()` called at start of `pipe()` | Prevents double-streams if caller fires `sendMessage` twice rapidly |

### SSE Event Chain → DB Linkage

```
Server (lessonChat.service.ts)
  yield { type: 'start', sessionId, userMessageId, assistantMessageId }
         │
         ▼
  Client: useAIPipe captures assistantMessageId into capturedAssistantMessageId
         │
         ▼
  yield { type: 'token', content }  ×N
         │
         ▼
  [Server] analyticsService.calculateAndPersist(session.id, messages, age, grade, rowContext)
         │   rowContext present → lessonChatQueries.updateStruggleDimensions()
         │   → UPDATE lesson_chat_sessions SET struggle_score=?, struggle_dimensions=? WHERE id=?
         │
         │   rowContext absent → analyticsQueries.updateStruggleDimensions()
         │   → UPDATE learning_analytics SET struggle_dimensions=? WHERE session_id=?
         │
         ▼
  yield { type: 'done' }
         │
         ▼
  Client: useAIPipe enriches done event with capturedAssistantMessageId
          calls onDone(enrichedEvent, fullText)
          → callers build LessonChatMessage { id: assistantMessageId, ... }
          → setMessages([...prev, assistantMessage])
```

### Analytics Storage: lesson_chat_sessions vs learning_analytics

`learning_analytics.session_id` has `FOREIGN KEY REFERENCES sessions(id) ON DELETE CASCADE`.
`lesson_chat_sessions.id` values don't exist in `sessions` — INSERTing them throws `SQLITE_CONSTRAINT_FOREIGNKEY`.

**Resolution (2026-02-25):** Struggle data for lesson chat sessions is stored directly on `lesson_chat_sessions`:

| Column | Type | Description |
|--------|------|-------------|
| `struggle_score` | `REAL DEFAULT 0` | Composite struggle score (0–1) |
| `struggle_dimensions` | `TEXT` | JSON: `{socraticDepth, errorPersistence, frustrationSentiment, composite}` |

`analyticsService.calculateAndPersist(sessionId, messages, age, grade, rowContext)`:
- **`rowContext` present** → `lessonChatQueries.updateStruggleDimensions()` (lesson chat path)
- **`rowContext` absent** → `analyticsQueries.updateStruggleDimensions()` (legacy regular chat path)

Teacher intervention alerts (`getStudentsNeedingIntervention`) UNION both tables so alerts surface from either chat type.

### Consumer Hooks

| Hook | `clearResponseOnDone` | Extra State | Purpose |
|------|-----------------------|-------------|---------|
| `useChat` | `false` | — | General student chat |
| `useTeacherChat` | `false` | — | Teacher AI assistant |
| `useLessonChat` | `true` | `session`, `messages`, `lesson`, `isPersonalizing` | Lesson Socratic chat |
| `useHomeworkChat` | `true` | `session`, `messages`, `homework`, `questions` | Homework Sidekick |

### Rule for New Hooks

> **Any new hook that streams from an AI SSE endpoint MUST use `useAIPipe`.**
> Never re-implement the SSE reader loop. Add a consumer hook that wraps `useAIPipe`
> with domain-specific callbacks and state.
