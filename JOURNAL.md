# JOURNAL.md - Academio Development Progress Log

> **Purpose:** Track development progress, decisions made, and next steps for context continuity.
> **Last Updated:** 2026-02-08

---

## How to Use This File

1. **Starting a new session?** Read the "Current State" and "Next Steps" sections first
2. **Finished implementing something?** Add an entry under "Progress Log"
3. **Made a decision?** Document it under "Decisions Made"
4. **Blocked or need to remember something?** Add to "Notes & Blockers"

---

## Current State

### What's Working
- [x] Authentication system (JWT-based login/register)
- [x] JWT auth across all protected routes (sessions, lessons, homework)
- [x] Session-to-user linking (chat history persists per user)
- [x] Student portal with AI chat (SSE streaming with auth)
- [x] Teacher dashboard with student list
- [x] Homework/Lesson creation with AI personalization
- [x] Streaming content generation (real-time token display)
- [x] Concurrent personalization with Promise.all() (~10x faster)
- [x] Dual-model strategy (reasoner for master, chat for personalization)
- [x] Progress tracking for personalization tasks
- [x] Liquid Glass UI design system
- [x] SQLite database with seeded demo data (20 users)
- [x] DeepSeek Cloud API (primary) / Ollama (fallback)
- [x] File upload support (PDF, images)

### What's In Progress
- [ ] Student profile detailed view (teacher side)
- [ ] Teacher AI assistant for material generation

### Recently Completed
- [x] Customization Loop optimization (streaming, concurrency, Socratic prompts) (2026-02-08)
- [x] DeepSeek Cloud API integration (2026-02-08)
- [x] Auth/JWT fixes across all workflows (2026-02-08)
- [x] Chat history persistence per user (2026-02-08)
- [x] Homework assignment system with AI personalization
- [x] Lesson creation and management with AI personalization

### Known Issues
- Sharp library not available (using fallback image processing)
- Legacy tables (students, teachers) still exist for backward compatibility during migration period

### Auth/JWT Checklist (Review Before Adding New Routes)
- [ ] Does the route need authentication? Add `authMiddleware`
- [ ] Is it teacher-only? Add `teacherOnly` middleware after `authMiddleware`
- [ ] Is it student-only? Add `studentOnly` middleware after `authMiddleware`
- [ ] Does the frontend API service include the JWT token? Check `authApi.getToken()` is used
- [ ] For SSE endpoints: Is the token included in fetch headers (not EventSource)?
- [ ] Does the controller use `req.user.id` for user-specific queries?

---

## Next Steps

### High Priority
1. Complete the StudentProfile component with grades and analytics display
2. Implement the teacher AI assistant chat (uses different system prompt)
3. Add homework CRUD operations
4. Add lesson CRUD operations

### Medium Priority
5. Implement struggle detection algorithm
6. Add classroom management features
7. Student-facing homework view
8. Learning analytics dashboard

### Low Priority
9. Export features (PDF reports)
10. Email notifications
11. Dark/light theme toggle
12. Mobile responsive improvements

---

## Progress Log

### 2026-02-08

#### Session 5: Customization Loop Optimization

- **What was done:**
  - Implemented Promise.all() for concurrent personalization (parallel API calls)
  - Added streaming endpoints for real-time content generation
  - Upgraded to Socratic personalization prompts with analogies and reflection questions
  - Implemented dual-model strategy: `deepseek-reasoner` for master content, `deepseek-chat` for personalization
  - Added progress tracking for long-running personalization tasks

- **Performance Improvements:**
  - **Before:** Sequential personalization (10 students = 10x API call time)
  - **After:** Parallel personalization with Promise.all() (~10x faster)
  - **Streaming:** Content appears token-by-token in UI instead of waiting for full response

- **New Endpoints:**
  | Endpoint | Method | Description |
  |----------|--------|-------------|
  | `/api/lessons/generate-content/stream` | GET | SSE streaming for lesson content |
  | `/api/lessons/:id/progress` | GET | Check personalization progress |
  | `/api/homework/generate-content/stream` | GET | SSE streaming for homework content |
  | `/api/homework/:id/progress` | GET | Check personalization progress |

- **New Service Methods:**
  | Service | Method | Description |
  |---------|--------|-------------|
  | `lessonService` | `generateMasterContentStream()` | Streaming content generation |
  | `lessonService` | `getProgress()` | Get personalization status |
  | `homeworkService` | `generateMasterContentStream()` | Streaming content generation |
  | `homeworkService` | `getProgress()` | Get personalization status |

