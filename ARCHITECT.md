# ARCHITECT.md - Academio System Architecture

> **Purpose:** Document the high-level architecture, data flow, and system design decisions.
> **Last Updated:** 2026-02-07

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

### 1. Authentication Flow

```
┌──────────┐     POST /api/auth/login      ┌──────────┐
│  Client  │  ─────────────────────────►   │  Server  │
│          │  { email, password }          │          │
│          │                               │          │
│          │  ◄─────────────────────────   │          │
│          │  { user, token, redirectTo }  │          │
└──────────┘                               └──────────┘
     │                                          │
     │  Store token in localStorage             │  Verify with bcrypt
     │  Set AuthContext                         │  Generate JWT
     │  Navigate to dashboard                   │
     ▼                                          ▼
┌──────────────────┐                    ┌──────────────────┐
│ /dashboard/      │                    │ users table      │
│ student|teacher  │                    │ (id, email,      │
│                  │                    │  passwordHash,   │
│                  │                    │  role, name)     │
└──────────────────┘                    └──────────────────┘
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
    │   └── ChatInput.tsx
    │       └── FileUploadButton.tsx
    │
    ├── TeacherDashboard.tsx
    │   ├── TeacherSidebar.tsx
    │   ├── StudentList.tsx
    │   │   └── StudentCard.tsx
    │   ├── StudentProfile.tsx
    │   │   ├── GradeHistory.tsx
    │   │   └── LearningActivity.tsx
    │   ├── LessonsPanel.tsx
    │   │   └── LessonCreator.tsx
    │   └── HomeworkPanel.tsx
    │       └── HomeworkCreator.tsx
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
│   └── homework.controller.ts
├── services/
│   ├── ollama.service.ts
│   ├── student.service.ts
│   ├── lesson.service.ts
│   └── homework.service.ts
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
        └── homework.queries.ts
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

1. **Authentication**: JWT tokens with 7-day expiry, bcrypt password hashing
2. **Authorization**: Role-based access (STUDENT, TEACHER) enforced via middleware
3. **Input Validation**: Request validation in controllers before processing
4. **CORS**: Configured for specific client origin only
5. **File Uploads**: Limited to specific file types, size limits applied

---

## Environment Dependencies

| Service | Default URL | Purpose |
|---------|-------------|---------|
| Vite Dev Server | http://localhost:5174 | Frontend development |
| Express Server | http://localhost:3001 | Backend API |
| Ollama | http://localhost:11434 | AI model inference |
| SQLite | server/data/sqlite.db | Data persistence |
