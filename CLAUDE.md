# CLAUDE.md - Academio Project Context

> **Purpose:** This file serves as persistent memory for AI agents working on this codebase.
> It documents critical architectural decisions and behavioral requirements that must never be forgotten.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS |
| **Backend** | Node.js + Express + TypeScript |
| **AI Engine** | DeepSeek Cloud API (or Ollama for offline use) |
| **Database** | SQLite (local file: `server/data/sqlite.db`) |
| **File Processing** | `pdf-parse` (PDFs), `sharp` (images) |
| **Streaming** | Server-Sent Events (SSE) for real-time AI responses |
| **Animation** | Motion (formerly Framer Motion) for transitions |
| **Design System** | Apple Liquid Glass (2026) - glassmorphism with specular highlights |
| **Authentication** | JWT (JSON Web Tokens) with bcrypt password hashing |

---

## AI Provider Configuration

> **Updated 2026-02-08:** Switched from Ollama (local) to DeepSeek Cloud API for faster response times.

### Provider Options

| Provider | Speed | Use Case | Configuration |
|----------|-------|----------|---------------|
| **DeepSeek Cloud** | Fast (2-5 sec) | Production, normal use | `AI_PROVIDER=deepseek` |
| **Ollama** | Slow (30-60 sec) | Offline, development | `AI_PROVIDER=ollama` |

### Environment Variables

```bash
# In .env file:

# Choose provider: 'deepseek' or 'ollama'
AI_PROVIDER=deepseek

# DeepSeek Cloud API
DEEPSEEK_API_KEY=sk-your-api-key
DEEPSEEK_API_URL=https://api.deepseek.com/v1
AI_MODEL_NAME=deepseek-chat          # or 'deepseek-reasoner' for R1

# Ollama (local fallback)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:1.5b
```

### Key Files

| File | Purpose |
|------|---------|
| `server/src/services/ollama.service.ts` | Unified AI service (supports both providers) |
| `server/src/config/index.ts` | Configuration with provider selection |
| `.env` | Environment variables with API keys |

### How It Works

1. On server start, `AIService` checks `AI_PROVIDER` env variable
2. If `deepseek`: Uses DeepSeek Cloud API (OpenAI-compatible format)
3. If `ollama`: Uses local Ollama instance
4. If DeepSeek key is missing, automatically falls back to Ollama

### Debugging AI Issues

```bash
# Check health of current AI provider
curl http://localhost:3001/api/chat/health

# Response shows provider and status:
# { "ok": true, "provider": "deepseek" }
```

---

## Customization Loop (Lesson/Homework Personalization)

> **Updated 2026-02-08:** Optimized with streaming, concurrency, and intelligent prompting.

### Model Strategy

| Use Case | Model | Rationale |
|----------|-------|-----------|
| Master Content Generation | `deepseek-reasoner` | Higher reasoning quality for educational content |
| Student Personalization | `deepseek-chat` | Faster, cheaper for per-student customization |

### Streaming Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/lessons/generate-content/stream` | SSE stream for lesson content |
| `GET /api/homework/generate-content/stream` | SSE stream for homework content |

### Progress Tracking Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/lessons/:id/progress` | Check personalization status |
| `GET /api/homework/:id/progress` | Check personalization status |

### Concurrency

Personalization uses `Promise.all()` to process all students in parallel:

```typescript
// Before: Sequential (slow)
for (const profile of profiles) {
  await this.personalizeContent(masterContent, profile);  // 2-5 sec each
}

// After: Parallel (fast)
const promises = profiles.map(async (profile) => {
  await this.personalizeContent(masterContent, profile);
});
await Promise.all(promises);  // All run simultaneously
```

### Socratic Personalization Prompts

The personalization adds student-specific content without rewriting the entire lesson:

**For Lessons:**
1. **One Analogy**: Relates content to student's interests
2. **One Reflection Question**: Socratic question connecting concept to their life

**For Homework:**
1. **Interest-Based Problem**: Reframes one problem using their interests
2. **Think Deeper Question**: Socratic question about the underlying concept

### Key Files

| File | Purpose |
|------|---------|
| `server/src/services/lesson.service.ts` | Lesson generation & personalization |
| `server/src/services/homework.service.ts` | Homework generation & personalization |
| `client/src/services/lessonApi.ts` | Client-side streaming methods |
| `client/src/components/teacher/LessonCreator.tsx` | Streaming UI for lessons |
| `client/src/components/teacher/HomeworkCreator.tsx` | Streaming UI for homework |

---

## Interactive Lesson Chat & Homework Forms

> **Added 2026-02-09:** Transformed static lesson/homework views into high-interactivity components with AI tutoring and structured data collection.

### Overview

The interactive layer adds two major features:

1. **Lesson Chat Interface**: Students can chat with an AI tutor within the context of each lesson. The AI uses Socratic methodology, referencing the lesson content to guide discovery.

2. **Homework Form System**: Homework is presented as structured question cards. Students submit answers, which are stored for teacher review with AI-generated grading suggestions.

### Database Schema

Three new tables support these features:

```sql
-- Lesson chat sessions (one per student per lesson)
CREATE TABLE lesson_chat_sessions (
    id TEXT PRIMARY KEY,
    personalized_lesson_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(personalized_lesson_id, student_id)
);

-- Lesson chat messages
CREATE TABLE lesson_chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL
);

-- Homework submissions with structured answers + grading
CREATE TABLE homework_submissions (
    id TEXT PRIMARY KEY,
    personalized_homework_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    answers TEXT NOT NULL,  -- JSON array of {questionId, value}
    submitted_at TEXT NOT NULL,
    grade REAL,
    feedback TEXT,
    ai_suggested_grade REAL,
    ai_suggested_feedback TEXT,
    graded_by TEXT,
    graded_at TEXT
);
```

### API Endpoints

#### Student Portal (Lesson Chat)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/student/lesson-chat/stream` | SSE streaming for lesson chat |
| GET | `/api/student/lesson-chat/:lessonId` | Get session + messages |

#### Student Portal (Homework Submission)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/student/homework/:id/submit` | Submit homework with answers JSON |
| GET | `/api/student/homework/:id/submission` | Get existing submission status |

#### Teacher Portal (Grading)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/teacher/homework/pending` | Get ungraded submissions |
| GET | `/api/teacher/homework/:id/submissions` | Get all submissions for a homework |
| PUT | `/api/teacher/homework/submissions/:id/grade` | Grade a submission |
| POST | `/api/teacher/homework/submissions/:id/regenerate-ai` | Regenerate AI suggestion |

#### Teacher Portal (Lesson Chat Oversight)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/teacher/students/:id/lesson-chats` | Get student's lesson chat sessions |
| GET | `/api/teacher/lesson-chats/:sessionId` | View a specific lesson chat |

### Key Components

| Component | Purpose |
|-----------|---------|
| `client/src/components/student/LessonChatInterface.tsx` | Full-screen lesson chat view |
| `client/src/components/student/HomeworkFormContainer.tsx` | Full-screen homework form |
| `client/src/components/student/HomeworkQuestionCard.tsx` | Individual question card |
| `client/src/components/teacher/HomeworkSubmissionsTab.tsx` | Pending submissions list |
| `client/src/components/teacher/HomeworkGradingModal.tsx` | Grading modal with AI suggestions |
| `client/src/components/teacher/StudentLessonChats.tsx` | Student's lesson chat history |
| `client/src/components/teacher/LessonChatViewer.tsx` | Read-only chat viewer |

### Key Hooks

| Hook | Purpose |
|------|---------|
| `useLessonChat.ts` | SSE streaming for lesson chat (follows useChat.ts pattern) |
| `useHomeworkForm.ts` | Form state management with question parsing |

### Lesson Chat System Prompt

The lesson chat AI uses a specialized system prompt that:
- Includes the full lesson content as context
- Enforces Socratic methodology (no direct answers)
- Incorporates student profile for personalization
- References specific parts of the lesson in responses

See `server/src/services/lessonChat.service.ts` for implementation.

### Homework Question Parsing

Questions are extracted from homework content using regex patterns:
- Numbered patterns: `1.`, `1)`, `Question 1:`
- Bulleted patterns: `•`, `-`, `*`
- Fallback: Split by double newlines

See `client/src/hooks/useHomeworkForm.ts` for implementation.

---

## RAG Long-Term Memory System

> **Added 2026-02-16:** Persistent student memory using ChromaDB vector database with Retrieval Augmented Generation (RAG).

### Overview

The RAG system provides persistent conversational memory at the student level, allowing the AI tutor to remember past interactions and maintain context across sessions.

### Architecture

| Component | Technology |
|-----------|------------|
| **Vector Database** | ChromaDB |
| **Embeddings** | Ollama `qwen3-embedding` model |
| **Storage** | Isolated collections per student (`student_memory_{student_id}`) |
| **Synchronization** | SQLite ↔ ChromaDB auto-sync on startup |

### RAG Pipeline Flow

```
Student asks question
       ↓
┌─────────────────────────────────────────┐
│ 1. RETRIEVE: memoryService.retrieve()  │
│    Query ChromaDB for similar Q&As     │
│    Top 3 memories injected into prompt │
└─────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────┐
│ 2. GENERATE: AI responds with context  │
│    System prompt includes:             │
│    - Lesson content                    │
│    - Student profile                   │
│    - Retrieved memories (RAG)          │
└─────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────┐
│ 3. STORE: memoryService.store()        │
│    Q&A pair → ChromaDB collection      │
│    Embedded via qwen3-embedding        │
└─────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `server/src/services/memory.service.ts` | ChromaDB client, RAG pipeline |
| `server/src/services/lessonChat.service.ts` | Integration point (retrieval + storage) |
| `server/src/database/queries/studentProfiles.queries.ts` | Hooks for collection lifecycle |
| `server/src/database/db.ts` | Startup sync verification |
| `server/src/utils/resetMemory.ts` | Memory reset utility |
| `server/src/utils/create-test-students.ts` | Test data injection |

### Environment Variables

```bash
# ChromaDB (Long-Term Memory / RAG)
CHROMA_HOST=localhost
CHROMA_PORT=8000
```

### Lifecycle Hooks

- **Profile Create** → `memoryService.initializeStudentMemory(userId)`
- **Profile Delete** → `memoryService.deleteStudentMemory(userId)`
- **Server Start** → `verifySynchronization()` + auto-cleanup orphaned collections

### Graceful Degradation

If ChromaDB is not available:
- `memoryService.isAvailable()` returns `false`
- Memory features are silently skipped
- Core functionality continues without RAG

### NPM Scripts

```bash
# Create test students with chat history
npm run create:test-students