- **New Client API Methods:**
  | Method | Description |
  |--------|-------------|
  | `lessonApi.streamLessonContent()` | Async generator for streaming |
  | `lessonApi.getLessonProgress()` | Check personalization progress |
  | `lessonApi.streamHomeworkContent()` | Async generator for streaming |
  | `lessonApi.getHomeworkProgress()` | Check homework personalization progress |

- **Model Strategy:**
  - Master content: Uses `deepseek-reasoner` (higher reasoning, better quality)
  - Personalization: Uses `deepseek-chat` (faster, lower cost per call)

- **Socratic Prompts:**
  - Lessons: Creates one analogy (using student interests) + one reflection question
  - Homework: Creates one interest-based problem reframe + one Socratic "think deeper" question

- **Files Modified:**
  | File | Change |
  |------|--------|
  | `server/src/services/lesson.service.ts` | Added streaming, Promise.all, progress tracking, Socratic prompts, model selection |
  | `server/src/services/homework.service.ts` | Added streaming, Promise.all, progress tracking, Socratic prompts, model selection |
  | `server/src/services/ollama.service.ts` | Added `ModelType` export and model selection parameter |
  | `server/src/controllers/lesson.controller.ts` | Added `streamGenerateContent`, `getProgress` endpoints |
  | `server/src/controllers/homework.controller.ts` | Added `streamGenerateContent`, `getProgress` endpoints |
  | `server/src/routes/lesson.routes.ts` | Added streaming and progress routes |
  | `server/src/routes/homework.routes.ts` | Added streaming and progress routes |
  | `client/src/services/lessonApi.ts` | Added streaming and progress methods |
  | `client/src/components/teacher/LessonCreator.tsx` | Updated to use streaming |
  | `client/src/components/teacher/HomeworkCreator.tsx` | Updated to use streaming |

- **Progress Tracking Schema:**
  ```typescript
  interface PersonalizationProgress {
    lessonId: string;        // or homeworkId
    total: number;           // Total students to personalize
    completed: number;       // Students completed so far
    current: string | null;  // Current student name being processed
    status: 'pending' | 'in_progress' | 'completed' | 'error';
    error?: string;          // Error message if failed
  }
  ```

- **Background Processing:**
  - Personalization runs in background (not awaited) after lesson/homework creation
  - Progress stored in-memory Map (can be replaced with Redis for production)
  - Progress automatically cleaned up after 5 minutes

---

#### Session 4: DeepSeek Cloud API Integration

- **What was done:**
  - Switched from Ollama (local) to DeepSeek Cloud API for dramatically faster AI responses
  - Created unified AI service that supports both DeepSeek cloud and Ollama (for offline use)
  - Added environment variable configuration for provider selection

- **Speed Improvement:**
  - **Before (Ollama):** 30-60 seconds per lesson/homework generation
  - **After (DeepSeek Cloud):** 2-5 seconds per generation

- **Configuration:**
  ```bash
  AI_PROVIDER=deepseek                    # or 'ollama' for local
  DEEPSEEK_API_KEY=sk-xxxxx               # Your DeepSeek API key
  DEEPSEEK_API_URL=https://api.deepseek.com/v1
  AI_MODEL_NAME=deepseek-chat             # or 'deepseek-reasoner' for R1
  ```

- **Files Modified:**
  | File | Change |
  |------|--------|
  | `.env` | Added DeepSeek Cloud API configuration |
  | `.env.example` | Updated with all AI provider options |
  | `server/src/config/index.ts` | Added `aiProvider`, `deepseek` config sections |
  | `server/src/services/ollama.service.ts` | Rewrote as unified AIService with DeepSeek + Ollama support |
  | `CLAUDE.md` | Added AI Provider Configuration section |

- **Fallback Behavior:**
  - If DeepSeek API key is missing, automatically falls back to Ollama
  - Health check endpoint shows current provider: `GET /api/chat/health`

---

#### Session 3: Stale Token Bug Fix

- **What was done:**
  - Fixed critical bug where old student tokens could persist after teacher login
  - Added token clearing before login/register to prevent stale token issues
  - Added client-side token validation in lessonApi to catch role mismatches early
  - Added debugging helpers (`getTokenPayload()`, console logs) for troubleshooting

