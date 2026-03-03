# JOURNAL.md - Academio Development Progress Log

> **Purpose:** Track current state, active decisions, and next steps for context continuity.
> **Last Updated:** 2026-03-02
> **Archive:** Entries older than 3 days → see HISTORY.md

---

## Current State

### What's Working
- [x] **Student Profile Analítica Tab**: 4th tab in `StudentProfile.tsx` — per-lesson analytics (struggle score, 3 dimensions, exit ticket, rubric, grade)
- [x] **Heatmap → Profile Navigation**: clicking "Ver perfil completo →" in ClassroomInsights CellDetail teleports to Students tab, opens the student's Analítica tab automatically
- [x] **Insight Audit Persistence**: `insight_audits` table — audits stored on generation, history + by-ID retrieval endpoints live
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
- [x] **NEM 2023 Curriculum Fetcher**: git sparse-checkout downloader for CONALITEG textbooks → `server/data/curriculum/nem-2023/`
- [x] **NEM Curriculum RAG**: `curriculum_standards` ChromaDB collection wired into lesson chat — grade-filtered, concurrent retrieval, `## MARCO PEDAGÓGICO NEM` prompt injection
- [x] **Velocity Coach Directive**: Student AI refactored — three adaptive modes (Socratic / Direct+Depth-Check / Sprint), age-gated gamification (Power-Ups + Sprints)
- [x] **Architect Co-Pilot Directive**: Teacher AI refactored — zero fluff, analytics-aware, Diagnose→Prescribe→Generate protocol, 40/40/20 rubric standard
- [x] **`shared/types/velocity.types.ts`**: `VelocityMode`, `PowerUp`, `VelocitySprint`, `VelocitySessionStats`

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
1. ~~Persist insight audit results to DB~~ ✅ Done
2. ~~Student profile detail view — Analítica tab + heatmap navigation~~ ✅ Done
3. Classroom management CRUD (create/edit/delete classrooms from teacher UI)

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

### 2026-02-27

### 2026-03-02

#### Velocity Coach — Formal Seal & Prompt Deployment

- **`CLAUDE.md`** — two `> **CORE RULE — SEALED 2026-03-02:**` manifesto callouts added:
  - Velocity Coach: "Direct answers **required** after 2+ attempts, mandatory Depth-Check, gamified K-12 tone"
  - Architect Co-Pilot: "NOT Socratic. High-efficiency Architect. Diagnose → Prescribe → Generate."
  - Fixed 3 stale "Socratic" references: hierarchy (line 297), Teacher Portal description, Teacher Portal decisions table
- **`server/data/system-prompt.txt`** — `## MANIFESTO — REGLA NUCLEAR (SELLADO 2026-03-02)` block inserted at line 3 (after identity, before language rule); runtime AI reads this on every call
- **`server/data/teacher-system-prompt.txt`** — same manifesto pattern, Architect Co-Pilot wording
- **`aiGatekeeper.service.ts`** — all 5 persona method headers renamed from `MÉTODO SOCRÁTICO [ADAPTADO|RIGUROSO|AVANZADO|ACADÉMICO]` → `MODO SOCRÁTICO (Velocity Coach — Modo Predeterminado)` — clarifies it's Mode 1 of 3, not the whole methodology
- TypeScript: ✅ 0 errors (server)

#### Velocity Engine — Hard-Wired AI Services + UI

- **`aiGatekeeper.service.ts`** — added `VelocityLeapResult` interface + `getVelocityLeapDirective(failedAttempts, persona)`:
  - Moderate threshold: 2+ failed attempts → 3-step protocol (Direct Answer → Why → Verificación de Comprensión)
  - High threshold: 4+ failed attempts → same protocol + urgent no-preamble instruction
  - Relatability Check (Verificación) format is age-gated: warm/emoji for ≤12, clinical for 13+
- **`lessonChat.service.ts`** — `buildStruggleSupportResources()` refactored:
  - Now accepts `persona` parameter and calls `getVelocityLeapDirective()` from gatekeeper
  - Velocity Leap prompt injected as Layer 1 (always); interest-based analogies remain Layer 2 (last resort)