# Full RAG test (requires ChromaDB)
npm run test:rag

# Memory management
npm run memory:verify    # Check sync status
npm run memory:reset     # Reset all memories
```

---

## Authentication & JWT System

> **CRITICAL:** This section documents how authentication works across all workflows. Many bugs have been caused by missing JWT tokens in API requests. Always verify auth is properly wired.

### Overview

Academio uses JWT-based authentication with role-based access control (RBAC).

| Component | Purpose |
|-----------|---------|
| `server/src/middleware/auth.middleware.ts` | JWT verification and role checking |
| `server/src/controllers/auth.controller.ts` | Login, register, token generation |
| `client/src/services/authApi.ts` | Token storage and authenticated requests |
| `client/src/context/AuthContext.tsx` | Global auth state management |

### JWT Token Structure

```typescript
interface JwtPayload {
  id: string;       // User UUID
  email: string;    // User email
  role: UserRole;   // 'STUDENT' | 'TEACHER'
  schoolId?: string; // Optional school context
  iat?: number;     // Issued at timestamp
  exp?: number;     // Expiration timestamp
}
```

- **Token Expiry:** 7 days
- **Secret:** Configured via `JWT_SECRET` env variable
- **Storage:** Client stores token in `localStorage` with key `academio_token`

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LOGIN FLOW                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. User enters credentials on LoginPage                                    │
│     │                                                                       │
│     ▼                                                                       │
│  2. authApi.login({ email, password })                                      │
│     │                                                                       │
│     ▼                                                                       │
│  3. POST /api/auth/login                                                    │
│     │                                                                       │
│     ▼                                                                       │
│  4. Server: bcrypt.compare(password, user.passwordHash)                     │
│     │                                                                       │
│     ▼                                                                       │
│  5. Server: jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn: '7d' })  │
│     │                                                                       │
│     ▼                                                                       │
│  6. Response: { user, token, redirectTo }                                   │
│     │                                                                       │
│     ▼                                                                       │
│  7. authApi.setToken(token) → localStorage.setItem('academio_token', token) │
│     │                                                                       │
│     ▼                                                                       │
│  8. AuthContext.setUser(user)                                               │
│     │                                                                       │
│     ▼                                                                       │
│  9. Navigate to /dashboard/student or /dashboard/teacher                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Middleware Types

| Middleware | Usage | Behavior |
|------------|-------|----------|
| `authMiddleware` | Required auth | Returns 401 if no valid token |
| `optionalAuth` | Optional auth | Attaches user if token present, continues if not |
| `teacherOnly` | Teacher routes | Returns 403 if user.role !== 'TEACHER' |
| `studentOnly` | Student routes | Returns 403 if user.role !== 'STUDENT' |

### Route Protection by Panel

#### Student Portal Routes
```typescript
// Session management - REQUIRES auth
router.get('/sessions', authMiddleware, sessionController.getAll);
router.post('/sessions', authMiddleware, sessionController.create);

// Chat streaming - OPTIONAL auth (for personalization)
router.get('/chat/stream', optionalAuth, chatController.streamChat);

// Student-specific content
router.get('/student-portal/lessons', authMiddleware, studentOnly, ...);
router.get('/student-portal/homework', authMiddleware, studentOnly, ...);
```

#### Teacher Portal Routes
```typescript
// All teacher routes require auth + teacher role
router.use('/lessons', authMiddleware, teacherOnly);
router.use('/homework', authMiddleware, teacherOnly);
router.use('/students', authMiddleware, teacherOnly);
router.use('/classroom', authMiddleware, teacherOnly);
```

### Frontend API Services - Token Inclusion

**CRITICAL:** All authenticated API calls MUST include the JWT token in the Authorization header.

#### Pattern for REST API calls (api.ts, lessonApi.ts, teacherApi.ts):
```typescript
private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = authApi.getToken();  // Get from localStorage

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;  // MUST include this
  }

  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  // ... handle response
}
```

#### Pattern for SSE Streaming (useChat.ts):
```typescript
const sendMessage = async (message: string) => {
  const headers: Record<string, string> = {};
  const token = authApi.getToken();

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;  // Required for session ownership
  }

  const response = await fetch(`/api/chat/stream?${params}`, {
    method: 'GET',
    headers,  // Include auth headers
    signal: abortController.signal,
  });
  // ... handle SSE stream
};
```

### Common Auth Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "Access denied" on create | Missing token in request | Verify `authApi.getToken()` is called and included in headers |
| "Not authenticated" | Token expired or invalid | Check token expiry, re-login if needed |
| User data not persisting | Session not linked to user | Ensure routes use `authMiddleware` and pass `req.user.id` |
| Chat history not showing | Sessions created without userId | Session controller must pass `userId` to `sessionsQueries.create()` |
| Profile appears blank | Auth context not loaded | Wait for `AuthContext.isLoading` to be false |

### Verifying Auth is Working

```bash
# 1. Login and get token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.johnson@academio.edu","password":"password123"}'

