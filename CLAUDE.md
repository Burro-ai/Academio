# CLAUDE.md - Academio Project Context

> **MAINTENANCE RULE:** This file must remain under 30k characters. When adding new features, offload detailed technical specs to ARCHITECT.md and keep only core behavioral instructions here.
>
> **Purpose:** Persistent memory for AI agents. Core behavioral instructions and critical patterns only.
> For detailed architecture, API contracts, and data flow diagrams → **ARCHITECT.md**
> For design system tokens, glass component docs → **DESIGN.md**
> For full schema definitions → **SCHEMA.md**

---

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + Motion (animations)
- **Backend:** Node.js + Express + TypeScript
- **AI Engine:** DeepSeek Cloud API (primary) / Ollama (offline fallback)
- **Database:** SQLite — `server/data/sqlite.db`
- **Design:** Apple Liquid Glass (2026) — glassmorphism, specular highlights → see **DESIGN.md**
- **Auth:** JWT (7-day expiry) + bcrypt password hashing
- **Streaming:** Server-Sent Events (SSE) for real-time AI responses
- **i18n:** react-i18next with `es-MX.json` — ALL user-facing text uses `t()`

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

### Required Behaviors

| Behavior | Description |
|----------|-------------|
| **Guide, Don't Tell** | Use questions to lead students to discover answers themselves |
| **Break Down Problems** | Decompose complex questions into smaller, manageable steps |
| **Use Analogies** | Relate abstract concepts to familiar, everyday experiences |
| **Encourage Always** | Maintain a positive, supportive, patient tone at all times |
| **Validate Thinking** | Acknowledge correct reasoning before introducing new concepts |
| **Check Understanding** | Ask students to explain their thinking before moving forward |

### Forbidden Behaviors

| Forbidden Action | Why It's Forbidden |
|------------------|-------------------|
| Giving final answers directly | Robs students of the learning experience |
| Solving math problems for students | Students must work through the steps themselves |
| Writing essays/assignments | Academic integrity; students must produce their own work |
| Skipping the questioning process | The process IS the learning |
| Being condescending or impatient | Discourages students from asking questions |

### Example Interactions

#### BAD (Forbidden)
```
Student: "What is 7 × 8?"
AI: "56"
```

#### GOOD (Required)
```
Student: "What is 7 × 8?"
AI: "Great question! Let's figure this out together.
     Do you remember what 7 × 7 equals?
     Once you have that, what would happen if we added one more group of 7?"
```

### System Prompt Location

Active student tutor prompt: `server/data/system-prompt.txt`
Teacher assistant prompt: `server/data/teacher-system-prompt.txt`

**WARNING:** Modifications MUST preserve the Socratic methodology above.

---

## AI Provider Configuration

```bash
# In .env file:
AI_PROVIDER=deepseek           # or 'ollama'

# DeepSeek Cloud API
DEEPSEEK_API_KEY=sk-your-api-key
DEEPSEEK_API_URL=https://api.deepseek.com/v1
AI_MODEL_NAME=deepseek-chat    # or 'deepseek-reasoner' for R1

# Ollama (local fallback)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:1.5b
```

**Model Strategy:** `deepseek-reasoner` for master content generation; `deepseek-chat` for student personalization (faster, cheaper).

**Fallback:** If `DEEPSEEK_API_KEY` is missing, server auto-falls back to Ollama.

```bash
# Check current AI provider health:
curl http://localhost:3001/api/chat/health
# → { "ok": true, "provider": "deepseek" }
```

| File | Purpose |
|------|---------|
| `server/src/services/ollama.service.ts` | Unified AI service (both providers) |
| `server/src/config/index.ts` | Provider selection |

---

## Authentication & JWT System

> **CRITICAL:** Many bugs have been caused by missing JWT tokens. Always verify auth is properly wired.

### Architecture: "Persistence-First"

1. Token read from `localStorage` **synchronously** on app load (before React renders)
2. All API calls go through `authenticatedFetch()` — token injection is **automatic**
3. 401 responses trigger immediate auth state wipe
4. Server uses centralized Permission Registry (`permissionRegistry.ts`) for route-to-role mapping

**Always use `authenticatedFetch()` from `authInterceptor.ts`. Never manually call `authApi.getToken()`.**

```typescript
import { authenticatedFetch } from '@/services/authInterceptor';
const response = await authenticatedFetch('/api/lessons');  // token auto-injected
```

**JWT Payload:** `{ id, email, role: 'STUDENT'|'TEACHER', schoolId?, iat, exp }` — stored as `academio_token` in `localStorage`.

### Middleware

