# Development Journal

> **Purpose:** This file tracks significant development changes, decisions, and milestones for the Academio project.

---

## 2026-02-09: Classroom Management & Content Targeting

### Summary
Implemented classroom management features for the Teacher Portal, allowing teachers to:
- Create and manage classrooms (groups of students by subject/class)
- Assign/unassign students to classrooms
- Target lessons and homework to specific classrooms
- Personalize content only for students in the selected classroom

### Changes Made

#### Database
- Added `classroom_id` column to `lessons` table
- Added `classroom_id` column to `homework_assignments` table
- Created migration function `addClassroomColumns()` for existing databases
- Added indexes for classroom filtering performance

#### Backend API
- **Classroom Routes** (`/api/classroom`):
  - `POST /` - Create classroom
  - `PUT /:id` - Update classroom
  - `DELETE /:id` - Delete classroom

- **Teacher Routes** (`/api/teacher/classrooms`):
  - Updated to support JWT authentication
  - CRUD operations for classroom management

- **Lesson/Homework Services**:
  - `createLesson()` and `createHomework()` accept `classroomId`
  - `personalizeForStudentsInClassroom()` filters students by classroom

#### Frontend
- **ClassroomManager.tsx**: New component for classroom CRUD
  - Grid view of classrooms with student counts
  - Create Classroom modal
  - Assign Students modal

- **TeacherDashboard.tsx**:
  - Added "Classrooms" tab to sidebar navigation
  - Integrated ClassroomManager component

- **LessonCreator.tsx & HomeworkCreator.tsx**:
  - Added classroom selector dropdown
  - Teachers can target content to specific classrooms

### Technical Decisions
1. **Migration Safety**: The `addClassroomColumns()` function checks if tables/columns exist before modifying, ensuring safe migrations on both new and existing databases.

2. **Dual Auth Support**: Teacher routes support both JWT tokens and legacy password auth for backwards compatibility.

3. **Personalization Filtering**: When a lesson/homework has a `classroomId`, only students in that classroom receive personalized content. If `classroomId` is null, all students receive personalization.

### Testing Verified
- Classroom CRUD via API
- Student assignment to classrooms
- Lesson creation with classroom targeting
- Homework creation with classroom targeting
- Personalization filtering by classroom

---

## 2026-02-08: Student AI Tutor Chat Interface Enhancement

### Summary
Enhanced the student chat interface with interactive topic selection, suggested prompts, and sidebar integration.

### Changes Made
- Made topic boxes clickable to create sessions
- Added `SuggestedPrompts.tsx` component with topic-specific prompts
- Added `suggestedPrompts.ts` data file with prompts, greetings, and topic info
- Enhanced `ChatCanvas.tsx` with interactive welcome screen
- Added TopicSelector and ChatHistory to student sidebar

---

## 2026-02-08: DeepSeek Cloud API Integration

### Summary
Switched from local Ollama to DeepSeek Cloud API for faster AI responses.

### Changes Made
- Added DeepSeek Cloud API support in `ollama.service.ts`
- Configured dual-provider system (DeepSeek primary, Ollama fallback)
- Environment variables: `AI_PROVIDER`, `DEEPSEEK_API_KEY`

---

## 2026-02-08: JWT Authentication System

### Summary
Implemented JWT-based authentication with role-based access control.

### Changes Made
- Added `auth.middleware.ts` with JWT verification
- Created `AuthContext.tsx` for React auth state
- Implemented login/register flows
- Added teacher and student role protection

---

## 2026-02-08: Multi-School Architecture

### Summary
Added support for multiple schools with isolated data.

### Changes Made
- Created `schools` table
- Added `school_id` to all relevant tables
- Created `school_memberships` for user-school relationships
- Migration script for existing single-school data
