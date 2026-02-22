# HISTORY.md - Academio Archived Development Log

> **Purpose:** Archive of JOURNAL.md entries older than 3 days.
> Active log → see JOURNAL.md

---

## 2026-02-09

### Session 1: Interactive Lesson Chat & Homework Form Systems

- **What was done:**
  - Implemented complete interactive lesson chat system with Socratic AI tutoring
  - Created structured homework form with question cards and answer submission
  - Added AI-powered grading suggestions for teacher review
  - Built teacher oversight features to view student lesson chat histories
  - Full es-MX (Mexican Spanish) localization for all new features

- **Major Features Implemented:**

  | Feature | Description |
  |---------|-------------|
  | Lesson Chat Interface | Full-screen chat within lesson context, AI uses Socratic method |
  | Homework Form | Question cards parsed from content, structured answer collection |
  | AI Grading | Automatic grade/feedback suggestions when student submits |
  | Teacher Grading | Modal with student answers, AI suggestions, manual override |
  | Lesson Chat Oversight | Teachers can view students' lesson chat histories |

- **New Database Tables:**
  ```sql
  lesson_chat_sessions   -- One per student per lesson
  lesson_chat_messages   -- Chat messages with role, content, timestamp
  homework_submissions   -- Structured answers + grading fields
  ```

- **New API Endpoints:**

  | Endpoint | Method | Description |
  |----------|--------|-------------|
  | `/api/student/lesson-chat/stream` | GET | SSE streaming lesson chat |
  | `/api/student/lesson-chat/:lessonId` | GET | Get session + messages |
  | `/api/student/homework/:id/submit` | POST | Submit homework answers |
  | `/api/teacher/homework/pending` | GET | Pending submissions |
  | `/api/teacher/homework/submissions/:id/grade` | PUT | Grade submission |
  | `/api/teacher/students/:id/lesson-chats` | GET | Student's lesson chats |

- **Files Created:**
  | File | Type |
  |------|------|
  | `server/src/database/queries/lessonChat.queries.ts` | Backend |
  | `server/src/database/queries/homeworkSubmissions.queries.ts` | Backend |
  | `server/src/services/lessonChat.service.ts` | Backend |
  | `server/src/services/homeworkGrading.service.ts` | Backend |
  | `server/src/controllers/lessonChat.controller.ts` | Backend |
  | `server/src/controllers/homeworkSubmission.controller.ts` | Backend |
  | `client/src/hooks/useLessonChat.ts` | Frontend |
  | `client/src/hooks/useHomeworkForm.ts` | Frontend |
  | `client/src/components/student/LessonChatInterface.tsx` | Frontend |
  | `client/src/components/student/HomeworkFormContainer.tsx` | Frontend |
  | `client/src/components/student/HomeworkQuestionCard.tsx` | Frontend |
  | `client/src/components/teacher/HomeworkSubmissionsTab.tsx` | Frontend |
  | `client/src/components/teacher/HomeworkGradingModal.tsx` | Frontend |
  | `client/src/components/teacher/StudentLessonChats.tsx` | Frontend |
  | `client/src/components/teacher/LessonChatViewer.tsx` | Frontend |

- **Files Modified:**
  | File | Change |
  |------|--------|
  | `server/src/database/schema.sql` | Added 3 new tables + indexes |
  | `server/src/routes/studentPortal.routes.ts` | Added lesson chat + homework submit routes |
  | `server/src/routes/teacher.routes.ts` | Added grading + oversight routes |
  | `shared/types/lesson.types.ts` | Added lesson chat + homework types |
  | `client/src/components/student/MyLessons.tsx` | Navigate to full-screen chat |
  | `client/src/components/student/MyHomework.tsx` | Navigate to full-screen form |
  | `client/src/pages/StudentDashboard.tsx` | Added nested routes |
  | `client/src/locales/es-MX.json` | Added all new translation keys |

---

## 2026-02-08

### Session 5: Customization Loop Optimization

- **What was done:**
  - Implemented `Promise.all()` for concurrent personalization (parallel API calls)
  - Added streaming endpoints for real-time content generation
  - Upgraded to Socratic personalization prompts with analogies and reflection questions
  - Implemented dual-model strategy: `deepseek-reasoner` for master content, `deepseek-chat` for personalization
  - Added progress tracking for long-running personalization tasks

- **Performance Improvements:**
  - **Before:** Sequential personalization (10 students = 10x API call time)
  - **After:** Parallel personalization with `Promise.all()` (~10x faster)
  - **Streaming:** Content appears token-by-token in UI instead of waiting for full response