- **`homeworkGrading.service.ts`** — Objective Feedback Loop:
  - Fetches `rubricHistory` via new `getStudentRubricAverages(studentId)` — SQLite `json_extract` AVG across past submissions
  - Fetches `recentStruggle` via new `getStudentRecentStruggle(studentId)` — most recent session's struggle_score + dimensions
  - Both injected as `AnalyticsContext` into `buildGradingPrompt()` under `## BUCLE DE RETROALIMENTACIÓN OBJETIVA`
  - AI generates comparative feedback: "dominaste Exactitud (X%) pero tu Razonamiento estuvo 2× más débil que tu promedio"
  - Analytics fetch is non-fatal — grading works normally if it fails
- **`homeworkSubmissions.queries.ts`** — added `getStudentRubricAverages(studentId)`:
  - `AVG(json_extract(rubric_scores, '$.accuracy|reasoning|effort'))` across graded submissions
- **`lessonChat.queries.ts`** — added `getStudentRecentStruggle(studentId)`:
  - Most recent session with `struggle_score IS NOT NULL`, returns composite + 3 dimensions
- **`SmartMarkdown.tsx`** — Velocity Streak badge:
  - New `velocityStreak?: number` prop
  - `VelocityStreakBadge` component renders above content when `velocityStreak >= 3`
  - 3–4: amber "⚡ Racha de Velocidad · N"; 5+: orange-red "🔥 Racha de Fuego · N"
  - Glass design system consistent (backdrop-blur, gradient border, w-fit pill)
- TypeScript: ✅ 0 errors (client + server)

#### Student Profile Analítica Tab + Heatmap Navigation

- **`shared/types/student.types.ts`** — added `StudentLessonAnalytic` interface (per-lesson analytics shape)
- **`server/src/database/queries/studentStats.queries.ts`** — added `getStudentLessonAnalytics(studentId)`:
  - Joins `learning_analytics → lesson_chat_sessions → personalized_lessons → lessons`
  - Left-joins `homework_assignments` (via `source_lesson_id`) and `homework_submissions` for rubric/grade data
- **`server/src/controllers/student.controller.ts`** — added `getStudentLessonAnalytics()` handler:
  - Parses JSON columns (`struggle_dimensions`, `rubric_scores`) server-side
  - Converts SQLite `exit_ticket_passed` integer → boolean
- **`server/src/routes/teacher.routes.ts`** — `GET /teacher/students/:studentId/lesson-analytics`
- **`server/src/middleware/permissionRegistry.ts`** — new route registered as TEACHER
- **`client/src/services/teacherApi.ts`** — added `getStudentLessonAnalytics(studentId)`
- **`client/src/pages/TeacherPage.tsx`** — added `navStudentId` state; `handleViewStudent` now stores ID + switches tab; passed as `initialStudentId` to `StudentsView` and `onViewStudent` to `ClassroomInsights`
- **`client/src/components/teacher/ClassroomInsights.tsx`** — added `onViewStudent?` prop; "Ver perfil completo →" pill button appears at bottom of CellDetail when a cell is selected
- **`client/src/components/teacher/StudentsView.tsx`** — added `initialStudentId` + `onStudentCleared` props; `fromInsights` flag passes `initialTab='analytics'` to `StudentProfile`
- **`client/src/components/teacher/StudentProfile.tsx`** — 4th "Analítica" tab:
  - `initialTab?: TabType` prop (defaults to 'learningContext')
  - Lazy-loads analytics on first tab activation via `GET .../lesson-analytics`
  - `AnalyticsTab` + `LessonAnalyticCard` components: struggle bar, 3 dimension mini-bars, exit ticket badge, rubric grid, grade chip
- **`client/src/locales/es-MX.json`** — added `teacher.studentProfile.tabs.analytics`, `teacher.studentProfile.analytics.*`, `teacher.insights.detail.viewFullProfile`
- TypeScript: ✅ 0 errors (client + server)

#### Insight Audit Persistence