# Response: {"user":{...},"token":"eyJhbG...","redirectTo":"/dashboard/teacher"}

# 2. Use token in authenticated request
curl http://localhost:3001/api/homework \
  -H "Authorization: Bearer eyJhbG..."

# Should return homework list, not "Access denied"
```

### Key Files for Auth Debugging

| File | What to Check |
|------|---------------|
| `server/src/middleware/auth.middleware.ts` | JWT verification logic |
| `server/src/controllers/auth.controller.ts` | Token generation, login logic |
| `client/src/services/authApi.ts` | Token storage/retrieval |
| `client/src/context/AuthContext.tsx` | React auth state |
| `client/src/services/api.ts` | REST API token inclusion |
| `client/src/services/lessonApi.ts` | Lesson/Homework API token inclusion |
| `client/src/hooks/useChat.ts` | SSE streaming token inclusion |

---

## Liquid Glass Design System

> **Added:** Apple-inspired Liquid Glass UI with glassmorphism, dynamic backgrounds, and motion animations.
> **Status:** Implemented across all components.

### Design Philosophy

The UI uses Apple's 2026 Liquid Glass design language featuring:
- **Translucent glass panels** with backdrop blur effects
- **Dynamic gradient mesh background** with animated floating orbs
- **100/70/40/20 opacity rule** for text hierarchy
- **Cursor-following specular highlights** on interactive elements
- **Morphing transitions** between states using Motion library

### Key Files

| File | Purpose |
|------|---------|
| `client/src/styles/liquid-glass-tokens.ts` | Design tokens (opacity, blur, tints, shadows) |
| `client/src/components/layout/DynamicBackground.tsx` | Animated gradient mesh background |
| `client/src/components/effects/LiquidEdgeFilter.tsx` | SVG filters for liquid edge effects |
| `client/src/components/glass/*.tsx` | Reusable glass components |
| `client/src/hooks/useSpecularHighlight.ts` | Cursor-following light effect hook |

### Glass Component Library

```
client/src/components/glass/
├── GlassCard.tsx        # Container with variants: panel, card, surface, elevated
├── GlassButton.tsx      # Button with specular highlight effect
├── GlassInput.tsx       # Form inputs with glass styling
├── SpecularSurface.tsx  # Wrapper for cursor-following light
└── index.ts             # Barrel exports
```

### CSS Utility Classes

These classes are defined in `client/src/index.css`:

| Class | Usage |
|-------|-------|
| `.glass-panel` | Sidebars, large containers (xl blur, 20% white bg) |
| `.glass-card` | Content cards, modals (lg blur, 25% white bg, rounded-2xl) |
| `.glass-surface` | Subtle glass (md blur, 15% white bg, rounded-xl) |
| `.glass-btn` | Default glass button |
| `.glass-btn-primary` | Primary action button (primary color tint) |
| `.glass-message-user` | User chat bubbles (primary tint) |
| `.glass-message-ai` | AI chat bubbles (white tint) |
| `.glass-stat-card` | Dashboard stat cards with hover effect |

### Text Opacity Classes (100/70/40/20 Rule)

| Class | Opacity | Usage |
|-------|---------|-------|
| `.text-solid` | 100% | Critical text, logos, primary CTAs |
| `.text-prominent` | 70% | Supporting text, nav tabs |
| `.text-subtle` | 40% | Decorative dividers, placeholders |
| `.text-muted` | 20% | Atmospheric overlays |

### Tailwind Config Extensions

Glass colors are available via Tailwind:
- `bg-glass-white-{5,10,15,20,25,30,40,50,60,70}` - White glass tints
- `bg-glass-dark-{5,10,15,20,25,30}` - Dark glass tints
- `bg-glass-primary-{20,30,40}` - Primary color glass tints
- `shadow-glass`, `shadow-glass-lg`, `shadow-glass-inset` - Glass shadows
- `animate-gradient-shift`, `animate-liquid-wobble` - Glass animations

### Motion Animations

The `motion` library (imported from `motion/react`) provides:
- `whileHover`, `whileTap` - Interactive feedback on buttons
- `layoutId` - Shared element transitions (used in TopicSelector)
- `LayoutGroup` - Coordinate animations between components
- `AnimatePresence` - Exit animations

### Accessibility

- **Reduced motion**: All animations respect `prefers-reduced-motion` media query
- **Focus states**: Glass elements use `focus:ring-2 focus:ring-white/50`
- **Text contrast**: Critical text uses `.text-solid` with subtle text shadow
- **Keyboard navigation**: All interactive elements are focusable

### Using Glass Components

```tsx
// Import glass components
import { GlassCard, GlassButton } from '@/components/glass';

// Use in your component
<GlassCard variant="card" tint="light" hover>
  <h2 className="text-solid">Title</h2>
  <p className="text-prominent">Supporting text</p>
  <GlassButton variant="primary">Action</GlassButton>
</GlassCard>
```

### Background Setup

The `DynamicBackground` and `LiquidEdgeFilter` are added in `App.tsx`:
```tsx
<>
  <LiquidEdgeFilter />    {/* SVG filter definitions */}
  <DynamicBackground />   {/* Animated gradient mesh */}
  <div className="relative z-10">
    {/* App content */}
  </div>
