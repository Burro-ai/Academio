# JOURNAL.md - Academio Development Progress Log

> **Purpose:** Track current state, active decisions, and next steps for context continuity.
> **Last Updated:** 2026-02-25
> **Archive:** Entries older than 3 days → see HISTORY.md

---

## Current State

### What's Working
- [x] Authentication system (JWT-based, 7-day expiry, persistence-first)
- [x] Student portal: AI tutor chat, lesson chat, homework sidekick
- [x] Teacher dashboard: lesson & homework creation with AI streaming
- [x] Homework workflow: create → questions editor → assign → student receives
- [x] AI personalization: on-demand lesson personalization per student
- [x] Structured Homework JSON: `questions_json` column, no regex parsing
- [x] Socratic AI tutor (student) + direct assistant (teacher) — dual system prompts
- [x] DeepSeek Cloud API (primary) / Ollama (offline fallback)
- [x] RAG long-term memory via ChromaDB (graceful degradation when unavailable)
- [x] **Multi-Dimensional Struggle Matrix**: 5-dimension per-topic scoring with age normalization
- [x] **Rubric-Based AI Grading**: 40% accuracy + 40% reasoning + 20% effort
- [x] **Exit Ticket Verification**: comprehension score gating lesson completion
- [x] **Insight Engine**: classroom heatmap snapshot + diagnostic audit (AI-powered)
- [x] **Classroom Insights Panel**: teacher UI for heatmap visualization
- [x] **Homework Sidekick**: student-facing homework chat with Socratic tutoring
- [x] **Homework Question Editor**: teacher UI to edit questions before assignment
- [x] **Permission Registry**: centralized RBAC, all routes registered
- [x] **es-MX Localization**: full Mexican Spanish UI throughout
- [x] Liquid Glass design system (Apple 2026 glassmorphism)

### Known Issues
- Sharp library not available (graceful fallback to jimp)
- ChromaDB not running in dev (memory features auto-disabled)
- Legacy `students` / `teachers` tables still exist (backward compat)

### Auth/JWT Checklist (Before Adding New Routes)
- [ ] Route in `permissionRegistry.ts`?
- [ ] `authMiddleware` applied? `teacherOnly` or `studentOnly` after it?
- [ ] Frontend uses `authenticatedFetch()`? Never `authApi.getToken()` manually.
- [ ] SSE endpoint: token in fetch headers, NOT EventSource?
- [ ] Controller uses `req.user!.id` for user-scoped queries?

---

## Next Steps

### High Priority
1. Persist insight audit results to DB (currently returned but not stored)
2. Classroom management CRUD (create/edit/delete classrooms from teacher UI)
3. Student profile detail view (teacher side: grades, analytics, chat history)

### Medium Priority
4. Export features: PDF report from diagnostic audit
5. Homework submission analytics (per-question performance heatmap)
6. Parent portal (read-only view)

### Low Priority
7. Email notifications (due dates, grading)
8. Mobile responsive improvements
9. Dark / light theme toggle

---

## Progress Log

### 2026-02-25

#### Code Compression & DRY Audit (this session)

- **Phase 2 — DRY Audit: Consolidated SSE hooks**
  - Created `client/src/hooks/useAIPipe.ts` — universal SSE pipe hook
    - Shared reader loop, auth via `authenticatedFetch`, AbortController, callback refs
    - `clearResponseOnDone` flag for hooks that maintain a messages array
    - `onDone` enriches done event with `assistantMessageId` captured from `start`
  - Rewrote `useChat.ts` to use `useAIPipe` (55 → 55 lines, self-contained)
  - Rewrote `useTeacherChat.ts` to use `useAIPipe` + **fixed auth bug**
    - Bug: used `sessionStorage.getItem('teacherPassword')` as Bearer token (legacy password auth)
    - Fix: `useAIPipe` uses `authenticatedFetch` which injects JWT automatically
  - Rewrote `useLessonChat.ts` to use `useAIPipe` (eliminating 50-line duplicate loop)
  - Rewrote `useHomeworkChat.ts` to use `useAIPipe` (eliminating 50-line duplicate loop)
  - Net reduction: ~200 lines of duplicated SSE logic across 4 files → 1 shared hook

