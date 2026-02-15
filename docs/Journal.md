# Development Journal

> **Purpose:** This file tracks significant development changes, decisions, and milestones for the Academio project.

---

## 2026-02-15: Focus Mode UI, Pedagogical Personas & Multi-Teacher Selection

### Summary
Major UI/UX transformation implementing "Focus Mode" for lessons and homework following the Liquid Glass (2026) design system. Also added Pedagogical Persona system for age-adaptive AI interactions, multi-teacher selection for students, and grade-level specific suggested prompts.

### Focus Mode UI Transformation

#### LessonChatInterface.tsx - 60/40 Split Layout
- **Left Pane (60%)**: Educational Reader with `GlassCard variant="elevated"` and xl backdrop blur
- **Right Pane (40%)**: Socratic Sidekick chat interface
- **Specular Highlights**: `useSpecularHighlight` hook applied to reader surface
- **Responsive Design**: Stacks vertically on tablets (`lg:flex-row`)
- **AnimatePresence**: Smooth morphing transitions between dashboard and reader

#### HomeworkFormContainer.tsx - Centered Question Stack
- **Single-column layout**: `max-width: 800px` to prevent eye strain
- **Visual Progress Bar**: Gradient bar at top + circular progress indicator in header
- **Collapsible Instructions**: Smart instructions card with show/hide toggle
- **Enhanced Loading States**: Glass-styled loading indicators

#### HomeworkQuestionCard.tsx - Enhanced Question Cards
- **GlassCard variant="elevated"**: Distinct glass surfaces with xl blur
- **Primary Focus Ring**: `focus:ring-emerald-400/60` on all inputs
- **Progress Indicator**: Left-edge gradient bar (emerald→blue when answered)
- **Visual Feedback**: Checkmark overlay, ring highlight, gradient corner decorations
- **Character Counter**: Live character count for textarea inputs

#### SmartMarkdown.tsx - Enhanced Typography
- **Focus Variant**: 1.8 line-height, 1.5rem paragraph spacing
- **Analogy Boxes**: Blockquotes styled with gradient backgrounds and 💡 icon for Socratic content
- **Key Vocabulary**: Bold text with emerald glow effect
- **Headers**: Border-bottom styling in Focus Mode

### Pedagogical Persona System

Added 5 age-adapted AI personas in `aiGatekeeper.service.ts`:

| Persona | Age | Grade | Tone |
|---------|-----|-------|------|
| El Explicador | 7-9 | 1º-3º Primaria | Simple, visual, celebratory |
| El Motivador | 10-12 | 4º-6º Primaria | Energetic, detective-like |
| El Mentor | 13-15 | Secundaria | Respectful, real-world |
| El Retador | 16-18 | Preparatoria | Intellectually challenging |
| El Colega | 19+ | Universidad | Academic peer |

**Implementation**: `getPedagogicalPersona(age, gradeLevel)` function returns persona with full Spanish system prompt segment. Priority: gradeLevel > age.

**Used by**: `lessonChat.service.ts`, `lesson.service.ts`, `homework.service.ts`, `homeworkGrading.service.ts`

### Multi-Teacher Selection

Students can now select multiple teachers instead of just one.

#### Database Changes
- Added `teacher_ids TEXT` column to `student_profiles` (JSON array)
- Migration function `addTeacherIdsColumn()` in `db.ts`
- Backwards compatible with single `teacher_id`

#### API Changes
- New endpoint: `PUT /api/student/teachers` with `{ teacherIds: string[] }`
- Updated `studentProfiles.queries.ts` with `setTeachers()` method
- `getByTeacherId()` now checks both `teacher_id` and `teacher_ids` array

#### Frontend Changes
- `FindTeacher.tsx`: Complete rewrite with toggle selection UI
- Checkboxes for multi-select, click to add/remove
- Shows "Your Teachers" section with count

### Grade-Level Specific Prompts

#### SuggestedPrompts.tsx
- Added `getEducationalTier()` function to map gradeLevel to tier
- Fetches grade-specific prompts with fallback to default

#### es-MX.json Structure
```json
"suggestedPrompts": {
  "primaria": { "math": [...], "science": [...], ... },
  "secundaria": { "math": [...], ... },
  "preparatoria": { "math": [...], ... },
  "universidad": { "math": [...], ... },
  "default": { "math": [...], ... }
}
```

### CSS Additions (index.css)
- `.focus-content`: Line-height 1.8, enhanced paragraph spacing
- `.analogy-box`: Gradient backgrounds for Socratic context
- `.key-term`: Emerald glow effect for vocabulary
- `.focus-input`: Primary focus ring styling
- `.focus-reader`: Specular highlight base
- Responsive tablet stacking rules

### Bug Fixes
- Fixed `sessions.queries.ts` foreign key constraint error (was setting `student_id` to `userId` instead of `null`)

### Files Changed (23 files, +2050/-726 lines)
- `client/src/components/student/LessonChatInterface.tsx`
- `client/src/components/student/HomeworkFormContainer.tsx`
- `client/src/components/student/HomeworkQuestionCard.tsx`
- `client/src/components/shared/SmartMarkdown.tsx`
- `client/src/components/student/FindTeacher.tsx`
- `client/src/components/student/StudentSettings.tsx`
- `client/src/components/chat/SuggestedPrompts.tsx`
- `client/src/index.css`
- `client/src/locales/es-MX.json`
- `client/src/services/studentApi.ts`
- `server/src/services/aiGatekeeper.service.ts`
- `server/src/services/lessonChat.service.ts`
- `server/src/services/lesson.service.ts`
- `server/src/services/homework.service.ts`
- `server/src/services/homeworkGrading.service.ts`
- `server/src/controllers/studentPortal.controller.ts`
- `server/src/routes/studentPortal.routes.ts`
- `server/src/database/queries/studentProfiles.queries.ts`
- `server/src/database/queries/sessions.queries.ts`
- `server/src/database/schema.sql`
- `server/src/database/db.ts`
- `server/src/types/index.ts`
- `shared/types/studentProfile.types.ts`

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