</>
```

---

## File Structure

```
academio/
│
├── CLAUDE.md                        # THIS FILE - Agent memory
│
├── client/                          # React Frontend Application
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   │   ├── ChatCanvas.tsx        # Main conversation display
│   │   │   │   ├── ChatMessage.tsx       # Individual message bubble
│   │   │   │   ├── ChatInput.tsx         # Text input + file upload
│   │   │   │   └── StreamingIndicator.tsx
│   │   │   ├── sidebar/
│   │   │   │   ├── Sidebar.tsx           # Container for sidebar
│   │   │   │   ├── TopicSelector.tsx     # Math, History, Science buttons
│   │   │   │   └── ChatHistory.tsx       # Previous sessions list
│   │   │   ├── admin/
│   │   │   │   ├── PromptEditor.tsx      # System prompt text area
│   │   │   │   └── AdminLogin.tsx        # Simple password gate
│   │   │   ├── common/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── FileUploadButton.tsx
│   │   │   │   └── LoadingSpinner.tsx
│   │   │   ├── glass/                    # Liquid Glass Design System
│   │   │   │   ├── GlassCard.tsx
│   │   │   │   ├── GlassButton.tsx
│   │   │   │   ├── GlassInput.tsx
│   │   │   │   ├── SpecularSurface.tsx
│   │   │   │   └── index.ts
│   │   │   ├── effects/
│   │   │   │   ├── LiquidEdgeFilter.tsx
│   │   │   │   └── LiquidBorder.tsx
│   │   │   ├── layout/
│   │   │   │   └── DynamicBackground.tsx
│   │   │   └── transitions/
│   │   │       └── MorphingContainer.tsx
│   │   ├── pages/
│   │   │   ├── StudentPage.tsx           # Main student interface
│   │   │   └── AdminPage.tsx             # Admin portal
│   │   ├── hooks/
│   │   │   ├── useChat.ts                # SSE streaming (dedicated handler)
│   │   │   ├── useSessions.ts            # Session management
│   │   │   ├── useFileUpload.ts          # File upload handling
│   │   │   └── useSpecularHighlight.ts   # Cursor-following light effect
│   │   ├── styles/
│   │   │   └── liquid-glass-tokens.ts    # Design system tokens
│   │   ├── services/
│   │   │   └── api.ts                    # REST calls (sessions, uploads, admin)
│   │   ├── context/
│   │   │   └── ChatContext.tsx           # Global chat state
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── utils/
│   │   │   └── formatters.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── server/                          # Express Backend Application
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── chat.controller.ts
│   │   │   ├── session.controller.ts
│   │   │   ├── upload.controller.ts
│   │   │   └── admin.controller.ts
│   │   ├── services/
│   │   │   ├── ollama.service.ts         # DeepSeek/Ollama integration
│   │   │   ├── pdf.service.ts
│   │   │   ├── image.service.ts
│   │   │   └── prompt.service.ts
│   │   ├── routes/
│   │   │   ├── chat.routes.ts
│   │   │   ├── session.routes.ts
│   │   │   ├── upload.routes.ts
│   │   │   ├── admin.routes.ts
│   │   │   └── index.ts
│   │   ├── middleware/
│   │   │   ├── adminAuth.middleware.ts
│   │   │   └── errorHandler.middleware.ts
│   │   ├── database/
│   │   │   ├── db.ts
│   │   │   ├── schema.sql
│   │   │   └── queries/
│   │   │       ├── sessions.queries.ts
│   │   │       └── messages.queries.ts
│   │   ├── config/
│   │   │   └── index.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── data/
│   │   ├── sqlite.db
│   │   ├── system-prompt.txt
│   │   └── uploads/
│   ├── tsconfig.json
│   └── package.json
│
├── shared/                          # Shared TypeScript Types
│   └── types/
│       ├── chat.types.ts
│       ├── session.types.ts
│       └── index.ts
│
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

---

## THE SOCRATIC PRIME DIRECTIVE

> **CRITICAL: This section defines the core behavioral requirement of the AI tutor.**
> **Any code changes to the AI service or system prompts MUST preserve this directive.**

### The Prime Directive

**The AI agent within this application MUST NEVER simply provide the final answer to a student's question, math problem, or quiz.**

It must act as a **world-class Socratic Tutor**. Its goal is to **guide the student to the answer** through:
- Thoughtful questioning
- Relatable analogies
- Breaking down complex problems into smaller steps

The AI must be **encouraging, clear, and comprehensive**, suitable for a **K-12 audience**.

---

### Required Behaviors

| Behavior | Description |
|----------|-------------|
| **Guide, Don't Tell** | Use questions to lead students to discover answers themselves |
| **Break Down Problems** | Decompose complex questions into smaller, manageable steps |
| **Use Analogies** | Relate abstract concepts to familiar, everyday experiences |
| **Encourage Always** | Maintain a positive, supportive, patient tone at all times |
| **Validate Thinking** | Acknowledge correct reasoning before introducing new concepts |
| **Check Understanding** | Ask students to explain their thinking before moving forward |

---

### Forbidden Behaviors