- **`shared/types/insight.types.ts`** — added `SnapshotSummary` + `StoredDiagnosticAudit extends DiagnosticAudit`:
  - `SnapshotSummary`: `{ studentCount, lessonCount, avgStruggleScore, topCluster }`
  - `StoredDiagnosticAudit`: extends `DiagnosticAudit` with `id`, `classroomId`, `teacherId`, `snapshotSummary`
- **`server/src/database/db.ts`** — `addInsightAuditsTable()` migration:
  - Creates `insight_audits` table (idempotent — skips if exists)
  - Columns: `id, classroom_id, teacher_id, generated_at, root_cause, failure_type, severity, bridge_activity, recommendations (JSON), snapshot_summary (JSON)`
  - Index: `idx_insight_audits_classroom` on `(classroom_id, generated_at DESC)` for fast history queries
  - Called in `initializeDatabase()` before schema execution
- **`server/src/database/queries/insightAudits.queries.ts`** — NEW FILE:
  - `create(classroomId, teacherId, audit, snapshotSummary)` → `StoredDiagnosticAudit`
  - `getByClassroom(classroomId, limit=20)` — most recent first
  - `getById(id)` — nullable return
- **`server/src/services/insightEngine.service.ts`** — `generateDiagnosticAudit()` updated:
  - Now accepts `teacherId` parameter
  - Computes `SnapshotSummary` from snapshot (worst cluster = highest avgStruggleScore)
  - Persists via `insightAuditsQueries.create()` after AI generates the audit
  - Returns `StoredDiagnosticAudit` (includes `id` for future retrieval)
  - Added `getAuditHistory(classroomId, limit)` and `getAuditById(id)` service methods
- **`server/src/controllers/insightEngine.controller.ts`** — `generateAudit()` passes `teacherId`; added `getAuditHistory()` and `getAuditById()` handlers
- **`server/src/routes/teacher.routes.ts`** — 2 new GET routes:
  - `GET /classrooms/:classroomId/insights/audits` — history list
  - `GET /classrooms/:classroomId/insights/audits/:auditId` — single audit
- **`server/src/middleware/permissionRegistry.ts`** — both new routes registered as `TEACHER`
- TypeScript: ✅ 0 errors (client + server)

#### High-Velocity Pedagogy Refactor

- **CLAUDE.md**: Replaced `## THE SOCRATIC PRIME DIRECTIVE` with two new directives:
  - `## THE VELOCITY COACH DIRECTIVE (Student AI)`: Three-mode table, gamification layer, required/forbidden behavior tables, three example interactions
  - `## THE ARCHITECT CO-PILOT DIRECTIVE (Teacher AI)`: Core rules table, Contextual Feedback Protocol (3 steps), 40/40/20 output standard
- **`server/data/system-prompt.txt`**: Complete rewrite — Velocity Coach runtime prompt:
  - Three adaptive modes (Socrático / Directo+Depth-Check / Sprint)
  - Age-gated gamification: emojis + Power-Up/Sprint for ≤12; clean professional notation for 13+
  - Depth-Check format: `"[Respuesta]. [Por qué]. Ahora dime: [verificación]"`
- **`server/data/teacher-system-prompt.txt`**: Complete rewrite — Architect Co-Pilot runtime prompt:
  - Contextual Feedback Protocol: Diagnose → Prescribe → Generate (from analytics data)
  - Struggle score thresholds: >0.70 = critical, 0.40–0.70 = moderate, exit ticket <0.60 = not mastered
  - 40/40/20 rubric baked in: Exactitud 40% / Razonamiento 40% / Esfuerzo 20%
- **`lessonChat.service.ts`**: Three method rewrites:
  - `buildCoreDirective()`: Velocity Coach identity + three-mode mode-switching table
  - `buildSocraticMethodology()` (kept name): Fully rewritten as adaptive 3-mode methodology, age-differentiated
  - `buildProhibitions()`: Updated — "sin Depth-Check" replaces "sin razonamiento"; added Sprint-breaking prohibition
- **`shared/types/velocity.types.ts`**: New file — `VelocityMode`, `PowerUp`, `VelocitySprint`, `VelocitySessionStats`
- **`shared/types/index.ts`**: Exports `velocity.types.ts`
- TypeScript: ✅ 0 errors (client + server)

