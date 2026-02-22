# JOURNAL.md - Academio Development Progress Log

> **Purpose:** Track development progress, decisions made, and next steps for context continuity.
> **Last Updated:** 2026-02-22
> **Archive:** Entries older than 3 days → HISTORY.md

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
- [x] Homework/Lesson creation with AI generation (state machine + live streaming)
- [x] Streaming content generation (real-time token display)
- [x] Dual-model strategy (reasoner for master, chat for personalization)
- [x] Liquid Glass UI design system
- [x] SQLite database with seeded demo data (20 users)
- [x] DeepSeek Cloud API (primary) / Ollama (fallback)
- [x] File upload support (PDF, images)
- [x] **Interactive Lesson Chat**: Students chat with AI tutor within lesson context
- [x] **Structured Homework Forms**: Question cards with answer submission
- [x] **AI Grading Suggestions**: Teacher sees AI-suggested grades and feedback
- [x] **Teacher Lesson Chat Oversight**: View student's lesson chat histories
- [x] **es-MX Localization**: Full Mexican Spanish translations for all features
- [x] **JSON Homework Mandate**: Reliable question extraction via structured JSON
- [x] **On-Demand Lesson Personalization**: Students trigger AI personalization; teacher side no longer auto-runs mass personalization
- [x] **LessonCreator State Machine**: `idle→generating→editing→assigned` flow with SmartMarkdown reader

### What's In Progress
- [ ] Student profile detailed view (teacher side)
- [ ] Teacher AI assistant for material generation
- [ ] Exit Ticket frontend UI (LessonChatInterface.tsx integration)

### Recently Completed
- [x] **Phase 1.5: Pedagogical Grounding Audit** — 23/23 assertions green, 1.20× multiplier fix, test script (2026-02-22)
- [x] **Pedagogical Data Engineering** — Multi-Dimensional Struggle Matrix, Rubric Grading, Exit Ticket (2026-02-21)
- [x] **Lecciones Module Refactor — On-Demand Personalization** (2026-02-21)
- [x] **Documentation refactor** — CLAUDE.md pruned to <30k chars, DESIGN.md created, HISTORY.md created (2026-02-21)
- [x] Interactive Lesson Chat & Homework Form Systems (2026-02-09)
- [x] Teacher Grading with AI Suggestions (2026-02-09)

### Known Issues
- Sharp library not available (using fallback image processing)
- Legacy tables (students, teachers) still exist for backward compatibility

### Auth/JWT Checklist (Review Before Adding New Routes)
- [ ] Does the route need authentication? Add `authMiddleware`
- [ ] Is it teacher-only? Add `teacherOnly` middleware after `authMiddleware`
- [ ] Is it student-only? Add `studentOnly` middleware after `authMiddleware`
- [ ] Is it registered in `permissionRegistry.ts`? (Returns 403 if missing)
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
7. Learning analytics dashboard

### Low Priority
8. Export features (PDF reports)
9. Email notifications
10. Mobile responsive improvements

---

## Progress Log

> Entries older than 3 days (before 2026-02-18) are in HISTORY.md.

---

### 2026-02-22

#### Phase 1.5: Pedagogical Grounding Audit

- **What was done:**
  - Fixed `the-academic-challenger` developmental multiplier: **1.10× → 1.20×** in `analytics.service.ts`
  - Created `server/src/utils/test-pedagogical-grounding.ts` — 23-assertion audit script
  - Added `test:pedagogical` npm script to `server/package.json`
  - Updated `ARCHITECT.md` with full mathematical formulas (Struggle Matrix, Rubric, Exit Ticket)
  - Added "Pedagogical Grading Directive" section to `CLAUDE.md`

- **Test Results (all green):**
  | Test | Result | Assertions |
  |------|--------|-----------|
  | Struggle Matrix (17yo, 3 surface qs) | ✓ PASS | 8/8 |
  | Rubric Grading (correct answer + no reasoning → 56/100) | ✓ PASS | 8/8 |
  | Exit Ticket flow (pass → viewed_at set, fail → null) | ✓ PASS | 7/7 |
  | **Total** | **✓ 23/23** | |

- **Mathematical proof (Test 1):**
  ```
  age=17, Preparatoria → the-academic-challenger → 1.20× multiplier
  3 × "¿Qué es...?" → socraticDepth = 1.0, rawComposite = 0.25
  composite = 0.25 × 1.20 = 0.300 ✓
  ```

- **Mathematical proof (Test 2):**
  ```
  accuracy=85 × 0.40 = 34  |  reasoning=20 × 0.40 = 8  |  effort=70 × 0.20 = 14
  finalGrade = round(34 + 8 + 14) = 56 ✓
  ```