| Forbidden Action | Why It's Forbidden |
|------------------|-------------------|
| Giving final answers directly | Robs students of the learning experience |
| Solving math problems for students | Students must work through the steps themselves |
| Writing essays/assignments | Academic integrity; students must produce their own work |
| Skipping the questioning process | The process IS the learning |
| Being condescending or impatient | Discourages students from asking questions |

---

### Example Interactions

#### BAD (Forbidden)

```
Student: "What is 7 × 8?"
AI: "56"
```

```
Student: "What caused World War I?"
AI: "World War I was caused by the assassination of Archduke Franz Ferdinand..."
```

#### GOOD (Required)

```
Student: "What is 7 × 8?"
AI: "Great question! Let's figure this out together.
     Do you remember what 7 × 7 equals?
     Once you have that, what would happen if we added one more group of 7?"
```

```
Student: "What caused World War I?"
AI: "That's a fascinating question about a pivotal moment in history!
     Let's explore this step by step. First, do you know what was happening
     in Europe in the early 1900s? Were the major countries getting along,
     or were there tensions building up? What have you heard about alliances
     between countries during that time?"
```

---

### System Prompt Location

The active system prompt that enforces this directive is stored at:
```
server/data/system-prompt.txt
```

This prompt can be edited via the Admin Portal at `/admin`.

**WARNING:** Any modifications to the system prompt MUST preserve the Socratic teaching methodology defined above.

---

## Key Architectural Decisions

### 1. SSE for Streaming
- `useChat.ts` handles Server-Sent Events directly (not through `api.ts`)
- Endpoint: `GET /api/chat/stream`
- Provides real-time token-by-token rendering

### 2. Separation of Concerns
- Controllers: HTTP request/response handling only
- Services: Business logic (AI calls, file parsing, database)
- Routes: Endpoint definitions and middleware chaining

### 3. File Upload Flow
1. Client uploads file to `/api/upload`
2. Backend extracts text (PDF) or processes image
3. Extracted content is included in the chat context
4. Ollama receives the enriched prompt

### 4. Session Management
- Each conversation is a "session" with a unique ID
- Sessions are associated with a topic (Math, Science, etc.)
- All messages within a session are persisted to SQLite

---

## Environment Variables

