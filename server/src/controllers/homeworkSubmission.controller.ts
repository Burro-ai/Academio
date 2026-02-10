import { Response } from 'express';
import { homeworkGradingService } from '../services/homeworkGrading.service';
import { homeworkQueries } from '../database/queries/homework.queries';
import { homeworkSubmissionsQueries, HomeworkAnswer } from '../database/queries/homeworkSubmissions.queries';
import { JwtAuthenticatedRequest } from '../types';
import { AppError } from '../middleware/errorHandler.middleware';

export const homeworkSubmissionController = {
  /**
   * POST /api/student/homework/:id/submit
   * Submit homework with structured answers
   */
  async submit(req: JwtAuthenticatedRequest, res: Response) {
    const { id: personalizedHomeworkId } = req.params;
    const { answers } = req.body as { answers: HomeworkAnswer[] };
    const studentId = req.user?.id;

    if (!studentId) {
      throw new AppError('Not authenticated', 401);
    }

    if (!answers || !Array.isArray(answers)) {
      throw new AppError('answers array is required', 400);
    }

    // Verify this homework belongs to the student
    const allHomework = homeworkQueries.getPersonalizedByStudentId(studentId);
    const homework = allHomework.find((h) => h.id === personalizedHomeworkId);
    if (!homework) {
      throw new AppError('Homework not found', 404);
    }

    // Check if already submitted
    if (homeworkGradingService.hasSubmitted(personalizedHomeworkId, studentId)) {
      throw new AppError('Homework already submitted', 400);
    }

    // Process the submission (creates submission + generates AI suggestion)
    const result = await homeworkGradingService.processSubmission(
      personalizedHomeworkId,
      studentId,
      answers,
      homework.personalizedContent
    );

    // Also mark the personalized homework as submitted
    homeworkQueries.markAsSubmitted(personalizedHomeworkId);

    res.json({
      message: 'Homework submitted successfully',
      submissionId: result.submissionId,
    });
  },

  /**
   * GET /api/student/homework/:id/submission
   * Get the student's submission for a homework
   */
  async getStudentSubmission(req: JwtAuthenticatedRequest, res: Response) {
    const { id: personalizedHomeworkId } = req.params;
    const studentId = req.user?.id;

    if (!studentId) {
      throw new AppError('Not authenticated', 401);
    }

    const submission = homeworkGradingService.getSubmissionByHomeworkAndStudent(
      personalizedHomeworkId,
      studentId
    );

    if (!submission) {
      res.json({ submitted: false });
      return;
    }

    res.json({
      submitted: true,
      submission,
    });
  },

  /**
   * GET /api/teacher/homework/pending
   * Get all pending (ungraded) submissions for teacher
   */
  async getPending(req: JwtAuthenticatedRequest, res: Response) {
    const teacherId = req.user?.id;

    if (!teacherId) {
      throw new AppError('Not authenticated', 401);
    }

    const submissions = homeworkGradingService.getPendingSubmissions(teacherId);
    res.json(submissions);
  },

  /**
   * GET /api/teacher/homework/:homeworkId/submissions
   * Get all submissions for a specific homework assignment
   */
  async getAllByHomework(req: JwtAuthenticatedRequest, res: Response) {
    const { homeworkId } = req.params;
    const teacherId = req.user?.id;

    if (!teacherId) {
      throw new AppError('Not authenticated', 401);
    }

    // Verify this homework belongs to the teacher
    const homework = homeworkQueries.getWithTeacher(homeworkId);
    if (!homework || homework.teacherId !== teacherId) {
      throw new AppError('Homework not found', 404);
    }

    const submissions = homeworkGradingService.getSubmissionsByHomework(homeworkId);
    const stats = homeworkGradingService.getSubmissionStats(homeworkId);

    res.json({
      submissions,
      stats,
    });
  },

  /**
   * GET /api/teacher/homework/submissions/:id
   * Get a specific submission
   */
  async getSubmission(req: JwtAuthenticatedRequest, res: Response) {
    const { id: submissionId } = req.params;
    const teacherId = req.user?.id;

    if (!teacherId) {
      throw new AppError('Not authenticated', 401);
    }

    const submission = homeworkSubmissionsQueries.getById(submissionId);
    if (!submission) {
      throw new AppError('Submission not found', 404);
    }

    // Get full details to verify teacher owns this
    const pendingSubmissions = homeworkGradingService.getPendingSubmissions(teacherId);
    const isTeachers = pendingSubmissions.some((s) => s.id === submissionId);

    // Also check graded submissions
    if (!isTeachers) {
      // Check if this submission is for teacher's homework
      const allByStudent = homeworkSubmissionsQueries.getByStudent(submission.studentId);
      const fullSubmission = allByStudent.find((s) => s.id === submissionId);

      if (!fullSubmission) {
        throw new AppError('Submission not found', 404);
      }

      // Verify the homework belongs to this teacher
      const personalizedHw = homeworkQueries.getPersonalizedByStudentId(submission.studentId);
      const hw = personalizedHw.find((h) => h.id === submission.personalizedHomeworkId);

      if (!hw) {
        throw new AppError('Access denied', 403);
      }

      // Get the master homework to check teacher
      const homeworkList = homeworkQueries.getByTeacherId(teacherId);
      const isTeachersHomework = homeworkList.some((h) => h.id === hw.homeworkId);

      if (!isTeachersHomework) {
        throw new AppError('Access denied', 403);
      }
    }

    res.json(submission);
  },

  /**
   * PUT /api/teacher/homework/submissions/:id/grade
   * Grade a submission
   */
  async grade(req: JwtAuthenticatedRequest, res: Response) {
    const { id: submissionId } = req.params;
    const { grade, feedback } = req.body as { grade: number; feedback: string };
    const teacherId = req.user?.id;

    if (!teacherId) {
      throw new AppError('Not authenticated', 401);
    }

    if (typeof grade !== 'number' || grade < 0 || grade > 100) {
      throw new AppError('Grade must be a number between 0 and 100', 400);
    }

    if (!feedback || typeof feedback !== 'string') {
      throw new AppError('Feedback is required', 400);
    }

    // Verify the submission exists
    const submission = homeworkSubmissionsQueries.getById(submissionId);
    if (!submission) {
      throw new AppError('Submission not found', 404);
    }

    // Get pending submissions to verify this belongs to the teacher
    const pendingSubmissions = homeworkGradingService.getPendingSubmissions(teacherId);
    const isTeachers = pendingSubmissions.some((s) => s.id === submissionId);

    if (!isTeachers) {
      throw new AppError('Access denied', 403);
    }

    // Grade the submission
    const updatedSubmission = homeworkGradingService.gradeSubmission(
      submissionId,
      grade,
      feedback,
      teacherId
    );

    res.json({
      message: 'Submission graded successfully',
      submission: updatedSubmission,
    });
  },

  /**
   * POST /api/teacher/homework/submissions/:id/regenerate-ai
   * Regenerate AI suggestion for a submission
   */
  async regenerateAISuggestion(req: JwtAuthenticatedRequest, res: Response) {
    const { id: submissionId } = req.params;
    const teacherId = req.user?.id;

    if (!teacherId) {
      throw new AppError('Not authenticated', 401);
    }

    // Verify the submission exists and belongs to this teacher's homework
    const submission = homeworkSubmissionsQueries.getById(submissionId);
    if (!submission) {
      throw new AppError('Submission not found', 404);
    }

    // Get the personalized homework to get the content
    const personalizedHw = homeworkQueries.getPersonalizedByStudentId(submission.studentId);
    const hw = personalizedHw.find((h) => h.id === submission.personalizedHomeworkId);

    if (!hw) {
      throw new AppError('Homework not found', 404);
    }

    // Regenerate AI suggestion
    const result = await homeworkGradingService.generateAISuggestion(
      submissionId,
      hw.personalizedContent,
      submission.answers
    );

    res.json({
      aiSuggestedGrade: result.grade,
      aiSuggestedFeedback: result.feedback,
    });
  },
};
