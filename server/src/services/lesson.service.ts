import { ollamaService, ModelType } from './ollama.service';
import { lessonsQueries } from '../database/queries/lessons.queries';
import { studentProfilesQueries } from '../database/queries/studentProfiles.queries';
import { Lesson, PersonalizationContext, StudentProfileWithUser } from '../types';

/**
 * Progress tracking for personalization
 */
export interface PersonalizationProgress {
  lessonId: string;
  total: number;
  completed: number;
  current: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  error?: string;
}

// In-memory progress tracking (can be replaced with Redis for production)
const progressMap = new Map<string, PersonalizationProgress>();

/**
 * Socratic personalization prompt - creates tailored analogies and reflection questions
 */
const SOCRATIC_PERSONALIZATION_PROMPT = `You are a Socratic tutor personalizing educational content for a specific student.

## Your Task
Given the master lesson content and the student's profile, create a SHORT personalized addition that includes:
1. **One Specific Analogy**: Create a relatable analogy using their interests (${'{INTERESTS}'})
2. **One Reflection Question**: A thought-provoking question that connects the topic to their life and helps with their skills (${'{SKILLS}'})

Keep it concise (2-3 short paragraphs max). Don't rewrite the whole lesson - just add the personalized touch.

## Example Output Format:
**Your Personal Connection:**
[Analogy connecting to their interest]

**Think About This:**
[Socratic question that makes them reflect and connects to skills they want to improve]

## Master Content:
{MASTER_CONTENT}

## Student Profile:
- Age: {AGE}
- Interests: {INTERESTS}
- Skills to Improve: {SKILLS}
{LEARNING_STYLE}

## Personalized Addition:`;

/**
 * Few-shot prompt for generating master lesson content (uses reasoner model)
 */
const MASTER_LESSON_PROMPT = `You are an expert educator creating lesson content for K-12 students.

## Example 1:
**Topic:** Introduction to Fractions
**Subject:** Math
**Content:**
# What Are Fractions?

A fraction represents a part of a whole. When we divide something into equal parts and take some of those parts, we're using fractions!

## The Parts of a Fraction
- **Numerator** (top number): How many parts we have
- **Denominator** (bottom number): How many equal parts the whole is divided into

## Real-World Examples
- Half a pizza: 1/2 (1 slice out of 2 equal slices)
- Three quarters of a dollar: 3/4 (3 quarters out of 4)
- Two thirds of a chocolate bar: 2/3

## Key Concepts
1. The denominator tells us the SIZE of each piece
2. The numerator tells us how MANY pieces we have
3. When numerator = denominator, we have a whole (4/4 = 1)

## Practice Questions
1. If you eat 2 slices of an 8-slice pizza, what fraction did you eat?
2. Draw a rectangle divided into 5 equal parts. Shade 3 of them. What fraction is shaded?

## Your Task:
Create a comprehensive, educational lesson on the given topic. Include clear explanations, examples, and questions to check understanding.

**Topic:** {{TOPIC}}
**Subject:** {{SUBJECT}}
**Content:**`;

