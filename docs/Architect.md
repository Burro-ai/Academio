# Architecture Documentation

> **Purpose:** This file documents the system architecture, design patterns, and component relationships for the Academio AI Tutoring Platform.

---

## System Overview

Academio is a personalized AI tutoring platform with:
- **Student Portal**: AI tutor chat, personalized lessons, homework
- **Teacher Portal**: Student management, content creation, analytics
- **Multi-School Support**: Isolated data per school organization

```
┌────────────────────────────────────────────────────────────────────┐
│                         ACADEMIO PLATFORM                          │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────┐           ┌─────────────────┐                 │
│  │  Student Portal │           │ Teacher Portal  │                 │
│  │  (React + Vite) │           │  (React + Vite) │                 │
│  └────────┬────────┘           └────────┬────────┘                 │
│           │                             │                          │
│           └──────────┬──────────────────┘                          │
│                      ▼                                             │
│  ┌───────────────────────────────────────────────────┐             │
│  │              Express Backend (TypeScript)          │             │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │             │
│  │  │ Controllers  │  │   Services   │  │  Routes  │ │             │
│  │  └──────────────┘  └──────────────┘  └──────────┘ │             │
│  └───────────────────────┬───────────────────────────┘             │
│                          │                                         │
│         ┌────────────────┼────────────────┐                        │
│         ▼                ▼                ▼                        │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐                  │
│  │   SQLite   │   │  DeepSeek  │   │   Ollama   │                  │
│  │  Database  │   │  Cloud API │   │  (Fallback)│                  │
│  └────────────┘   └────────────┘   └────────────┘                  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18 + TypeScript + Vite | Single-page application |
| **Styling** | Tailwind CSS + Liquid Glass Design | Apple-inspired UI |
| **Animation** | Motion (Framer Motion) | Smooth transitions |
| **Backend** | Node.js + Express + TypeScript | REST API server |
| **Database** | SQLite (better-sqlite3) | Local persistence |
| **AI Primary** | DeepSeek Cloud API | Fast AI responses |
| **AI Fallback** | Ollama (local) | Offline capability |
| **Streaming** | Server-Sent Events (SSE) | Real-time AI output |
| **Auth** | JWT + bcrypt | Secure authentication |

---

## Application Layers

### 1. Presentation Layer (Client)

```
client/src/
├── components/
│   ├── chat/           # AI tutor chat interface
│   ├── teacher/        # Teacher portal components
│   ├── glass/          # Liquid Glass design system
│   ├── sidebar/        # Navigation components
│   └── effects/        # Visual effects (SVG filters)
├── pages/
│   ├── StudentDashboard.tsx
│   ├── TeacherDashboard.tsx
│   └── LoginPage.tsx
├── context/
│   ├── AuthContext.tsx    # Auth state
│   └── ChatContext.tsx    # Chat session state
├── hooks/
│   ├── useChat.ts         # SSE streaming
│   └── useSessions.ts     # Session management
└── services/
    ├── api.ts             # REST client
    ├── authApi.ts         # Auth endpoints
    ├── lessonApi.ts       # Lesson/homework endpoints
    └── teacherApi.ts      # Teacher endpoints
```

### 2. API Layer (Server Routes)

```
server/src/routes/
├── auth.routes.ts       # /api/auth/*
├── chat.routes.ts       # /api/chat/*
├── session.routes.ts    # /api/sessions/*
├── lesson.routes.ts     # /api/lessons/*
├── homework.routes.ts   # /api/homework/*
├── classroom.routes.ts  # /api/classroom/*
├── teacher.routes.ts    # /api/teacher/*
├── student.routes.ts    # /api/students/*
└── upload.routes.ts     # /api/upload/*
```

### 3. Business Logic Layer (Services)

```
server/src/services/
├── ollama.service.ts          # AI provider abstraction
├── lesson.service.ts          # Lesson creation & personalization
├── homework.service.ts        # Homework creation & personalization
├── classroom.service.ts       # Classroom management
├── pdf.service.ts             # PDF parsing
├── image.service.ts           # Image processing
└── prompt.service.ts          # System prompt management
```

### 4. Data Access Layer (Queries)

```
server/src/database/queries/
├── users.queries.ts
├── studentProfiles.queries.ts
├── teachers.queries.ts
├── classrooms.queries.ts
├── lessons.queries.ts
├── homework.queries.ts
├── grades.queries.ts
├── sessions.queries.ts
├── messages.queries.ts
└── analytics.queries.ts
```

---

## Key Design Patterns

### 1. Service Layer Pattern
Business logic is encapsulated in service classes, keeping controllers thin.

```typescript
// Controller (thin)
async createLesson(req: Request, res: Response) {
  const lesson = await lessonService.createLesson(req.user.id, req.body);
  res.json(lesson);
}

