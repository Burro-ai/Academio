# Development Journal

> **Purpose:** This file tracks significant development changes, decisions, and milestones for the Academio project.

---

## 2026-02-09: Mexican Spanish (es-MX) Internationalization

### Summary
Implemented i18n (internationalization) for the Mexican market using react-i18next. The platform now displays all UI text in Mexican Spanish while keeping the backend code entirely in English.

### Changes Made

#### New Files
- **`client/src/i18n.ts`**: i18n configuration with language detection
- **`client/src/locales/es-MX.json`**: Complete Mexican Spanish translations

#### Updated Components (i18n integration)
- `LoginPage.tsx` - Auth forms and messages
- `StudentDashboard.tsx` - Navigation and sidebar
- `TeacherDashboard.tsx` - Navigation and sidebar
- `ChatCanvas.tsx` - Welcome screen, topic selection, prompts
- `ChatInput.tsx` - Placeholder and hints
- `SuggestedPrompts.tsx` - Topic-specific prompts (from locale file)
- `TopicSelector.tsx` - Topic labels
- `ChatHistory.tsx` - History section headers
- `MyLessons.tsx` - Student lessons view
- `MyHomework.tsx` - Student homework view
- `Dashboard.tsx` (teacher) - Stats and sections
- `ClassroomManager.tsx` - Classroom CRUD forms

#### System Prompt
- **`server/data/system-prompt.txt`**: Updated to Mexican Spanish with Socratic teaching method preserved

### Translation Categories
| Category | Description |
|----------|-------------|
| `common.*` | Shared buttons, labels (Guardar, Cancelar, etc.) |
| `auth.*` | Login/register forms |
| `nav.*` | Navigation items |
| `topics.*` | Subject names (Matemáticas, Ciencias, etc.) |
| `chat.*` | Chat interface messages |
| `student.*` | Student portal sections |
| `teacher.*` | Teacher portal sections |
| `suggestedPrompts.*` | AI tutor suggested questions per topic |
| `topicGreetings.*` | Welcome messages per topic |
| `errors.*` | Error messages |

### Technical Decisions
1. **Backend unchanged**: All database columns, variables, and API routes remain in English
2. **i18next with LanguageDetector**: Auto-detects browser language, caches preference in localStorage
3. **Fallback language**: es-MX (Mexican Spanish is both default and fallback)
4. **Dynamic keys**: Topic labels and prompts use dynamic keys like `t(\`topicLabels.\${topic}\`)`
5. **Interpolation**: Date/count variables use `{{variable}}` syntax

### Mexican Terminology Used
- "Inicia sesión" instead of "Logueate"
- "Salones" for classrooms
- "Estudiantes" for students
- "Maestro" for teacher
- History prompts about Mexico (Independence heroes, Revolución Mexicana)

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