See `.env.example` for required configuration:
- `OLLAMA_BASE_URL` - Ollama API endpoint (default: http://localhost:11434)
- `OLLAMA_MODEL` - Model to use (default: deepseek-r1:8b)
- `ADMIN_PASSWORD` - Password for admin portal access
- `PORT` - Server port (default: 3001)

---

## Commands

```bash
# Development
npm run dev          # Start both client and server in dev mode

# Individual
npm run dev:client   # Start frontend only
npm run dev:server   # Start backend only

# Production
npm run build        # Build both client and server
npm run start        # Start production server
```

---

## Teacher Interface Architecture

> **Added:** This section documents the Teacher Interface design and architecture.
> **Status:** Approved for implementation.

### Overview

The Teacher Interface is a separate portal that allows teachers to:
1. **Monitor Students** - View individual student profiles, grades, and learning progress
2. **Detect Struggles** - Identify students who need intervention based on AI copilot usage patterns
3. **Generate Materials** - Use AI assistant to create lessons, presentations, tests, and homework

---

### Teacher Interface File Structure

#### Client-Side (Frontend)

```
client/src/
├── components/
│   └── teacher/
│       ├── TeacherSidebar.tsx           # Navigation: Dashboard, Students, AI Assistant
│       ├── StudentList.tsx              # Grid/list of students in classroom
│       ├── StudentCard.tsx              # Student summary card (avatar, name, status)
│       ├── StudentProfile.tsx           # Detailed student view
│       │   ├── StudentSummary.tsx       # Quick bio, enrollment info
│       │   ├── GradeHistory.tsx         # Grades per subject (chart/table)
│       │   ├── LearningActivity.tsx     # AI copilot usage, questions asked
│       │   └── InterventionAlert.tsx    # Warning if student is struggling
│       ├── classroom/
│       │   ├── ClassroomOverview.tsx    # Aggregate class stats
│       │   └── SubjectSelector.tsx      # Filter by subject
│       └── assistant/
│           ├── TeacherChat.tsx          # ChatGPT-like interface for teachers
│           ├── TeacherChatInput.tsx     # Input with material type selector
│           ├── TeacherChatMessage.tsx   # Message bubble (supports markdown)
│           └── MaterialPreview.tsx      # Preview generated content
│
├── pages/
│   └── TeacherPage.tsx                  # Main teacher portal container
│
├── hooks/
│   ├── useTeacherChat.ts                # SSE streaming for teacher assistant
│   ├── useStudents.ts                   # Fetch/manage student data
│   └── useClassroom.ts                  # Classroom-level data
│
├── services/
│   └── teacherApi.ts                    # REST calls for teacher endpoints
│
├── context/
│   └── TeacherContext.tsx               # Global teacher state
│
└── types/
    └── teacher.types.ts                 # Teacher-specific TypeScript types
```

#### Server-Side (Backend)

```
server/src/
├── controllers/
│   ├── teacher.controller.ts            # Teacher authentication, profile
│   ├── student.controller.ts            # Student CRUD, profiles
│   ├── classroom.controller.ts          # Classroom management
│   └── teacherChat.controller.ts        # AI assistant for teachers
│
├── services/
│   ├── student.service.ts               # Student data aggregation
│   ├── classroom.service.ts             # Class-level analytics
│   ├── grades.service.ts                # Grade history management
│   ├── learningAnalytics.service.ts     # Track student AI usage patterns
│   └── teacherAssistant.service.ts      # Material generation prompts
│
├── routes/
│   ├── teacher.routes.ts                # /api/teacher/*
│   ├── student.routes.ts                # /api/students/*
│   └── classroom.routes.ts              # /api/classroom/*
│
├── middleware/
│   └── teacherAuth.middleware.ts        # Teacher session validation
│
└── database/
    └── queries/
        ├── students.queries.ts          # Student data queries
        ├── grades.queries.ts            # Grade history queries
        └── analytics.queries.ts         # Learning analytics queries
```

#### Database Schema Additions

```
server/data/
├── sqlite.db                            # Extended with new tables:
│   ├── teachers                         # Teacher accounts
│   ├── classrooms                       # Classroom definitions
│   ├── students                         # Student profiles
│   ├── student_grades                   # Grade history per subject
│   ├── learning_analytics               # AI copilot usage tracking
│   └── teacher_chat_sessions            # Teacher assistant history
│
└── teacher-system-prompt.txt            # System prompt for teacher assistant
```

#### Shared Types

```
shared/types/
├── teacher.types.ts                     # Teacher, Classroom interfaces
├── student.types.ts                     # Student, Grade, Analytics interfaces
└── index.ts                             # Updated exports
```

---

### Database Schema Design

#### New Tables

```sql
-- Teachers table
CREATE TABLE teachers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Classrooms table
CREATE TABLE classrooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    subject TEXT,
    grade_level TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

-- Students table
CREATE TABLE students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    avatar_url TEXT,
    grade_level TEXT,
    classroom_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id)
);

-- Student grades history
CREATE TABLE student_grades (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    grade REAL NOT NULL,
    assignment_name TEXT,
    graded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id)
);

-- Learning analytics (tracks AI copilot usage)
CREATE TABLE learning_analytics (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    subject TEXT,
    topic TEXT,
    questions_asked INTEGER DEFAULT 0,
    time_spent_seconds INTEGER DEFAULT 0,
    struggle_score REAL DEFAULT 0,  -- 0-1 scale, higher = more struggling
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Teacher chat sessions (for material generation)
CREATE TABLE teacher_chat_sessions (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    title TEXT,
    material_type TEXT,  -- 'lesson', 'presentation', 'test', 'homework'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

-- Teacher chat messages
CREATE TABLE teacher_chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,  -- 'user' or 'assistant'
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES teacher_chat_sessions(id)
);
```

---

### API Endpoints

#### Teacher Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/teacher/login` | Teacher login |
| POST | `/api/teacher/logout` | Teacher logout |
| GET | `/api/teacher/profile` | Get current teacher profile |

#### Student Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/students` | List all students in teacher's classrooms |
| GET | `/api/students/:id` | Get student profile with grades & analytics |
| GET | `/api/students/:id/grades` | Get student's grade history |
| GET | `/api/students/:id/activity` | Get student's AI copilot usage |

#### Classroom
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/classroom` | Get classroom overview stats |
| GET | `/api/classroom/struggling` | Get list of struggling students |

#### Teacher AI Assistant
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/teacher/chat/stream` | SSE stream for material generation |
| GET | `/api/teacher/chat/sessions` | List teacher's chat sessions |
| POST | `/api/teacher/chat/sessions` | Create new chat session |

---

### Routing Structure

| Route | Component | Purpose |
|-------|-----------|---------|
| `/teacher` | `TeacherPage.tsx` | Main teacher dashboard |
| `/teacher/students` | `StudentList.tsx` | View all students |
| `/teacher/students/:id` | `StudentProfile.tsx` | Individual student details |
| `/teacher/assistant` | `TeacherChat.tsx` | AI material generator |
| `/teacher/classroom` | `ClassroomOverview.tsx` | Class-wide analytics |

---

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Separate `TeacherContext` | Teachers have different state needs than students |
| `learningAnalytics.service.ts` | Aggregates student's AI chat sessions to detect struggle patterns |
| Two system prompts | Teacher assistant needs different behavior (generate materials, not Socratic) |
| `InterventionAlert.tsx` | Visual indicator when student asks many questions on same topic |
| Reuse existing SSE pattern | Consistent streaming approach via `useTeacherChat.ts` |
| `struggle_score` field | Algorithm-based metric (0-1) based on questions asked, time spent, repetition |

---

### Struggle Detection Algorithm

The `struggle_score` is calculated based on:

```typescript
// Factors that increase struggle score:
// 1. Number of questions asked on same topic (normalized)
// 2. Time spent without progress (normalized)
// 3. Repetitive questions (asking same thing multiple ways)
// 4. Requesting clarification multiple times

function calculateStruggleScore(analytics: LearningAnalytics): number {
    const questionWeight = 0.3;
    const timeWeight = 0.2;
    const repetitionWeight = 0.3;
    const clarificationWeight = 0.2;

    // Returns value between 0 and 1
    // > 0.7 triggers InterventionAlert
}
```

---

### Teacher Assistant System Prompt

Unlike the Student AI (Socratic method), the Teacher Assistant should:
- **Directly provide** lesson plans, test questions, homework assignments
- **Generate** structured content (markdown, outlines, rubrics)
- **Suggest** pedagogical approaches and differentiation strategies
- **Create** age-appropriate materials based on grade level

Location: `server/data/teacher-system-prompt.txt`

---

### Environment Variables (New)

```bash
# Add to .env
TEACHER_PASSWORD=your_teacher_password  # For teacher portal access
```

---

## AI Gatekeeper Service

> **Added 2026-02-13:** Mandatory formatter that intercepts ALL AI outputs for consistent formatting.

### Overview

The AI Gatekeeper is a centralized service that ensures all AI-generated content has:
- Proper LaTeX formatting for math expressions ($...$ and $$...$$)
- Clean markdown structure (headers, lists, code blocks)
- Metadata extraction (word count, question count, formatting applied)
- Spanish language enforcement

### Key Files

| File | Purpose |
|------|---------|
| `server/src/services/aiGatekeeper.service.ts` | Core gatekeeper service |
| `client/src/components/shared/SmartMarkdown.tsx` | Frontend LaTeX renderer |

### Usage Pattern

```typescript
import { aiGatekeeper } from './aiGatekeeper.service';

// For non-streaming responses
const result = await aiGatekeeper.generateFormattedResponse(
  prompt,
  systemPrompt,
  { contentType: 'lesson', requireLatex: true }
);
// Returns: { content: string, metadata: { wordCount, hasLatex, ... } }

// For quick synchronous formatting
const formatted = aiGatekeeper.formatSync(rawContent, { contentType: 'chat' });
```

### Content Types

| Type | Usage |
|------|-------|
| `lesson` | Lesson content with educational structure |
| `homework` | Homework with problem numbering |
| `chat` | Quick responses for tutoring chat |
| `grading` | Homework feedback formatting |
| `feedback` | General feedback |

---

## Spanish Language Enforcement

> **Added 2026-02-13:** All AI outputs MUST be in Mexican Spanish (es-MX).

### Guardrails Implemented

1. **System Prompts**: All prompts include explicit Spanish language rules
2. **AI Gatekeeper**: EDITOR_SYSTEM_PROMPT enforces Spanish output
3. **Frontend i18n**: All UI text uses `react-i18next` with `es-MX.json`

### System Prompt Template

All AI system prompts include:
```
## REGLA CRÍTICA DE IDIOMA
- TODO tu contenido DEBE estar en ESPAÑOL MEXICANO
- NUNCA uses inglés bajo ninguna circunstancia
- Si el estudiante te escribe en inglés, responde siempre en español
- Mantén el español natural y apropiado para jóvenes mexicanos
```

### Key Files

| File | Purpose |
|------|---------|
| `server/data/system-prompt.txt` | Student tutor prompt (Spanish) |
| `server/data/teacher-system-prompt.txt` | Teacher assistant prompt (Spanish) |
| `client/src/locales/es-MX.json` | Frontend translations |

---

## Teacher-Student Content Isolation

> **CRITICAL:** Students MUST only see content from their assigned teacher.

### How It Works

1. Student profiles have a `teacher_id` field linking them to their teacher
2. When fetching lessons/homework, queries filter by `teacher_id`
3. If `teacher_id` is NULL, student sees all content (backwards compatibility)

### Database Query Pattern

```sql
-- Homework query filters by assigned teacher
SELECT ph.* FROM personalized_homework ph
JOIN homework_assignments h ON ph.homework_id = h.id
LEFT JOIN student_profiles sp ON sp.user_id = ph.student_id
WHERE ph.student_id = ?
  AND (sp.teacher_id IS NULL OR h.teacher_id = sp.teacher_id)
```

### Key Files

| File | Query |
|------|-------|
| `server/src/database/queries/homework.queries.ts` | `getPersonalizedByStudentId()` |
| `server/src/database/queries/lessons.queries.ts` | `getPersonalizedByStudentId()` |

---

## Age-Adaptive AI Prompts

> **Added 2026-02-13:** AI tutor adapts communication style based on student age/grade.

### Adaptation Levels

| Level | Age/Grade | AI Behavior |
|-------|-----------|-------------|
| **Preparatoria** | 15+ / Prepa | Sophisticated vocabulary, complex analogies, treats as near-adults, advanced critical thinking |
| **Secundaria** | 12-15 | Balanced vocabulary, relatable analogies, friendly but respectful |
| **Primaria** | <12 | Simple language, concrete/visual analogies, very encouraging, small steps |

### Implementation

The `lessonChat.service.ts` dynamically builds prompts based on `studentProfile.age` and `studentProfile.gradeLevel`:

```typescript
if (isPreparatoria || isOlderTeen) {
  prompt += `- Usa vocabulario más sofisticado y técnico
- Puedes usar analogías más complejas y abstractas
- Trátalos con mayor madurez - son casi adultos
- Haz preguntas que requieran pensamiento crítico avanzado`;
}
```

### Key Files

| File | Purpose |
|------|---------|
| `server/src/services/lessonChat.service.ts` | Dynamic prompt building with age adaptation |
| `server/src/database/queries/studentProfiles.queries.ts` | Student age/grade storage |
