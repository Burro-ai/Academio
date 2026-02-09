import { ollamaService, ModelType } from './ollama.service';
import { homeworkQueries } from '../database/queries/homework.queries';
import { studentProfilesQueries } from '../database/queries/studentProfiles.queries';
import { HomeworkAssignment, PersonalizationContext, StudentProfileWithUser } from '../types';

/**
 * Progress tracking for personalization
 */
export interface PersonalizationProgress {
  homeworkId: string;
  total: number;
  completed: number;
  current: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  error?: string;
}

// In-memory progress tracking (can be replaced with Redis for production)
const progressMap = new Map<string, PersonalizationProgress>();

/**
 * Socratic personalization prompt - creates tailored problems with analogies and reflection questions
 */
const SOCRATIC_PERSONALIZATION_PROMPT = `You are a Socratic tutor personalizing homework for a specific student.

## Your Task
Given the master homework and the student's profile, create a SHORT personalized addition that includes:
1. **One Interest-Based Problem**: Reframe one problem using their interests ({INTERESTS})
2. **One Reflection Question**: A Socratic question that helps them think about the "why" behind the concept

Keep it concise (2-3 short paragraphs max). Don't rewrite the whole assignment - just add the personalized touch.

## Example Output Format:
**Your Personal Challenge:**
[Problem reframed with their interest]

**Think Deeper:**
[Socratic question that makes them reflect on the underlying concept]

## Master Homework:
{MASTER_CONTENT}

## Student Profile:
- Age: {AGE}
- Interests: {INTERESTS}
- Skills to Improve: {SKILLS}
{LEARNING_STYLE}

## Personalized Addition:`;

/**
 * Few-shot prompt for generating master homework content (uses reasoner model)
 */
const MASTER_HOMEWORK_PROMPT = `You are an expert educator creating homework assignments for K-12 students.

## Example 1:
**Topic:** Multiplication Practice
**Subject:** Math
**Content:**
# Multiplication Practice Worksheet

## Part 1: Basic Multiplication (5 points each)
1. 7 × 8 = ___
2. 6 × 9 = ___
3. 12 × 5 = ___
4. 8 × 8 = ___
5. 9 × 7 = ___

## Part 2: Word Problems (10 points each)
1. A baker makes 6 trays of cookies. Each tray has 8 cookies. How many cookies in total?

2. There are 7 days in a week. How many days are in 4 weeks?

3. A classroom has 5 rows of desks with 6 desks in each row. How many desks total?

## Part 3: Challenge (15 points)
A farmer plants 8 rows of corn with 12 stalks in each row. Each stalk produces 3 ears of corn. How many ears of corn does the farmer harvest in total?

**Show your work!**

## Example 2:
**Topic:** Essay Writing: Persuasive Arguments
**Subject:** English
**Content:**
# Persuasive Essay Assignment

## Objective
Write a 3-paragraph persuasive essay on one of these topics:
- Should students have homework on weekends?
- Should school start later in the morning?
- Should students be allowed to use phones in class?

## Requirements
1. **Introduction (1 paragraph)**
   - Hook to grab attention
   - Clear thesis statement (your position)

2. **Body (1 paragraph)**
   - At least 2 supporting reasons
   - Evidence or examples for each reason

3. **Conclusion (1 paragraph)**
   - Restate your position
   - Call to action

## Rubric
- Clear thesis: 10 points
- Supporting evidence: 15 points
- Organization: 10 points
- Grammar/spelling: 5 points
- Total: 40 points

**Due date: ___________**

## Your Task:
Create a comprehensive homework assignment on the given topic. Include clear instructions, multiple problem types, and a grading rubric if appropriate.

**Topic:** {{TOPIC}}
**Subject:** {{SUBJECT}}
**Content:**`;