| Middleware | Behavior |
|------------|----------|
| `authMiddleware` | Returns 401 if no valid token |
| `optionalAuth` | Attaches user if token present, continues without |
| `teacherOnly` | Returns 403 if role !== 'TEACHER' |
| `studentOnly` | Returns 403 if role !== 'STUDENT' |

### Auth Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `NO_AUTH_HEADER` | 401 | Authorization header missing |
| `TOKEN_EXPIRED` | 401 | Token past expiration date |
| `TOKEN_INVALID` | 401 | Token malformed or bad signature |
| `INSUFFICIENT_PERMISSIONS` | 403 | Role doesn't match required |
| `SCHOOL_SCOPE_MISMATCH` | 403 | School ID doesn't match token |

### Common Auth Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| "Access denied" on create | Missing token in request | Use `authenticatedFetch()` |
| Infinite loading spinner | Stale localStorage data | Visit `/login` to clear data |
| Dashboard stuck on "Verificando" | Auth verification timeout | Safety timeout (5s) auto-resolves |
| Role check fails | Case-sensitive comparison | Always use `user.role?.toUpperCase() === 'TEACHER'` |

### Auth Safety Mechanisms

1. **Safety Timeout:** `AuthContext` has a 5-second failsafe that forces `isVerifying=false`
2. **LoginPage Cleanup:** Visiting `/login` clears any corrupted auth data
3. **Test Page:** `http://localhost:5174/test-login.html` for debugging

### Key Auth Files

| File | Purpose |
|------|---------|
| `client/src/services/authInterceptor.ts` | Global fetch interceptor, 401 handling |
| `server/src/middleware/permissionRegistry.ts` | Central RBAC — add new routes here |
| `server/src/middleware/auth.middleware.ts` | JWT verification, role normalization |
| `client/src/context/AuthContext.tsx` | Blocking hydration, logout subscription |
| `client/src/services/authApi.ts` | Token storage/retrieval |

---

## CORS Configuration

Dynamic CORS — in development, **any `localhost:*` port is automatically allowed**.

```typescript
// server/src/index.ts
origin: (origin, callback) => {
  if (!origin) return callback(null, true);
  if (config.nodeEnv === 'development' && origin.startsWith('http://localhost:')) {
    return callback(null, true); // Any localhost port in dev
  }
  // ... check allowedOrigins array
}
```

---

## AI Gatekeeper Service

> **ALL AI outputs MUST go through `aiGatekeeper.service.ts`.** Never bypass it.

Enforces: LaTeX formatting (`$...$` syntax), markdown structure, Spanish language, metadata extraction (wordCount, questionCount).

```typescript
import { aiGatekeeper } from './aiGatekeeper.service';

// Non-streaming
const result = await aiGatekeeper.generateFormattedResponse(prompt, systemPrompt, { contentType: 'lesson' });

// Synchronous post-processing
const formatted = aiGatekeeper.formatSync(rawContent, { contentType: 'chat' });
```

Content types: `lesson` | `homework` | `chat` | `grading` | `feedback`

| File | Purpose |
|------|---------|
| `server/src/services/aiGatekeeper.service.ts` | Core gatekeeper |
| `client/src/components/shared/SmartMarkdown.tsx` | LaTeX renderer (`variant`: default/lesson/homework/chat/feedback/focus) |

---

## Pedagogical Persona System

`getPedagogicalPersona(age, gradeLevel)` in `aiGatekeeper.service.ts` returns one of 5 personas:

| Persona | Age | Grade | Enthusiasm |
|---------|-----|-------|------------|
| El Narrador (Storyteller) | 7-9 | 1º-3º Primaria | ✅ Allowed |
| El Guía Amigable | 10-12 | 4º-6º Primaria | ✅ Allowed |
| El Mentor Estructurado | 13-15 | Secundaria | ❌ No exclamations |
| El Retador Académico | 16-18 | Preparatoria | ❌ No exclamations |
| El Colega Investigador | 19+ | Universidad | ❌ No exclamations |

**Anti-Cringe Directive:** Personal interests (sports, hobbies) are NEVER used in initial interactions. Only activated conditionally after 2+ failed comprehension attempts via struggle detection (`analyzeStruggleLevel()` in `lessonChat.service.ts`).

**System Prompt Hierarchy:**
1. Core Directive (Socratic methodology)
2. Sophistication Barrier (age-appropriate complexity)
3. Lesson Content Context
4. Response Guidelines (tone based on `persona.allowsEnthusiasm`)
5. Prohibitions (no exclamations for 13+)
6. Student Context (age/grade only — NO interests by default)
7. [CONDITIONAL] Struggle Support Resources (interests only when struggling)

---

## Spanish Language Enforcement

> All AI outputs MUST be in Mexican Spanish (es-MX).