- **Root Cause:**
  - When user logs in, the old token was being included in the login request header
  - If login succeeded but token storage failed for any reason, old token would persist
  - The login/register functions now explicitly clear the old token BEFORE making the request

- **Files Modified:**

  | File | Change |
  |------|--------|
  | `client/src/services/authApi.ts` | Clear token before login/register, add `getTokenPayload()` helper |
  | `client/src/services/lessonApi.ts` | Add client-side role validation, better error messages with debugging |

- **To Fix Current Issue:**
  1. Open browser DevTools (F12)
  2. Go to Application tab → Local Storage → localhost:5174
  3. Delete the `academio_token` entry
  4. Refresh the page
  5. Log in again as Sarah (`sarah.johnson@academio.edu` / `password123`)
  6. Try creating lesson/homework again

---

#### Session 2: Authentication & Session Persistence Fixes

- **What was done:**
  - Fixed "Access denied" error when teachers create homework/lessons
  - Fixed Emma's profile appearing blank (empty arrays vs undefined)
  - Implemented proper session-to-user linking for chat history persistence
  - Added comprehensive auth/JWT documentation to CLAUDE.md and ARCHITECT.md

- **Root Causes Identified:**
  1. **Access Denied Bug:** `lessonApi.ts` wasn't including JWT token in requests
  2. **Blank Profile Bug:** `rowToProfile()` returned `undefined` for empty arrays instead of `[]`
  3. **Chat History Not Persisting:** Sessions weren't linked to authenticated users

- **Files Modified:**

  | File | Change |
  |------|--------|
  | `server/src/routes/session.routes.ts` | Added `authMiddleware` to all session routes |
  | `server/src/controllers/session.controller.ts` | Updated to use `JwtAuthenticatedRequest`, pass `userId`/`schoolId` to queries, verify ownership |
  | `server/src/routes/chat.routes.ts` | Added `optionalAuth` middleware for personalization |
  | `server/src/controllers/chat.controller.ts` | Updated to use authenticated user for ownership verification and personalization |
  | `server/src/services/ollama.service.ts` | Added `systemPrompt` parameter to `generate()` function |
  | `client/src/services/api.ts` | Added `getAuthHeaders()` to include JWT in all requests |
  | `client/src/hooks/useChat.ts` | Added JWT token to SSE fetch requests |
  | `client/src/services/lessonApi.ts` | Fixed token inclusion and improved error handling |
  | `server/src/database/queries/studentProfiles.queries.ts` | Changed `rowToProfile()` to return `[]` for empty arrays |

- **Key Learnings:**
  - JWT tokens MUST be included in Authorization header for ALL authenticated endpoints
  - SSE streaming requests also need auth headers (using fetch, not EventSource)
  - Session creation must pass `userId` from `req.user.id` to link chat history
  - Array fields should return `[]` not `undefined` for consistent frontend handling

- **Testing Verified:**
  - TypeScript compilation passes for both client and server
  - Database has correct user IDs linked to sessions
  - All user credentials working (see login credentials below)

- **Login Credentials (all passwords: `password123`):**
  - Teachers: `sarah.johnson@academio.edu`, `david.kim@academio.edu`
  - Students: `emma.rodriguez@student.academio.edu`, `alex.turner@student.academio.edu`, `zoe.martinez@student.academio.edu`, `ryan.cooper@student.academio.edu`, plus 14 more

---

#### Session 1: Homework & Lesson Personalization System Complete
- **What was done:**
  - Verified full implementation of AI-powered content personalization pipeline
  - Confirmed teacher-side workflow: LessonCreator, HomeworkCreator with "Generate with AI" and "Personalize for all students" options
  - Confirmed student-side workflow: MyLessons, MyHomework tabs in StudentDashboard
  - Verified backend services with few-shot AI prompts for personalization
  - All API endpoints properly wired (lesson.routes, homework.routes, studentPortal.routes)

- **Complete Personalization Flow:**
  1. Teacher creates lesson/homework with "Automatically personalize for all students" checked
  2. Backend generates master content using AI (few-shot prompting)
  3. Backend iterates through all student profiles and generates personalized versions
  4. Personalized content stored in `personalized_lessons` and `personalized_homework` tables
  5. Students see personalized content in their portal (My Lessons, My Homework tabs)