export const homeworkService = {
  /**
   * Get personalization progress
   */
  getProgress(homeworkId: string): PersonalizationProgress | null {
    return progressMap.get(homeworkId) || null;
  },

  /**
   * Generate master homework content using AI (streaming)
   * Uses 'reasoner' model for high-quality content generation
   */
  async *generateMasterContentStream(
    topic: string,
    subject?: string
  ): AsyncGenerator<{ text: string; done: boolean }> {
    const prompt = MASTER_HOMEWORK_PROMPT.replace('{{TOPIC}}', topic).replace(
      '{{SUBJECT}}',
      subject || 'General'
    );

    // Use reasoner model for high-quality master content
    yield* ollamaService.generateStream(prompt, undefined, undefined, 'reasoner');
  },

  /**
   * Generate master homework content using AI (non-streaming)
   * Uses 'reasoner' model for high-quality content generation
   */
  async generateMasterContent(topic: string, subject?: string): Promise<string> {
    const prompt = MASTER_HOMEWORK_PROMPT.replace('{{TOPIC}}', topic).replace(
      '{{SUBJECT}}',
      subject || 'General'
    );

    // Use reasoner model for high-quality master content
    const content = await ollamaService.generate(prompt, undefined, undefined, 'reasoner');
    return content.trim();
  },

  /**
   * Personalize homework content for a specific student (uses chat model for speed)
   */
  async personalizeContent(
    masterContent: string,
    profile: PersonalizationContext
  ): Promise<string> {
    const interests = profile.interests.length > 0 ? profile.interests.join(', ') : 'general topics';
    const skills = profile.skillsToImprove.length > 0 ? profile.skillsToImprove.join(', ') : 'general learning';

    let prompt = SOCRATIC_PERSONALIZATION_PROMPT
      .replace('{MASTER_CONTENT}', masterContent)
      .replace(/\{AGE\}/g, profile.age?.toString() || 'unknown')
      .replace(/\{INTERESTS\}/g, interests)
      .replace(/\{SKILLS\}/g, skills);

    // Add learning style if present
    if (profile.learningSystemPrompt) {
      prompt = prompt.replace(
        '{LEARNING_STYLE}',
        `- Learning Style: ${profile.learningSystemPrompt}`
      );
    } else {
      prompt = prompt.replace('{LEARNING_STYLE}', '');
    }

    // Use chat model for fast personalization
    const content = await ollamaService.generate(prompt, undefined, undefined, 'chat');
    return content.trim();
  },

  /**
   * Create a homework assignment and optionally personalize for students (in classroom or all)
   */
  async createHomework(
    teacherId: string,
    data: {
      title: string;
      topic: string;
      subject?: string;
      masterContent?: string;
      dueDate?: string;
      classroomId?: string;
      generateForStudents?: boolean;
    }
  ): Promise<HomeworkAssignment> {
    // Generate master content if not provided
    let masterContent = data.masterContent;
    if (!masterContent) {
      masterContent = await this.generateMasterContent(data.topic, data.subject);
    }

    // Create the homework
    const homework = homeworkQueries.create({
      teacherId,
      title: data.title,
      topic: data.topic,
      subject: data.subject,
      masterContent,
      dueDate: data.dueDate,
      classroomId: data.classroomId,
    });

    // Personalize for students if requested (run in background)
    if (data.generateForStudents) {
      // Don't await - let it run in background
      this.personalizeForStudentsInClassroom(homework.id, data.classroomId).catch((err) => {
        console.error('[Homework] Background personalization failed:', err);
      });
    }

    return homework;
  },

  /**
   * Personalize homework for students in a specific classroom (or all if no classroom)
   * Uses Promise.all for concurrent personalization (much faster!)
   */
  async personalizeForStudentsInClassroom(homeworkId: string, classroomId?: string): Promise<number> {
    const homework = homeworkQueries.getById(homeworkId);
    if (!homework) {
      throw new Error('Homework not found');
    }

    // Get profiles - filter by classroom if specified
    let profiles: StudentProfileWithUser[];
    if (classroomId) {
      // Get only students in the specified classroom
      const allProfiles = studentProfilesQueries.getAllWithUserDetails();
      profiles = allProfiles.filter(p => p.classroomId === classroomId);
    } else {
      profiles = studentProfilesQueries.getAllWithUserDetails();
    }

    // Filter out students who already have personalized content
    const profilesToPersonalize = profiles.filter((profile) => {
      const existing = homeworkQueries.getPersonalizedByHomeworkAndStudent(
        homeworkId,
        profile.userId
      );
      return !existing;
    });

    if (profilesToPersonalize.length === 0) {
      return 0;
    }

    // Initialize progress tracking
    progressMap.set(homeworkId, {
      homeworkId,
      total: profilesToPersonalize.length,
      completed: 0,
      current: null,
      status: 'in_progress',
    });

    console.log(`[Homework] Starting parallel personalization for ${profilesToPersonalize.length} students`);
    const startTime = Date.now();

    // Create personalization promises for all students (CONCURRENT!)
    const personalizationPromises = profilesToPersonalize.map(async (profile) => {
      const context: PersonalizationContext = {
        age: profile.age,
        interests: profile.favoriteSports || [],
        skillsToImprove: profile.skillsToImprove || [],
        learningSystemPrompt: profile.learningSystemPrompt,
      };

      try {
        // Update progress
        const progress = progressMap.get(homeworkId);
        if (progress) {
          progress.current = profile.user?.name || profile.userId;
        }

        const personalizedContent = await this.personalizeContent(
          homework.masterContent,
          context
        );

        homeworkQueries.createPersonalized({
          homeworkId,
          studentId: profile.userId,
          personalizedContent,
        });

        // Update progress
        if (progress) {
          progress.completed++;
        }

        return { success: true, studentId: profile.userId };
      } catch (error) {
        console.error(`Failed to personalize homework for student ${profile.userId}:`, error);
        return { success: false, studentId: profile.userId, error };
      }
    });

    // Run all personalizations concurrently
    const results = await Promise.all(personalizationPromises);

    const elapsed = Date.now() - startTime;
    const successCount = results.filter((r) => r.success).length;

    console.log(`[Homework] Completed personalization for ${successCount}/${profilesToPersonalize.length} students in ${elapsed}ms`);

    // Update progress to completed
    const progress = progressMap.get(homeworkId);
    if (progress) {
      progress.status = 'completed';
      progress.current = null;
    }

    // Clean up progress after 5 minutes
    setTimeout(() => {
      progressMap.delete(homeworkId);
    }, 5 * 60 * 1000);

    return successCount;
  },

  /**
   * Personalize homework for all students (backwards compatible)
   */
  async personalizeForAllStudents(homeworkId: string): Promise<number> {
    return this.personalizeForStudentsInClassroom(homeworkId, undefined);
  },

  /**
   * Personalize homework for a specific student
   */
  async personalizeForStudent(homeworkId: string, studentId: string): Promise<void> {
    const homework = homeworkQueries.getById(homeworkId);
    if (!homework) {
      throw new Error('Homework not found');
    }

    // Check if already personalized
    const existing = homeworkQueries.getPersonalizedByHomeworkAndStudent(homeworkId, studentId);
    if (existing) {
      return;
    }

    // Get student profile
    const context = studentProfilesQueries.getPersonalizationContext(studentId);
    if (!context) {
      // Create basic personalized content without profile
      homeworkQueries.createPersonalized({
        homeworkId,
        studentId,
        personalizedContent: homework.masterContent,
      });
      return;
    }

    const personalizedContent = await this.personalizeContent(homework.masterContent, context);

    homeworkQueries.createPersonalized({
      homeworkId,
      studentId,
      personalizedContent,
    });
  },
};