- **Modified Files:**
  | File | Change |
  |------|--------|
  | `server/src/services/analytics.service.ts` | Fixed multiplier 1.10→1.20 for academic-challenger |
  | `server/src/utils/test-pedagogical-grounding.ts` | NEW — 23-assertion grounding audit |
  | `server/package.json` | Added `test:pedagogical` script |
  | `ARCHITECT.md` | Added Pedagogical Data Engineering section with formulas |
  | `CLAUDE.md` | Added Pedagogical Grading Directive section |
  | `JOURNAL.md` | This entry |

---

### 2026-02-21

#### Session 3: Pedagogical Data Engineering

- **What was done:**
  - Created `analytics.service.ts` — Multi-Dimensional Struggle Matrix engine
  - Refactored `homeworkGrading.service.ts` — Rubric-Based Grading (Accuracy/Reasoning/Effort)
  - Created `exitTicket.service.ts` + `exitTicket.controller.ts` — Comprehension Verification before lesson completion
  - Added DB migrations: `rubric_scores`, `struggle_dimensions`, `comprehension_score`, `exit_ticket_passed` columns
  - Updated `HomeworkGradingModal.tsx` to show rubric bars in teacher portal
  - Wired `analyticsService.calculateAndPersist()` into lesson chat message handler
  - Updated ARCHITECT.md with Rubric Logic Map and Exit Ticket flow

- **Architectural Decisions:**
  - Struggle score normalized by developmental tranche (0.70x for ages 7-9 → 1.20x for 19+)
  - Rubric weighted average: Accuracy 40% + Reasoning 40% + Effort 20%
  - Exit ticket passes at ≥ 60% comprehension; graceful auto-pass degradation on AI failure
  - `updateStruggleDimensions()` is an UPDATE (no FK violation risk even without matching row)

- **Modified Files:**
  | File | Change |
  |------|--------|
  | `server/src/database/db.ts` | Added `addRubricScoresToSubmissions()` + `addStruggleDimensionsToAnalytics()` |
  | `server/src/database/queries/analytics.queries.ts` | Added `updateStruggleDimensions()`, `updateComprehensionScore()`, `getStruggleDimensions()` |
  | `server/src/database/queries/homeworkSubmissions.queries.ts` | Added `rubric_scores` column + `RubricScores` interface |
  | `shared/types/lesson.types.ts` | Added `RubricScores`, `ExitTicketQuestion`, `ExitTicketResult`; updated `HomeworkSubmission` |
  | `server/src/services/homeworkGrading.service.ts` | Full rubric refactor; 3-dimension AI prompt |
  | `server/src/services/lessonChat.service.ts` | Wired `analyticsService.calculateAndPersist()` post-response |
  | `client/src/components/teacher/HomeworkGradingModal.tsx` | Rubric progress bars |
  | `client/src/locales/es-MX.json` | Added `grading.rubric.*` + `student.lessonChat.exitTicket.*` |
  | `server/src/middleware/permissionRegistry.ts` | Registered exit ticket routes |
  | `server/src/routes/studentPortal.routes.ts` | Added exit ticket routes |

- **New Files:**
  | File | Purpose |
  |------|---------|
  | `server/src/services/analytics.service.ts` | Multi-Dimensional Struggle Matrix |
  | `server/src/services/exitTicket.service.ts` | Exit Ticket AI generation + evaluation |
  | `server/src/controllers/exitTicket.controller.ts` | Exit ticket HTTP handlers |

---

#### Session 1: Lecciones Module Refactor — On-Demand Personalization

- **What was done:**
  - Refactored the Lecciones feature to remove teacher-side mass personalization and implement student-triggered on-demand AI personalization instead.
  - Redesigned `LessonCreator.tsx` (Teacher Portal) with a state machine pattern.
  - Updated `LessonChatInterface.tsx` (Student Portal) to show `masterContent` by default with a "Personalizar mi lección" button.
  - Added server-side `distributeToStudents()` and `personalizeOnDemand()` methods.
  - Added `POST /api/student/lesson-chat/:lessonId/personalize` endpoint.

- **Architectural Decision: Remove Mass Personalization**
  - **Before:** Teacher assigns → AI immediately generates N personalized versions (slow, costly).
  - **After:** Teacher assigns → `distributeToStudents()` creates rows with `masterContent` (instant). Student clicks "Personalizar" → `personalizeOnDemand()` runs AI on demand.
  - **Why:** Better UX, lower AI cost, respects student agency.

- **Phase 1 — Teacher Portal: LessonCreator.tsx Refactor**

  | Before | After |
  |--------|-------|
  | Simple form with `generateForStudents` checkbox | State machine: `idle → generating → editing → assigned` |
  | "Crear lección" button | Two-step: "Generar con IA" → "Asignar a estudiantes" |
  | No content preview | Live streaming preview → SmartMarkdown reader |
  | Options card with auto-personalize | Removed entirely |

