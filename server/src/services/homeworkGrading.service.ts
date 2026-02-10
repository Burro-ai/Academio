import { ollamaService } from './ollama.service';
import { homeworkSubmissionsQueries, HomeworkAnswer } from '../database/queries/homeworkSubmissions.queries';

/**
 * Homework Grading Service
 * Provides AI-powered grading suggestions for homework submissions
 */
class HomeworkGradingService {
  /**
   * Build a prompt for AI grading
   */
  private buildGradingPrompt(
    homeworkContent: string,
    answers: HomeworkAnswer[]
  ): string {
    const answersFormatted = answers
      .map((a, i) => `Question ${i + 1} (ID: ${a.questionId}):\nStudent's Answer: ${a.value}`)
      .join('\n\n');

    return `You are an expert educational assessor. Evaluate the student's homework submission and provide a fair, constructive assessment.

## Homework Assignment Content
${homeworkContent}

## Student's Submitted Answers
${answersFormatted}

## Your Task
1. Evaluate each answer for correctness, completeness, and understanding
2. Consider partial credit for partially correct answers
3. Provide a numerical grade from 0 to 100
4. Write constructive feedback that:
   - Acknowledges what the student did well
   - Explains any mistakes in an encouraging way
   - Suggests how they can improve

## Response Format
Respond in the following JSON format ONLY (no additional text):
{
  "grade": <number 0-100>,
  "feedback": "<constructive feedback string>"
}`;
  }

  /**
   * Generate AI grading suggestion for a submission
   */
  async generateAISuggestion(
    submissionId: string,
    homeworkContent: string,
    answers: HomeworkAnswer[]
  ): Promise<{ grade: number; feedback: string }> {
    const systemPrompt = `You are an educational assessment AI. You provide fair, encouraging grades and feedback for student homework. Always respond in valid JSON format only.`;

    const prompt = this.buildGradingPrompt(homeworkContent, answers);

    try {
      // Use the AI service to generate grading suggestion
      const response = await ollamaService.generate(prompt, undefined, systemPrompt);

      // Parse the JSON response
      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        throw new Error('Invalid AI response format');
      }

      const result = JSON.parse(jsonMatch[0]) as { grade: number; feedback: string };

      // Validate grade is in range
      const grade = Math.max(0, Math.min(100, result.grade));
      const feedback = result.feedback || 'No feedback provided.';

      // Save the AI suggestion to the database
      homeworkSubmissionsQueries.updateAISuggestion(submissionId, grade, feedback);

      return { grade, feedback };
    } catch (error) {
      console.error('[HomeworkGrading] AI suggestion error:', error);

      // Return a neutral response on error
      return {
        grade: 0,
        feedback: 'Unable to generate AI suggestion. Please grade manually.',
      };
    }
  }

  /**
   * Process a new submission and generate AI suggestions
   */
  async processSubmission(
    personalizedHomeworkId: string,
    studentId: string,
    answers: HomeworkAnswer[],
    homeworkContent: string
  ): Promise<{
    submissionId: string;
    aiSuggestion?: { grade: number; feedback: string };
  }> {
    // Create the submission
    const submission = homeworkSubmissionsQueries.create(
      personalizedHomeworkId,
      studentId,
      answers
    );

    // Generate AI suggestion asynchronously
    let aiSuggestion: { grade: number; feedback: string } | undefined;
    try {
      aiSuggestion = await this.generateAISuggestion(
        submission.id,
        homeworkContent,
        answers
      );
    } catch (error) {
      console.error('[HomeworkGrading] Failed to generate AI suggestion:', error);
    }

    return {
      submissionId: submission.id,
      aiSuggestion,
    };
  }

  /**
   * Get pending submissions for a teacher
   */
  getPendingSubmissions(teacherId: string) {
    return homeworkSubmissionsQueries.getPendingByTeacher(teacherId);
  }

  /**
   * Get all submissions for a homework assignment
   */
  getSubmissionsByHomework(homeworkId: string) {
    return homeworkSubmissionsQueries.getAllByHomework(homeworkId);
  }

  /**
   * Get submission by ID
   */
  getSubmission(submissionId: string) {
    return homeworkSubmissionsQueries.getById(submissionId);
  }

  /**
   * Get submission by homework and student
   */
  getSubmissionByHomeworkAndStudent(personalizedHomeworkId: string, studentId: string) {
    return homeworkSubmissionsQueries.getByHomeworkAndStudent(personalizedHomeworkId, studentId);
  }

  /**
   * Grade a submission
   */
  gradeSubmission(
    submissionId: string,
    grade: number,
    feedback: string,
    gradedBy: string
  ) {
    return homeworkSubmissionsQueries.updateGrade(submissionId, grade, feedback, gradedBy);
  }

  /**
   * Check if a student has already submitted
   */
  hasSubmitted(personalizedHomeworkId: string, studentId: string): boolean {
    return homeworkSubmissionsQueries.hasSubmitted(personalizedHomeworkId, studentId);
  }

  /**
   * Get submission statistics for a homework
   */
  getSubmissionStats(homeworkId: string) {
    return homeworkSubmissionsQueries.countByHomework(homeworkId);
  }
}

export const homeworkGradingService = new HomeworkGradingService();