// Service (thick)
class LessonService {
  async createLesson(teacherId: string, data: CreateLessonRequest): Promise<Lesson> {
    // AI content generation
    // Database insertion
    // Personalization for students
  }
}
```

### 2. Repository Pattern (Queries)
Database operations are isolated in query modules.

```typescript
// queries/lessons.queries.ts
export const lessonsQueries = {
  getById(id: string): Lesson | null { ... },
  getByTeacherId(teacherId: string): Lesson[] { ... },
  getByClassroomId(classroomId: string): Lesson[] { ... },
  create(data: CreateLessonData): Lesson { ... },
  update(id: string, data: UpdateLessonData): Lesson | null { ... },
  delete(id: string): boolean { ... },
};
```

### 3. Provider Abstraction
AI providers are abstracted behind a common interface.

```typescript
class AIService {
  private provider: 'deepseek' | 'ollama';

  async *streamChat(messages: Message[]): AsyncGenerator<string> {
    if (this.provider === 'deepseek') {
      yield* this.streamDeepSeek(messages);
    } else {
      yield* this.streamOllama(messages);
    }
  }
}
```

### 4. JWT Authentication Middleware
Requests are authenticated via middleware chain.

```typescript
// Public route
router.get('/health', chatController.health);

// Protected route
router.get('/sessions', authMiddleware, sessionController.getAll);

// Teacher-only route
router.post('/lessons', authMiddleware, teacherOnly, lessonController.create);
```

---

## Data Flow Diagrams

### Student Chat Flow

```
┌─────────┐     ┌─────────────┐     ┌────────────┐     ┌──────────┐
│ Student │────>│ ChatCanvas  │────>│ useChat.ts │────>│ /api/chat│
│  Types  │     │ Component   │     │   Hook     │     │  /stream │
└─────────┘     └─────────────┘     └────────────┘     └────┬─────┘
                                                            │
                                                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend Processing                          │
├─────────────────────────────────────────────────────────────────┤
│ 1. Validate JWT token                                           │
│ 2. Load session messages from SQLite                            │
│ 3. Load student profile for personalization                     │
│ 4. Build system prompt (Socratic + student context)             │
│ 5. Stream request to DeepSeek/Ollama                            │
│ 6. Parse and forward SSE chunks to client                       │
│ 7. Save assistant message to database                           │
└─────────────────────────────────────────────────────────────────┘
```

### Lesson Personalization Flow

```
┌───────────┐     ┌───────────────┐     ┌─────────────────────────┐
│  Teacher  │────>│ LessonCreator │────>│ POST /api/lessons       │
│  Creates  │     │   Component   │     │ { classroomId: "abc" }  │
└───────────┘     └───────────────┘     └───────────┬─────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Personalization Pipeline                       │
├─────────────────────────────────────────────────────────────────┤
│ 1. Create master lesson record                                  │
│ 2. Query student_profiles WHERE classroom_id = "abc"            │
│ 3. For each student (parallel):                                 │
│    a. Build personalization prompt with student interests       │
│    b. Call DeepSeek for personalized version                    │
│    c. Store in personalized_lessons table                       │
│ 4. Return lesson with personalization count                     │
└─────────────────────────────────────────────────────────────────┘
```

### Classroom Targeting Logic

```typescript
// When classroomId is provided:
if (classroomId) {
  // Only personalize for students in this classroom
  const allProfiles = studentProfilesQueries.getAllWithUserDetails();
  profiles = allProfiles.filter(p => p.classroomId === classroomId);
} else {
  // Personalize for ALL students
  profiles = studentProfilesQueries.getAllWithUserDetails();
}
```

---

## Authentication Architecture

### JWT Token Flow

```
┌────────────────────────────────────────────────────────────────┐
│                       JWT Authentication                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. Login Request                                              │
│     POST /api/auth/login { email, password }                   │
│                                                                │
│  2. Server validates credentials                               │
│     bcrypt.compare(password, user.passwordHash)                │
│                                                                │
│  3. Server generates JWT                                       │
│     jwt.sign({ id, email, role }, secret, { expiresIn: '7d' }) │
│                                                                │
│  4. Client stores token                                        │
│     localStorage.setItem('academio_token', token)              │
│                                                                │
│  5. Subsequent requests include token                          │
│     Authorization: Bearer <token>                              │
│                                                                │
│  6. Middleware validates and attaches user                     │
│     req.user = { id, email, role }                             │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Role-Based Access Control

