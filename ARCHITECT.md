# ARCHITECT.md - Academio System Architecture

> **Purpose:** Document the high-level architecture, data flow, and system design decisions.
> **Last Updated:** 2026-02-08

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

## Environment Dependencies

| Service | Default URL | Purpose |
|---------|-------------|---------|
| Vite Dev Server | http://localhost:5174 | Frontend development |
| Express Server | http://localhost:3001 | Backend API |
| Ollama | http://localhost:11434 | AI model inference |
| SQLite | server/data/sqlite.db | Data persistence |