All system prompts include:
```
## REGLA CRÍTICA DE IDIOMA
- TODO tu contenido DEBE estar en ESPAÑOL MEXICANO
- NUNCA uses inglés bajo ninguna circunstancia
- Si el estudiante te escribe en inglés, responde siempre en español
- Mantén el español natural y apropiado para jóvenes mexicanos
```

Frontend uses `react-i18next` — ALL user-facing text must use `t()` from `useTranslation()`.
Translations file: `client/src/locales/es-MX.json`

---

## Teacher-Student Content Isolation

> **CRITICAL:** Students MUST only see content from their assigned teacher.

- Student profiles have `teacher_id` → queries filter by this field
- If `teacher_id` is NULL → student sees all content (backwards compatibility)

```sql
-- Pattern used in homework.queries.ts and lessons.queries.ts:
WHERE ph.student_id = ?
  AND (sp.teacher_id IS NULL OR h.teacher_id = sp.teacher_id)
```

| File | Query |
|------|-------|
| `server/src/database/queries/homework.queries.ts` | `getPersonalizedByStudentId()` |
| `server/src/database/queries/lessons.queries.ts` | `getPersonalizedByStudentId()` |

---

## On-Demand Lesson Personalization

> **Updated 2026-02-21:** Students trigger AI personalization — teacher side no longer auto-runs mass personalization.

**Flow:**
1. Teacher assigns → `distributeToStudents()` creates `personalized_lessons` rows with `masterContent` as content (instant, no AI)
2. Student opens lesson → sees `masterContent` by default
3. Student clicks "Personalizar mi lección" → `POST /api/student/lesson-chat/:lessonId/personalize` → `personalizeOnDemand()` runs AI → row updated → UI swaps content

Key service methods in `lesson.service.ts`:
- `distributeToStudents(lessonId, classroomId?, teacherId?)` — creates rows, skips existing
- `personalizeOnDemand(personalizedLessonId, studentId)` — validates ownership, runs AI, updates row

**LessonCreator state machine:** `idle → generating → editing → assigned` (SmartMarkdown reader + edit/preview toggle).

---

## Homework JSON Mandate

> **Updated 2026-02-17:** Replaced regex parsing with structured JSON.

AI must output a `<JSON_QUESTIONS>` block. `useHomeworkForm.ts` prioritizes JSON over regex with fallback. Questions stored in `questions_json` column.

```typescript
interface HomeworkQuestionJson {
  id: number;
  text: string;
  type: 'open' | 'choice';
  options?: string[];
}
```

| File | Purpose |
|------|---------|
| `server/src/services/homework.service.ts` | JSON-focused prompts, `parseHomeworkJson()` |
| `server/src/database/queries/homework.queries.ts` | `questions_json` column handling |
| `client/src/hooks/useHomeworkForm.ts` | JSON-first question loading |
| `shared/types/lesson.types.ts` | `HomeworkQuestionJson` / `HomeworkContentJson` interfaces |

---

## RAG Long-Term Memory System

ChromaDB vector database for persistent student memory across sessions.

- **Storage:** Collections `student_memory_{student_id}` in ChromaDB
- **Embeddings:** Ollama `qwen3-embedding` model
- **Sync:** SQLite ↔ ChromaDB auto-sync on server startup
- **Graceful Degradation:** If ChromaDB unavailable, `isAvailable()` returns `false`; features silently skipped

**Environment Variables:**
```bash
CHROMA_HOST=localhost
CHROMA_PORT=8000
```

**Lifecycle:** Profile create → `initializeStudentMemory()`; Profile delete → `deleteStudentMemory()`.

| File | Purpose |
|------|---------|
| `server/src/services/memory.service.ts` | ChromaDB client, RAG pipeline |
| `server/src/services/lessonChat.service.ts` | Integration point (retrieval + storage) |
| `server/src/utils/resetMemory.ts` | Memory reset utility |

---

## Teacher Portal

### Teacher vs. Student AI Behavior

Unlike the Socratic student AI, the Teacher Assistant **directly provides** lesson plans, homework, tests, rubrics, and pedagogical suggestions. System prompt: `server/data/teacher-system-prompt.txt`.

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Separate `TeacherContext` | Teachers have different state needs than students |
| `struggle_score` field (0-1) | Algorithm-based metric; > 0.7 triggers `InterventionAlert.tsx` |
| Two system prompts | Teacher = generate materials directly; Student = Socratic method |

> For Teacher Interface file structure, API endpoints, routing table, and DB schema → see **ARCHITECT.md**.

---

## Key Architectural Decisions