export const lessonService = {
  /**
   * Get personalization progress
   */
  getProgress(lessonId: string): PersonalizationProgress | null {
    return progressMap.get(lessonId) || null;
  },

  /**
   * Generate master lesson content using AI (streaming)
   * Uses 'reasoner' model for high-quality content generation
   */
  async *generateMasterContentStream(
    topic: string,
    subject?: string
  ): AsyncGenerator<{ text: string; done: boolean }> {
    const prompt = MASTER_LESSON_PROMPT.replace('{{TOPIC}}', topic).replace(
      '{{SUBJECT}}',
      subject || 'General'
    );

    // Use reasoner model for high-quality master content
    yield* ollamaService.generateStream(prompt, undefined, undefined, 'reasoner');
  },

  /**
   * Generate master lesson content using AI (non-streaming)
   * Uses 'reasoner' model for high-quality content generation
   */
  async generateMasterContent(topic: string, subject?: string): Promise<string> {
    const prompt = MASTER_LESSON_PROMPT.replace('{{TOPIC}}', topic).replace(
      '{{SUBJECT}}',
      subject || 'General'
    );

    // Use reasoner model for high-quality master content
    const content = await ollamaService.generate(prompt, undefined, undefined, 'reasoner');
    return content.trim();
  },

  /**
   * Personalize lesson content for a specific student (uses chat model for speed)
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
   * Create a lesson and optionally personalize for all students
   */
  async createLesson(
    teacherId: string,
    data: {
      title: string;
      topic: string;
      subject?: string;
      masterContent?: string;
      generateForStudents?: boolean;
    }
  ): Promise<Lesson> {
    // Generate master content if not provided
    let masterContent = data.masterContent;
    if (!masterContent) {
      masterContent = await this.generateMasterContent(data.topic, data.subject);
    }

    // Create the lesson
    const lesson = lessonsQueries.create({
      teacherId,
      title: data.title,
      topic: data.topic,
      subject: data.subject,
      masterContent,
    });

    // Personalize for all students if requested (run in background)
    if (data.generateForStudents) {
      // Don't await - let it run in background
      this.personalizeForAllStudents(lesson.id).catch((err) => {
        console.error('[Lesson] Background personalization failed:', err);
      });
    }

    return lesson;
  },

  /**
   * Personalize a lesson for all students with profiles
   * Uses Promise.all for concurrent personalization (much faster!)
   */
  async personalizeForAllStudents(lessonId: string): Promise<number> {
    const lesson = lessonsQueries.getById(lessonId);
    if (!lesson) {
      throw new Error('Lesson not found');
    }

    const profiles = studentProfilesQueries.getAllWithUserDetails();

    // Filter out students who already have personalized content
    const profilesToPersonalize = profiles.filter((profile) => {
      const existing = lessonsQueries.getPersonalizedByLessonAndStudent(
        lessonId,
        profile.userId
      );
      return !existing;
    });

    if (profilesToPersonalize.length === 0) {
      return 0;
    }

    // Initialize progress tracking
    progressMap.set(lessonId, {
      lessonId,
      total: profilesToPersonalize.length,
      completed: 0,
      current: null,
      status: 'in_progress',
    });

    console.log(`[Lesson] Starting parallel personalization for ${profilesToPersonalize.length} students`);
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
        const progress = progressMap.get(lessonId);
        if (progress) {
          progress.current = profile.user?.name || profile.userId;
        }

        const personalizedContent = await this.personalizeContent(
          lesson.masterContent,
          context
        );

        lessonsQueries.createPersonalized({
          lessonId,
          studentId: profile.userId,
          personalizedContent,
        });

        // Update progress
        if (progress) {
          progress.completed++;
        }

        return { success: true, studentId: profile.userId };
      } catch (error) {
        console.error(`Failed to personalize lesson for student ${profile.userId}:`, error);
        return { success: false, studentId: profile.userId, error };
      }
    });

    // Run all personalizations concurrently
    const results = await Promise.all(personalizationPromises);

    const elapsed = Date.now() - startTime;
    const successCount = results.filter((r) => r.success).length;

    console.log(`[Lesson] Completed personalization for ${successCount}/${profilesToPersonalize.length} students in ${elapsed}ms`);

    // Update progress to completed
    const progress = progressMap.get(lessonId);
    if (progress) {
      progress.status = 'completed';
      progress.current = null;
    }

    // Clean up progress after 5 minutes
    setTimeout(() => {
      progressMap.delete(lessonId);
    }, 5 * 60 * 1000);

    return successCount;
  },

  /**
   * Personalize a lesson for a specific student
   */
  async personalizeForStudent(lessonId: string, studentId: string): Promise<void> {
    const lesson = lessonsQueries.getById(lessonId);
    if (!lesson) {
      throw new Error('Lesson not found');
    }

    // Check if already personalized
    const existing = lessonsQueries.getPersonalizedByLessonAndStudent(lessonId, studentId);
    if (existing) {
      return;
    }

    // Get student profile
    const context = studentProfilesQueries.getPersonalizationContext(studentId);
    if (!context) {
      // Create basic personalized content without profile
      lessonsQueries.createPersonalized({
        lessonId,
        studentId,
        personalizedContent: lesson.masterContent,
      });
      return;
    }

    const personalizedContent = await this.personalizeContent(lesson.masterContent, context);

    lessonsQueries.createPersonalized({
      lessonId,
      studentId,
      personalizedContent,
    });
  },
};