- **Key Features:**
  - AI generates master content based on topic/subject
  - Personalization considers: age, interests, skills to improve, learning style
  - Teachers can manually trigger personalization for existing content via "Personalize" button
  - Shows personalized count badge on lesson/homework cards
  - Students see "New" badge on unviewed lessons
  - Homework shows due date status (overdue, due today, etc.)
  - Mark lessons as viewed, submit homework functionality

- **Files verified:**
  - `server/src/services/lesson.service.ts` - AI generation & personalization
  - `server/src/services/homework.service.ts` - AI generation & personalization
  - `server/src/controllers/lesson.controller.ts` - CRUD + personalize endpoints
  - `server/src/controllers/homework.controller.ts` - CRUD + personalize endpoints
  - `server/src/controllers/studentPortal.controller.ts` - Student access to personalized content
  - `client/src/components/teacher/LessonCreator.tsx` - Teacher UI
  - `client/src/components/teacher/HomeworkCreator.tsx` - Teacher UI
  - `client/src/components/teacher/LessonsPanel.tsx` - List with personalize button
  - `client/src/components/teacher/HomeworkPanel.tsx` - List with personalize button
  - `client/src/components/student/MyLessons.tsx` - Student view
  - `client/src/components/student/MyHomework.tsx` - Student view
  - `client/src/pages/StudentDashboard.tsx` - Integration with tabs

---

### 2026-02-07

#### Session 2: Multi-School Architecture Migration
- **What was done:**
  - Added `schools` table for multi-tenancy support
  - Added `school_memberships` table for user-school relationships with roles
  - Added `school_id` column to: users, classrooms, student_profiles, sessions, lessons, homework_assignments
  - Added `user_id` shadow columns to: sessions, student_grades, learning_analytics, teacher_chat_sessions
  - Created migration function in `db.ts` to automatically migrate existing data
  - Updated all query files to use `user_id` with fallback to legacy columns
  - Created `schools.queries.ts` with full CRUD operations
  - Created `shared/types/school.types.ts` with School, SchoolMembership, SchoolPermissions types
  - Updated SCHEMA.md with complete multi-school documentation

- **Key files modified/created:**
  - `server/src/database/schema.sql` - New tables and columns
  - `server/src/database/db.ts` - Migration logic in seedDatabase()
  - `server/src/database/queries/schools.queries.ts` - NEW
  - `server/src/database/queries/sessions.queries.ts` - Updated to use user_id
  - `server/src/database/queries/grades.queries.ts` - Updated to use user_id
  - `server/src/database/queries/analytics.queries.ts` - Updated to use user_id
  - `server/src/database/queries/teacherSessions.queries.ts` - Updated to use user_id
  - `server/src/database/queries/users.queries.ts` - Added school-scoped methods
  - `server/src/database/queries/studentProfiles.queries.ts` - Added school filter
  - `server/src/database/queries/classrooms.queries.ts` - Added school filter
  - `shared/types/school.types.ts` - NEW
  - `shared/types/auth.types.ts` - Added schoolId to User, JwtPayload
  - `server/src/types/index.ts` - Added SchoolRow, SchoolMembershipRow

- **Database changes:**
  - Schema version: v2.0 (Multi-school architecture)
  - All existing data auto-migrated to "Academio Demo School"
  - All users now have school_id and school_memberships

- **Migration strategy:**
  - Shadow columns (both student_id and user_id) maintained for backward compatibility
  - Query files use fallback pattern: `WHERE user_id = ? OR (user_id IS NULL AND student_id = ?)`
  - Legacy tables (students, teachers) kept but deprecated

---

#### Session 1: Documentation Setup
- **What was done:**
  - Created ARCHITECT.md with system architecture diagrams
  - Created SCHEMA.md with complete database documentation
  - Created JOURNAL.md (this file) for progress tracking
  - Verified development servers are running correctly

- **Key files created:**
  - `ARCHITECT.md` - System architecture, data flow, API contracts
  - `SCHEMA.md` - Database schema, table definitions, relationships
  - `JOURNAL.md` - Progress log and context continuity

- **Current server status:**
  - Frontend: http://localhost:5174 (running)
  - Backend: http://localhost:3001 (running)
  - Ollama: http://localhost:11434 (required for AI)

- **Demo credentials verified:**
  - Teacher: sarah.johnson@academio.edu / password123
  - Student: emma.rodriguez@student.academio.edu / password123

---

## Decisions Made