- **New Endpoints:**
  | Endpoint | Method | Description |
  |----------|--------|-------------|
  | `/api/lessons/generate-content/stream` | GET | SSE streaming for lesson content |
  | `/api/lessons/:id/progress` | GET | Check personalization progress |
  | `/api/homework/generate-content/stream` | GET | SSE streaming for homework content |
  | `/api/homework/:id/progress` | GET | Check personalization progress |

- **Files Modified:**
  | File | Change |
  |------|--------|
  | `server/src/services/lesson.service.ts` | Added streaming, Promise.all, progress tracking |
  | `server/src/services/homework.service.ts` | Added streaming, Promise.all, progress tracking |
  | `server/src/services/ollama.service.ts` | Added `ModelType` export and model selection |
  | `client/src/services/lessonApi.ts` | Added streaming and progress methods |
  | `client/src/components/teacher/LessonCreator.tsx` | Updated to use streaming |
  | `client/src/components/teacher/HomeworkCreator.tsx` | Updated to use streaming |

---

### Session 4: DeepSeek Cloud API Integration

- **What was done:**
  - Switched from Ollama (local) to DeepSeek Cloud API (2-5 sec vs 30-60 sec)
  - Created unified AI service supporting both providers
  - Added environment variable configuration for provider selection

- **Files Modified:**
  | File | Change |
  |------|--------|
  | `server/src/services/ollama.service.ts` | Rewrote as unified AIService |
  | `server/src/config/index.ts` | Added `aiProvider`, `deepseek` config sections |

---

### Session 3: Stale Token Bug Fix

- **Root Cause:** Old token was included in login request headers; login/register now explicitly clears token BEFORE making the request.

- **Files Modified:**
  | File | Change |
  |------|--------|
  | `client/src/services/authApi.ts` | Clear token before login/register |
  | `client/src/services/lessonApi.ts` | Add client-side role validation |

---

### Session 2: Authentication & Session Persistence Fixes

- **Root Causes:**
  1. `lessonApi.ts` wasn't including JWT token in requests
  2. `rowToProfile()` returned `undefined` for empty arrays instead of `[]`
  3. Sessions weren't linked to authenticated users

- **Files Modified:**
  | File | Change |
  |------|--------|
  | `server/src/routes/session.routes.ts` | Added `authMiddleware` to all session routes |
  | `server/src/controllers/session.controller.ts` | Pass `userId`/`schoolId`, verify ownership |
  | `client/src/services/api.ts` | Added `getAuthHeaders()` |
  | `client/src/hooks/useChat.ts` | Added JWT token to SSE fetch requests |
  | `client/src/services/lessonApi.ts` | Fixed token inclusion |

- **Login Credentials (all passwords: `password123`):**
  - Teachers: `sarah.johnson@academio.edu`, `david.kim@academio.edu`
  - Students: `emma.rodriguez@student.academio.edu`, `alex.turner@student.academio.edu`, plus 14 more

---

### Session 1: Homework & Lesson Personalization System Complete

- Verified full implementation of AI-powered content personalization pipeline
- Confirmed teacher-side workflow: LessonCreator, HomeworkCreator
- Confirmed student-side workflow: MyLessons, MyHomework tabs in StudentDashboard
- All API endpoints verified and working

---

## 2026-02-07

### Session 2: Multi-School Architecture Migration

- **What was done:**
  - Added `schools` table for multi-tenancy support
  - Added `school_memberships` table for user-school relationships with roles
  - Added `school_id` column to: users, classrooms, student_profiles, sessions, lessons, homework_assignments
  - Added `user_id` shadow columns to legacy tables
  - Created migration function in `db.ts` to automatically migrate existing data

- **Database changes:**
  - Schema version: v2.0 (Multi-school architecture)
  - All existing data auto-migrated to "Academio Demo School"
  - Shadow columns maintained for backward compatibility

- **Files Modified/Created:**
  - `server/src/database/schema.sql` — New tables and columns
  - `server/src/database/queries/schools.queries.ts` — NEW
  - `shared/types/school.types.ts` — NEW
  - `shared/types/auth.types.ts` — Added `schoolId` to `User`, `JwtPayload`

---

### Session 1: Documentation Setup

- Created ARCHITECT.md, SCHEMA.md, JOURNAL.md
- Verified development servers running correctly

- **Demo credentials:**
  - Teacher: `sarah.johnson@academio.edu` / `password123`
  - Student: `emma.rodriguez@student.academio.edu` / `password123`
