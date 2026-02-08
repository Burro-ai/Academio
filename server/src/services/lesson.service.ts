import { ollamaService } from './ollama.service';
import { lessonsQueries } from '../database/queries/lessons.queries';
import { studentProfilesQueries } from '../database/queries/studentProfiles.queries';
import { Lesson, PersonalizationContext } from '../types';

/**
 * Few-shot prompt for lesson personalization
 */
const PERSONALIZATION_PROMPT = `You personalize educational content for students based on their profile.

## Example 1:
**Master Content:** The water cycle has three main stages: evaporation, condensation, and precipitation. Water evaporates from oceans and lakes, forms clouds through condensation, and falls as rain or snow.
**Student Profile:** Age: 10, Interests: [soccer], Skills to Improve: [vocabulary]
**Personalized Content:** Imagine the water cycle like a soccer game! The sun is like the coach calling water up from the field (that's evaporation - when water turns into invisible vapor). High up in the sky, the water vapor gets together like players huddling - that's condensation forming clouds. Then, when the cloud gets too full, the water falls back down like players running onto the field - that's precipitation (a fancy word for rain, snow, or sleet)!

## Example 2:
**Master Content:** The French Revolution began in 1789 when the common people of France rose up against the monarchy. Key causes included economic hardship, social inequality, and Enlightenment ideas about liberty and equality.
**Student Profile:** Age: 14, Interests: [basketball], Skills to Improve: [critical thinking]
**Personalized Content:** Think of pre-Revolution France like a basketball team with seriously unfair rules. The King and nobles (like a coach who never leaves the bench) got all the best equipment and food, while the common players (the Third Estate) did all the work but got almost nothing. By 1789, the players were fed up - they'd learned about fairness from new "playbooks" (Enlightenment ideas) and decided to change the game completely. What do you think would happen if a real basketball team had rules like that? How might players organize to demand fairness?

## Example 3:
**Master Content:** Photosynthesis is the process by which plants convert sunlight, water, and carbon dioxide into glucose and oxygen. This occurs in the chloroplasts of plant cells.
**Student Profile:** Age: 11, Interests: [video games], Skills to Improve: [science]
**Personalized Content:** Plants are like little food factories running on solar power! Think of photosynthesis like crafting in a video game: plants collect three ingredients (sunlight = energy crystals, water = blue potion, carbon dioxide = air element) and combine them in special green workshops called chloroplasts. The recipe produces two things: glucose (sugar = health points for the plant) and oxygen (the bonus item that we breathe!). Pretty cool, right?

## Your Task:
Personalize this lesson content for the student. Keep the educational value but make it relatable to their interests and appropriate for their age. If they have skills to improve, emphasize those areas.

**Master Content:** {{MASTER_CONTENT}}
**Student Profile:** Age: {{AGE}}, Interests: {{INTERESTS}}, Skills to Improve: {{SKILLS}}{{LEARNING_STYLE}}
**Personalized Content:**`;

/**
 * Few-shot prompt for generating master lesson content
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

## Example 2:
**Topic:** The American Civil War
**Subject:** History
**Content:**
# The American Civil War (1861-1865)

## Overview
The Civil War was fought between the Northern states (Union) and Southern states (Confederacy) over issues of slavery and states' rights.

## Key Causes
1. **Slavery**: The South's economy depended on enslaved labor; the North was moving toward abolition
2. **States' Rights**: Disagreement over how much power federal vs. state governments should have
3. **Economic Differences**: Industrial North vs. Agricultural South

## Important Figures
- **Abraham Lincoln**: 16th President, led the Union
- **Jefferson Davis**: President of the Confederacy
- **Ulysses S. Grant**: Union general who won key battles
- **Robert E. Lee**: Confederate general

## Major Events
- Fort Sumter attack (April 1861) - War begins
- Emancipation Proclamation (1863) - Freed enslaved people in Confederate states
- Gettysburg (1863) - Turning point battle
- Surrender at Appomattox (1865) - War ends

## Impact
- Slavery abolished (13th Amendment)
- Over 600,000 Americans died
- Reconstruction era began

## Your Task:
Create a comprehensive, educational lesson on the given topic. Include clear explanations, examples, and questions to check understanding.

**Topic:** {{TOPIC}}
**Subject:** {{SUBJECT}}
**Content:**`;

export const lessonService = {
  /**
   * Generate master lesson content using AI
   */
  async generateMasterContent(topic: string, subject?: string): Promise<string> {
    const prompt = MASTER_LESSON_PROMPT.replace('{{TOPIC}}', topic).replace(
      '{{SUBJECT}}',
      subject || 'General'
    );

    const content = await ollamaService.generate(prompt);
    return content.trim();
  },

  /**
   * Personalize lesson content for a specific student
   */
  async personalizeContent(
    masterContent: string,
    profile: PersonalizationContext
  ): Promise<string> {
    let prompt = PERSONALIZATION_PROMPT.replace('{{MASTER_CONTENT}}', masterContent)
      .replace('{{AGE}}', profile.age?.toString() || 'unknown')
      .replace('{{INTERESTS}}', profile.interests.length > 0 ? profile.interests.join(', ') : 'none specified')
      .replace('{{SKILLS}}', profile.skillsToImprove.length > 0 ? profile.skillsToImprove.join(', ') : 'none specified');

    // Add learning style if present
    if (profile.learningSystemPrompt) {
      prompt = prompt.replace(
        '{{LEARNING_STYLE}}',
        `\n**Learning Style:** ${profile.learningSystemPrompt}`
      );
    } else {
      prompt = prompt.replace('{{LEARNING_STYLE}}', '');
    }

    const content = await ollamaService.generate(prompt);
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

    // Personalize for all students if requested
    if (data.generateForStudents) {
      await this.personalizeForAllStudents(lesson.id);
    }

    return lesson;
  },

  /**
   * Personalize a lesson for all students with profiles
   */
  async personalizeForAllStudents(lessonId: string): Promise<number> {
    const lesson = lessonsQueries.getById(lessonId);
    if (!lesson) {
      throw new Error('Lesson not found');
    }

    const profiles = studentProfilesQueries.getAllWithUserDetails();
    let count = 0;

    for (const profile of profiles) {
      // Skip if already personalized
      const existing = lessonsQueries.getPersonalizedByLessonAndStudent(
        lessonId,
        profile.userId
      );
      if (existing) continue;

      // Get personalization context
      const context: PersonalizationContext = {
        age: profile.age,
        interests: profile.favoriteSports || [],
        skillsToImprove: profile.skillsToImprove || [],
        learningSystemPrompt: profile.learningSystemPrompt,
      };

      try {
        const personalizedContent = await this.personalizeContent(
          lesson.masterContent,
          context
        );

        lessonsQueries.createPersonalized({
          lessonId,
          studentId: profile.userId,
          personalizedContent,
        });

        count++;
      } catch (error) {
        console.error(`Failed to personalize lesson for student ${profile.userId}:`, error);
      }
    }

    return count;
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