#### NEM Curriculum RAG — Wired into lessonChat.service.ts

- Added `getNEMContext(message, gradeLevel)` to `LessonChatService`:
  - Lazy ChromaDB init (`initNEMClient()`) — graceful degradation when unavailable
  - `resolveGradeDir()` parses student's `gradeLevel` string → `grade_dir` value for ChromaDB `$eq` filter
    - "1° de Primaria" → `01_primaria_1`; "2° de Secundaria" → `08_secundaria_2`; "Preparatoria" → null (outside NEM)
  - Embeds student's message via Ollama `qwen3-embedding`
  - Queries `curriculum_standards` with grade-scoped filter (1st grader never gets 6th grade results)
  - Filters by minimum similarity 0.25; returns null if no relevant chunks found
- Added `buildNEMFramework(chunks)` — wraps chunks in `## MARCO PEDAGÓGICO NEM` section with anti-citation-bot instructions
- Injected NEM section at position 4 in prompt hierarchy (after lesson content, before response guidelines)
- Concurrent retrieval: `Promise.all([memoryService.retrieveRelevantMemories(), getNEMContext()])` — zero added latency
- Updated `buildSystemPrompt()` log line: shows `NEM chunks: yes/no` alongside persona/struggle info

#### NEM 2023 Curriculum Acquisition Utility

- Created `server/src/utils/ingest-curriculum.ts` — PDF → chunks → embeddings → ChromaDB pipeline
  - Recursive character text splitter (1000 chars / 200 overlap)
  - Batch 50 chunks → embed via Ollama qwen3-embedding → upsert to `curriculum_standards`
  - Metadata per chunk: grade_level, subject, book_title, source_page, chunk_index
  - Deterministic chunk IDs → idempotent upserts (re-run safe)
  - `--grade` flag for per-grade pilot; `--clear` to reset collection; `--dry-run` to count chunks
- Created `server/src/utils/query-curriculum.ts` — RAG validation query tool
  - Embeds query via Ollama, retrieves top-5 similar chunks from `curriculum_standards`
  - Prints similarity score, book title, grade, subject, and page estimate per result
  - Verdict: PASSED ≥ 0.5 / PARTIAL ≥ 0.3 / WEAK < 0.3
- Added 4 npm scripts: `curriculum:ingest`, `curriculum:ingest:grade1`, `curriculum:ingest:clear`, `curriculum:query`
- Created `server/src/utils/fetch-nem-books.ts` — one-shot download + organizer script
  - Git sparse checkout (blobless clone + `--filter=blob:none`) of CONALITEG repo
  - Downloads only `Primaria/PDF/` and `Secundaria/PDF/` (~6 GB via Git LFS)
  - LFS auto-detection: samples first PDF; if pointer → runs `git lfs pull`
  - Organizes into `server/data/curriculum/nem-2023/` with 9 grade subdirs:
    `01_primaria_1` … `06_primaria_6`, `07_secundaria_1` … `09_secundaria_3`
  - Renames cryptic codes to human-readable subjects:
    `P1LPM.pdf` → `libro_para_maestros_primaria_1.pdf`
  - Cleans up temp clone after successful move; also cleans on error
  - Appends PDF-count-by-grade summary to JOURNAL.md automatically
  - `--dry-run` flag for zero-download preview
