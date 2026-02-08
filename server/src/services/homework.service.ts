import { ollamaService } from './ollama.service';
import { homeworkQueries } from '../database/queries/homework.queries';
import { studentProfilesQueries } from '../database/queries/studentProfiles.queries';
import { HomeworkAssignment, PersonalizationContext } from '../types';

/**
 * Few-shot prompt for homework personalization
 */
const HOMEWORK_PERSONALIZATION_PROMPT = `You personalize homework assignments for students based on their profile.

## Example 1:
**Master Homework:**
Practice Problems: Fractions
1. Add: 1/4 + 2/4 = ?
2. Add: 3/8 + 2/8 = ?
3. Subtract: 5/6 - 2/6 = ?
4. Word problem: You ate 2/8 of a pizza and your friend ate 3/8. How much pizza was eaten in total?

**Student Profile:** Age: 10, Interests: [soccer], Skills to Improve: [math]
**Personalized Homework:**
# Soccer Math: Fractions Practice!

1. Your soccer team won 1/4 of their games in August and 2/4 in September. What fraction of their total games did they win? (Hint: add the fractions)

2. At halftime, your water bottle was 3/8 full. You drank 2/8 more. How full is your bottle now?

3. Your team's goal completion rate was 5/6 in practice. In the game, it dropped by 2/6. What's your game rate?

4. You and your teammate are collecting donations for new jerseys. You collected 2/8 of the goal, and your friend collected 3/8. Together, what fraction of the goal have you reached?

**Challenge:** If your team needs to collect 8/8 (the whole amount) for new uniforms, how much more do you need to raise?

## Example 2:
**Master Homework:**
Reading Comprehension Questions
Read Chapter 3 and answer:
1. Who is the main character?
2. What is the central conflict?
3. Write 3 vocabulary words you learned and their definitions.
4. Summarize the chapter in 50 words.

**Student Profile:** Age: 14, Interests: [basketball, video games], Skills to Improve: [reading, vocabulary]
**Personalized Homework:**
# Chapter 3 Analysis - Game Plan Style

Think of this chapter like analyzing game footage. Let's break it down:

**Starting Lineup (Main Character)**
1. Who's the MVP (main character) of this chapter? Describe them like you'd describe a key player - their strengths, weaknesses, and role in the "game."

**The Opposing Team (Conflict)**
2. Every good game has tension. What's the main conflict? Is it player vs. player, player vs. team (society), or player vs. themselves (internal)?

**Power-Ups (Vocabulary)**
3. List 3 new "power-up" words from the chapter:
   - Word:
   - Definition:
   - Use it in a sentence about gaming or basketball:

**Highlight Reel (Summary)**
4. Create a 50-word "highlight reel" summary. Imagine you're a sports commentator giving the quick recap!

**Bonus Quest:** Find one quote that could be a player's motivational poster.

## Your Task:
Personalize this homework assignment for the student. Make problems relatable to their interests while maintaining educational rigor.

**Master Homework:** {{MASTER_CONTENT}}
**Student Profile:** Age: {{AGE}}, Interests: {{INTERESTS}}, Skills to Improve: {{SKILLS}}{{LEARNING_STYLE}}
**Personalized Homework:**`;

/**
 * Few-shot prompt for generating master homework content
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
   * Generate master homework content using AI
   */
  async generateMasterContent(topic: string, subject?: string): Promise<string> {
    const prompt = MASTER_HOMEWORK_PROMPT.replace('{{TOPIC}}', topic).replace(
      '{{SUBJECT}}',
      subject || 'General'
    );

    const content = await ollamaService.generate(prompt);
    return content.trim();
  },

  /**
   * Personalize homework content for a specific student
   */
  async personalizeContent(
    masterContent: string,
    profile: PersonalizationContext
  ): Promise<string> {
    let prompt = HOMEWORK_PERSONALIZATION_PROMPT.replace('{{MASTER_CONTENT}}', masterContent)
      .replace('{{AGE}}', profile.age?.toString() || 'unknown')
      .replace('{{INTERESTS}}', profile.interests.length > 0 ? profile.interests.join(', ') : 'none specified')
      .replace('{{SKILLS}}', profile.skillsToImprove.length > 0 ? profile.skillsToImprove.join(', ') : 'none specified');

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
   * Create a homework assignment and optionally personalize for all students
   */
  async createHomework(
    teacherId: string,
    data: {
      title: string;
      topic: string;
      subject?: string;
      masterContent?: string;
      dueDate?: string;
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
    });

    // Personalize for all students if requested
    if (data.generateForStudents) {
      await this.personalizeForAllStudents(homework.id);
    }

    return homework;
  },

  /**
   * Personalize homework for all students with profiles
   */
  async personalizeForAllStudents(homeworkId: string): Promise<number> {
    const homework = homeworkQueries.getById(homeworkId);
    if (!homework) {
      throw new Error('Homework not found');
    }

    const profiles = studentProfilesQueries.getAllWithUserDetails();
    let count = 0;

    for (const profile of profiles) {
      // Skip if already personalized
      const existing = homeworkQueries.getPersonalizedByHomeworkAndStudent(
        homeworkId,
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
          homework.masterContent,
          context
        );

        homeworkQueries.createPersonalized({
          homeworkId,
          studentId: profile.userId,
          personalizedContent,
        });

        count++;
      } catch (error) {
        console.error(`Failed to personalize homework for student ${profile.userId}:`, error);
      }
    }

    return count;
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