| Role | Access |
|------|--------|
| STUDENT | Chat, view lessons/homework, profile |
| TEACHER | Students, classrooms, lessons, homework, AI assistant |
| ADMIN | All + school management |

---

## Multi-School Architecture

### Data Isolation

Each school has isolated data through `school_id` foreign keys:

```sql
-- All queries filter by school
SELECT * FROM lessons WHERE school_id = ?;
SELECT * FROM students WHERE school_id = ?;
```

### School Membership

Users can belong to multiple schools with different roles:

```typescript
interface SchoolMembership {
  userId: string;
  schoolId: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  isPrimary: boolean;
  permissions: string; // JSON
}
```

---

## API Endpoint Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | User login |
| POST | /api/auth/register | User registration |
| GET | /api/auth/me | Current user |

### Chat (Student)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/chat/stream | SSE chat streaming |
| GET | /api/chat/health | AI provider status |

### Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/sessions | List sessions |
| POST | /api/sessions | Create session |
| GET | /api/sessions/:id | Get session with messages |

### Lessons
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/lessons | List teacher's lessons |
| POST | /api/lessons | Create lesson |
| GET | /api/lessons/:id | Get lesson |
| PUT | /api/lessons/:id | Update lesson |
| DELETE | /api/lessons/:id | Delete lesson |
| POST | /api/lessons/:id/personalize | Personalize for students |
| GET | /api/lessons/generate-content/stream | SSE content generation |

### Homework
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/homework | List teacher's homework |
| POST | /api/homework | Create homework |
| GET | /api/homework/:id | Get homework |
| PUT | /api/homework/:id | Update homework |
| DELETE | /api/homework/:id | Delete homework |
| POST | /api/homework/:id/personalize | Personalize for students |
| GET | /api/homework/generate-content/stream | SSE content generation |

### Classrooms
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/classroom | List classrooms with stats |
| POST | /api/classroom | Create classroom |
| PUT | /api/classroom/:id | Update classroom |
| DELETE | /api/classroom/:id | Delete classroom |
| GET | /api/classroom/struggling | Get struggling students |

### Students
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/students | List students |
| GET | /api/students/:id | Get student details |
| PATCH | /api/students/:id | Update student |
| GET | /api/students/:id/grades | Get student grades |
| POST | /api/students/:id/grades | Add grade |

---

## Error Handling

### AppError Class
Custom error class for consistent error responses.

```typescript
throw new AppError('Not authenticated', 401);
throw new AppError('Classroom not found', 404);
throw new AppError('Invalid credentials', 403);
```

### Error Middleware
Catches all errors and formats response.

```typescript
// Response format
{
  "status": "error",
  "message": "Not authenticated",
  "statusCode": 401
}
```

---

## Future Considerations

1. **Caching**: Add Redis for session/query caching
2. **Rate Limiting**: Implement per-user API rate limits
3. **WebSockets**: Consider for real-time collaboration
4. **Microservices**: Split AI service for scalability
5. **Analytics**: Add usage tracking and reporting