- Added `npm run curriculum:fetch`, `curriculum:fetch:dry`, `curriculum:ingest`, `curriculum:ingest:grade1`, `curriculum:ingest:clear`, `curriculum:query` to `server/package.json`
- Source: CC0-1.0 public domain (https://github.com/incognia/CONALITEG)

#### Auth & Port Hardening (earlier this session)

- Migrated client to port 5200; deleted stale session cache from SQLite
- Persistence-First auth: single `isHydrated` gate in `AuthContext` (replaces triple boolean)
- CORS: `127.0.0.1:*` added alongside `localhost:*` in dev allowlist
- `clearAuthData()` now wipes all 9 legacy localStorage keys (prevents identity contamination)
- Pinned `--config vite.config.ts` in all client npm scripts (prevents hoisting config miss)

---

### 2026-02-25

#### Analytics UPSERT Gap Fix

- **Root cause**: `learning_analytics.session_id` has `FOREIGN KEY REFERENCES sessions(id)`. `lesson_chat_sessions.id` values don't exist in `sessions` → any INSERT attempt threw `SQLITE_CONSTRAINT_FOREIGNKEY`.
- **Fix (4 files)**:
  - `db.ts`: Added `addStruggleScoreToLessonChatSessions()` migration — adds `struggle_score REAL DEFAULT 0` + `struggle_dimensions TEXT` directly to `lesson_chat_sessions`
  - `lessonChat.queries.ts`: Added `updateStruggleDimensions()` — writes to `lesson_chat_sessions` (no FK issue)
  - `analytics.service.ts`: `calculateAndPersist()` now routes by presence of `rowContext` — lesson chat sessions write to `lessonChatQueries`, legacy sessions write to `analyticsQueries`
  - `analytics.queries.ts`: `getStudentsNeedingIntervention()` now UNIONs `learning_analytics` with `lesson_chat_sessions` — teacher dashboards see struggle alerts from both chat types
- **Verified live**: Sent "no entiendo nada, me rindo" → session stored `struggle_score: 0.425`, `struggle_dimensions: {socraticDepth:1, errorPersistence:0.333, frustrationSentiment:0.333, composite:0.425}` ✅

#### Code Compression & DRY Audit (earlier this session)

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
| 2026-02-27 | `getVelocityLeapDirective()` lives in aiGatekeeper | Gatekeeper is the single source of pedagogical directives — keeps lessonChat.service lean; permits future reuse in homeworkChat |
| 2026-02-27 | Objective Feedback Loop is non-fatal | Analytics fetch wrapped in try/catch; grading never breaks due to missing struggle data |
| 2026-02-27 | `velocityStreak` is a prop, not derived from content | SmartMarkdown renders; the chat hook owns counting logic — clean separation of concerns |
| 2026-02-27 | Relatability Check = Verificación de Comprensión | Same concept as Depth-Check but named for the gatekeeper context; confirms logic, not memorization |
| 2026-02-27 | Velocity Coach replaces pure Socratic model | Pure Socratic blocks students who are genuinely stuck — 2× speed requires direct answers when needed, gated by mandatory Depth-Check |
| 2026-02-27 | Depth-Check mandatory after every direct answer | Prevents surface-level memorization; verifies real comprehension every time the AI breaks Socratic mode |
| 2026-02-27 | Age gate: 13+ gets professional gamification, ≤12 gets emoji/Power-Up | Cringe prevention for teens; energy/motivation works differently across age bands |
| 2026-02-27 | Architect Co-Pilot separate from Velocity Coach | Teacher AI is a generator (direct materials), not a tutor — different mental model, different system prompt |
| 2026-02-27 | `Promise.all` for memory + NEM retrieval | Both are independent async calls — parallelizing adds zero latency to lesson chat |
| 2026-02-27 | NEM similarity threshold 0.25 | Low enough to capture topically adjacent content; filters pure noise/unrelated chunks |
| 2026-02-27 | NEM section at prompt position 4 (after lesson content) | Treated as background knowledge, not primary content; lesson always takes precedence |
| 2026-02-27 | Anti-citation instruction baked into section | Prevents AI becoming a citation bot — NEM context enriches tone/examples, not sourced quotes |
| 2026-02-25 | Store struggle in `lesson_chat_sessions` | `learning_analytics.session_id` FK prevents lesson chat session IDs from being used there |
| 2026-02-25 | `getStudentsNeedingIntervention` UNION | Teacher alerts must span both session types |
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

# NEM Curriculum — fetch
cd server && npm run curriculum:fetch:dry  # Preview without downloading
cd server && npm run curriculum:fetch      # Full ~6 GB download (needs git-lfs)

# NEM Curriculum — ingest (requires ChromaDB + Ollama with qwen3-embedding)
cd server && npm run curriculum:ingest:grade1            # Pilot: Grade 1 only
cd server && npm run curriculum:ingest                   # All grades
cd server && npm run curriculum:query -- "texto a buscar"  # Validate RAG
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