- **Phase 2 — Student Portal: LessonChatInterface.tsx**

  | Before | After |
  |--------|-------|
  | Shows `lesson.content` (personalizedContent) | Shows `masterContent` by default |
  | No personalization trigger | "Personalizar mi lección" button with specular highlight |

- **Phase 3 — Backend: New Service Methods**

  - `distributeToStudents(lessonId, classroomId?, teacherId?)`: Creates `personalized_lessons` rows with `masterContent`. Skips existing.
  - `personalizeOnDemand(personalizedLessonId, studentId)`: Validates ownership, runs AI, updates row.
  - `getPersonalizedById(id)` + `updatePersonalizedContent(id, content)` added to `lessons.queries.ts`.

- **Modified Files:**

  | File | Change |
  |------|--------|
  | `client/src/components/teacher/LessonCreator.tsx` | Full rewrite — state machine, streaming preview, SmartMarkdown reader |
  | `client/src/components/student/LessonChatInterface.tsx` | masterContent default, Personalizar button, AnimatePresence badge |
  | `client/src/hooks/useLessonChat.ts` | Added `isPersonalizing`, `personalizeLesson()` |
  | `client/src/locales/es-MX.json` | Removed `autoPersonalize`, added `assignLesson`, `personalizeLesson`, etc. |
  | `shared/types/lesson.types.ts` | Added `masterContent?` to `LessonChatResponse.lesson` |
  | `server/src/services/lesson.service.ts` | Added `distributeToStudents()`, `personalizeOnDemand()` |
  | `server/src/database/queries/lessons.queries.ts` | Added `getPersonalizedById()`, `updatePersonalizedContent()` |
  | `server/src/controllers/lessonChat.controller.ts` | Added `masterContent` to response; added `personalizeLesson` handler |
  | `server/src/routes/studentPortal.routes.ts` | Added `POST /lesson-chat/:lessonId/personalize` route |

#### Session 2: Documentation Refactor

- Pruned `CLAUDE.md` from 56k chars to under 30k — behavioral instructions only
- Created `DESIGN.md` — Liquid Glass design system reference
- Created `HISTORY.md` — archived entries from 2026-02-07/08/09
- Moved Teacher Interface file trees + SQL schemas + API tables to `ARCHITECT.md`
- Updated `ARCHITECT.md` with full Project File Structure and On-Demand Personalization flow diagram

---

## Decisions Made

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-21 | On-demand personalization instead of mass generation | Better UX, lower cost, student agency |
| 2026-02-21 | CLAUDE.md < 30k chars maintenance rule | Keep AI context efficient |
| 2026-02-08 | JWT tokens in localStorage | Simple client-side storage, works across tabs |
| 2026-02-08 | `optionalAuth` middleware for chat | Allows personalization when logged in |
| 2026-02-08 | Auth headers in SSE fetch (not EventSource) | EventSource doesn't support custom headers |
| 2026-02-07 | Multi-school architecture with `schools` table | Enable SaaS multi-tenancy |
| 2026-02-07 | Shadow columns (user_id + student_id) | Smooth migration without breaking existing data |
| 2026-02-07 | SSE for AI streaming | Simpler than WebSockets for unidirectional data |

---

## Notes & Blockers

### Active Blockers
- None currently

### Notes for Future Sessions
- The `students` and `teachers` tables are legacy — new code should use `users` table
- System prompt for student AI is at `server/data/system-prompt.txt`
- System prompt for teacher AI is at `server/data/teacher-system-prompt.txt`
- All new routes MUST be registered in `server/src/middleware/permissionRegistry.ts`

### Demo Credentials (all passwords: `password123`)
- Teachers: `sarah.johnson@academio.edu`, `david.kim@academio.edu`
- Students: `emma.rodriguez@student.academio.edu`, `alex.turner@student.academio.edu`, plus 14 more

---

## Feature Roadmap

```
Phase 1: Core Features (Current)
├── ✅ Authentication
├── ✅ Student Chat
├── ✅ Teacher Dashboard
├── ✅ Multi-School Architecture
├── ✅ Lesson Creation & Personalization (On-Demand)
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
└── ⬜ Subscription Management

Phase 5: Advanced Features
├── ⬜ Email Notifications
├── ⬜ PDF Export
└── ⬜ Mobile App
```

Legend: ✅ Done | 🔄 In Progress | ⬜ Not Started

---

## Context for AI Agents

When starting a new session, the AI should:

1. Read this JOURNAL.md first to understand current state
2. Check ARCHITECT.md for system design questions
3. Check SCHEMA.md before modifying database
4. Check CLAUDE.md for coding guidelines and Socratic Directive
5. Check DESIGN.md before modifying any UI/glass components
6. Run `npm run dev` if servers aren't running

The Socratic Prime Directive (from CLAUDE.md) MUST be preserved in all student-facing AI code.