1. **SSE for Streaming** — `useChat.ts` / `useLessonChat.ts` handle SSE directly. Pattern: `GET /api/**/stream`
2. **Separation of Concerns** — Controllers: HTTP only; Services: business logic + AI; Routes: middleware chaining
3. **Session Management** — Each conversation is a session (UUID) linked to a user, persisted to SQLite
4. **LessonCreator State Machine** — `idle → generating → editing → assigned`; SmartMarkdown reader with edit/preview toggle
5. **`permissionRegistry.ts`** — All new routes MUST be registered here or they return 403 by default

---

## Common Gotchas

1. **Error messages:** Use `t('errors.failedToLoad')` — never hardcode English strings
2. **Confirm dialogs:** Use `t('panels.lessons.confirmDelete')` — never hardcode English
3. **Loading spinners:** Use "Cargando..." not "Loading..."
4. **Role checks:** Case-insensitive: `user.role?.toUpperCase() === 'TEACHER'`
5. **New routes:** Register in `permissionRegistry.ts` or the route silently returns 403

---

## Key File Locations

| Purpose | File |
|---------|------|
| Student system prompt | `server/data/system-prompt.txt` |
| Teacher system prompt | `server/data/teacher-system-prompt.txt` |
| AI Gatekeeper | `server/src/services/aiGatekeeper.service.ts` |
| Lesson chat service (age adaptation + struggle detection) | `server/src/services/lessonChat.service.ts` |
| Long-term memory (RAG) | `server/src/services/memory.service.ts` |
| Memory reset utility | `server/src/utils/resetMemory.ts` |
| Frontend translations | `client/src/locales/es-MX.json` |
| LaTeX renderer | `client/src/components/shared/SmartMarkdown.tsx` |
| Auth interceptor | `client/src/services/authInterceptor.ts` |
| Permission registry | `server/src/middleware/permissionRegistry.ts` |
| Lesson service (personalization) | `server/src/services/lesson.service.ts` |
| Homework service | `server/src/services/homework.service.ts` |

---

## Environment Variables

```bash
# AI Provider
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_API_URL=https://api.deepseek.com/v1
AI_MODEL_NAME=deepseek-chat

# Ollama (fallback)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:1.5b

# Server
JWT_SECRET=your-jwt-secret
PORT=3001
CLIENT_URL=http://localhost:5174
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5175
ADMIN_PASSWORD=your-admin-password

# RAG / ChromaDB
CHROMA_HOST=localhost
CHROMA_PORT=8000
```

---

## Commands

```bash
# Development
npm run dev            # Start both client and server
npm run dev:client     # Frontend only
npm run dev:server     # Backend only
npm run build          # Build both
npm run start          # Production server

# Testing & Utilities
cd server && npm run test:auth          # Auth integrity tests
npm run test:homework-json              # JSON generation verification
npm run test:pedagogical                # Pedagogical grounding audit (struggle, rubric, exit ticket)
npm run memory:verify                   # Check RAG sync status
npm run memory:reset                    # Reset all student memories
npm run create:test-students            # Inject test student data
```

---

## Pedagogical Grading Directive

> **Added 2026-02-22.** Core behavioral rules for the analytics + grading + exit ticket subsystems.
> **Mathematical formulas and verified test cases → see ARCHITECT.md § Pedagogical Data Engineering.**

### Three-Layer Assessment Architecture

| Layer | Service | Trigger |
|-------|---------|---------|
| **Real-Time Struggle Matrix** | `analytics.service.ts` | After every assistant chat message |
| **Rubric-Based Grading** | `homeworkGrading.service.ts` | After homework submission |
| **Exit Ticket Verification** | `exitTicket.service.ts` | Student clicks "Complete lesson" |

### Behavioral Rules

1. **Never break lesson chat for analytics.** `calculateAndPersist()` is wrapped in try/catch. Failure logs a warning, never throws.
2. **Struggle composite is age-normalized.** Younger students expressing confusion is natural (0.70× for ages 7-9). Older students doing the same signals a real gap (1.20× for 16+). See ARCHITECT.md for multiplier table.
3. **Rubric = Exactitud 40% + Razonamiento 40% + Esfuerzo 20%.** Getting answers right without showing work yields roughly 56/100 — correct answers alone are insufficient.
4. **Exit ticket pass threshold = 0.60.** `comprehensionScore < 0.60` → lesson remains incomplete. AI failure gracefully auto-passes at 0.5 (prevents blocking students on infra issues).
5. **All scoring persists to `learning_analytics`.** `struggle_score`, `struggle_dimensions` (JSON), `comprehension_score`, `exit_ticket_passed`.

### Key Files

| File | Purpose |
|------|---------|
| `server/src/services/analytics.service.ts` | Struggle Matrix engine |
| `server/src/services/homeworkGrading.service.ts` | Rubric-based AI grading |
| `server/src/services/exitTicket.service.ts` | Comprehension verification |
| `server/src/utils/test-pedagogical-grounding.ts` | Automated audit (23 assertions) |