- **Phase 3 — Strict Typing**
  - Fixed `insightEngine.service.ts:381`: removed `(memoryService as any)` — method is public
  - Fixed `student.controller.ts:69`: changed `subject as any` → `subject as Subject`, added import

- **Phase 5 — Validation**
  - `tsc --noEmit` client: ✅ 0 errors
  - `tsc --noEmit` server: ✅ 0 errors

- **Bug Fix (previous session): `PUT /homework/:id/questions`**
  - `lessonApi.ts`: `{ questionsJson }` → `{ questions }` (key name mismatch)
  - Added 6 missing routes to `permissionRegistry.ts`

---

### 2026-02-22

#### Pedagogical Grounding Layer

- Implemented Multi-Dimensional Struggle Matrix (`analytics.service.ts`)
  - 5 dimensions: mastery, response_time, confidence, engagement, progression
  - Age-normalized composite score (0.70× for 7-9, 1.20× for 16+)
- Implemented Rubric-Based AI Grading (`homeworkGrading.service.ts`)
  - 40% accuracy + 40% reasoning + 20% effort; correct-only yields ~56/100
- Implemented Exit Ticket Verification (`exitTicket.service.ts`)
  - Pass threshold: 0.60 comprehension; AI failure auto-passes at 0.5
- Added 23-assertion pedagogical audit script (`test-pedagogical-grounding.ts`)

---

### 2026-02-21

#### Insight Engine & Classroom Features

- Built Insight Engine (`insightEngine.service.ts`, `insightEngine.controller.ts`)
  - `getClassroomSnapshot()`: topic × student heatmap with struggle scores
  - `generateDiagnosticAudit()`: AI-powered pedagogical diagnostic
  - `retrieveClusterMemories()`: RAG cross-student context for richer audits
- Built `ClassroomInsights.tsx` component (teacher UI: heatmap + audit panel)
- Built `useClassroomInsights.ts` hook
- Built Homework Sidekick
  - `HomeworkSidekick.tsx` (student UI: Socratic chat within homework context)
  - `useHomeworkChat.ts` hook (SSE streaming)
  - `homeworkChat.service.ts` + `homeworkChat.controller.ts` (server)
  - `homeworkChat.queries.ts` (DB queries)
- Built Homework Question Editor
  - `HomeworkQuestionsPanel.tsx` + `HomeworkQuestionEditor.tsx` (teacher UI)
  - Flow: generate → review questions → assign (questions locked after assign)
- Added `shared/types/insight.types.ts` (ClassroomSnapshot, DiagnosticAudit, etc.)

---

## Decisions Made

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-25 | `useAIPipe` with callback refs | Stable `pipe()` identity; callbacks always current |
| 2026-02-25 | `clearResponseOnDone` flag | Lesson/homework chat clears currentResponse (shows in messages array) |
| 2026-02-22 | Exit ticket pass @ 0.60 | Conservative enough to be meaningful; AI failure auto-passes at 0.5 |
| 2026-02-22 | Rubric: 40/40/20 weights | Correct answers alone ≠ learning; reasoning must be shown |
| 2026-02-21 | Questions locked after assign | Prevents retroactive changes that would confuse students |
| 2026-02-21 | On-demand personalization | Teacher side no longer runs mass personalization; student triggers it |

---

## Notes & Blockers

### Active Blockers
- None

### Useful Commands
```bash
npm run dev                           # Start both client + server
npm run dev:client                    # Frontend only
npm run dev:server                    # Backend only
npm run test:pedagogical              # 23-assertion grounding audit
npm run memory:verify                 # Check ChromaDB sync
npx tsc --noEmit -p client/tsconfig.json   # TypeScript check (client)
npx tsc --noEmit -p server/tsconfig.json   # TypeScript check (server)
```

### Auth Quick Debug
```bash
# Test login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.johnson@academio.edu","password":"password123"}'

# Test authenticated endpoint
curl http://localhost:3001/api/homework \
  -H "Authorization: Bearer <TOKEN>"
```

### Demo Credentials (all passwords: `password123`)
- Teacher: `sarah.johnson@academio.edu`, `david.kim@academio.edu`
- Students: `emma.rodriguez@student.academio.edu`, `alex.turner@student.academio.edu`