### Architecture Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-08 | JWT tokens in localStorage | Simple client-side storage, works across tabs |
| 2026-02-08 | `optionalAuth` middleware for chat | Allows personalization when logged in, still works without |
| 2026-02-08 | Session ownership via `user_id` column | Ensures chat history persists per user |
| 2026-02-08 | Auth headers in SSE fetch (not EventSource) | EventSource doesn't support custom headers |
| 2026-02-07 | Multi-school architecture with `schools` table | Enable SaaS multi-tenancy, school isolation |
| 2026-02-07 | Use `school_memberships` junction table | Allow teachers to work across multiple schools |
| 2026-02-07 | Shadow columns (user_id + student_id) | Smooth migration without breaking existing data |
| 2026-02-07 | Use unified `users` table with role field | Simpler auth, single source of truth |
| 2026-02-07 | Keep legacy tables for now | Avoid breaking changes during active development |
| 2026-02-07 | SSE for AI streaming | Simpler than WebSockets for unidirectional data |

### Design Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-07 | Liquid Glass UI system | Modern Apple-inspired look, differentiated UX |
| 2026-02-07 | Motion library for animations | Smooth transitions, easy API |

---

## Notes & Blockers

### Active Blockers
- None currently

### Notes for Future Sessions
- The `students` and `teachers` tables are legacy - new code should use `users` table
- System prompt for student AI is at `server/data/system-prompt.txt`
- System prompt for teacher AI is at `server/data/teacher-system-prompt.txt`
- Ollama must be running locally for AI features to work

### Auth Debugging Quick Reference
```bash
# Test login and get token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.johnson@academio.edu","password":"password123"}'

# Test authenticated endpoint (replace TOKEN with actual JWT)
curl http://localhost:3001/api/homework \
  -H "Authorization: Bearer TOKEN"

# Check if user's sessions are linked correctly
node -e "const db = require('better-sqlite3')('server/data/sqlite.db'); \
  console.log(db.prepare('SELECT id, user_id, title FROM sessions WHERE user_id IS NOT NULL').all());"
```

### Common Auth Error Messages
| Error | Meaning | Fix |
|-------|---------|-----|
| "No authorization header provided" | Token not sent | Check frontend includes `Authorization: Bearer <token>` |
| "No token provided" | Empty Bearer value | Check `authApi.getToken()` returns valid token |
| "Token expired" | JWT past expiry | User needs to re-login |
| "Invalid token" | JWT malformed/wrong secret | Check JWT_SECRET matches, token not corrupted |
| "Access denied" | Role check failed | User doesn't have required role (TEACHER/STUDENT) |
| "Not authenticated" | `req.user` undefined | Middleware not applied or token invalid |

### Useful Commands
```bash
# Start development servers
npm run dev

# Start only frontend
npm run dev:client

# Start only backend
npm run dev:server

# Reset database (delete file, restart server)
rm server/data/sqlite.db && npm run dev:server
```

---

## Feature Roadmap

```
Phase 1: Core Features (Current)
├── ✅ Authentication
├── ✅ Student Chat
├── ✅ Teacher Dashboard
├── ✅ Multi-School Architecture
├── ✅ Lesson Creation & Personalization
├── ✅ Homework Assignment & Personalization
├── 🔄 Student Profiles
└── 🔄 Teacher AI Assistant

Phase 2: Analytics & Insights
├── ⬜ Struggle Detection
├── ⬜ Learning Analytics Dashboard
├── ⬜ Progress Reports
└── ⬜ Intervention Alerts

Phase 3: Classroom Management
├── ⬜ Classroom CRUD
├── ⬜ Student Enrollment
├── ⬜ Assignment Tracking
└── ⬜ Grade Book

Phase 4: Multi-Tenant Features
├── ⬜ School Admin Portal
├── ⬜ School Settings/Branding
├── ⬜ Subscription Management
└── ⬜ Cross-School Teacher Assignment

Phase 5: Advanced Features
├── ⬜ Email Notifications
├── ⬜ PDF Export
├── ⬜ Mobile App
└── ⬜ Parent Portal
```

Legend: ✅ Done | 🔄 In Progress | ⬜ Not Started

---

## Context for AI Agents

When starting a new session, the AI should:

1. Read this JOURNAL.md first to understand current state
2. Check ARCHITECT.md for system design questions
3. Check SCHEMA.md before modifying database
4. Check CLAUDE.md for coding guidelines and Socratic Directive
5. Run `npm run dev` if servers aren't running

The Socratic Prime Directive (from CLAUDE.md) MUST be preserved in all student-facing AI code.
