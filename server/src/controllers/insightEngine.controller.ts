import { Response } from 'express';
import { JwtAuthenticatedRequest } from '../types';
import { insightEngineService } from '../services/insightEngine.service';
import { ClassroomSnapshot } from '../../../shared/types/insight.types';
import { AppError } from '../middleware/errorHandler.middleware';

export const insightEngineController = {
  /**
   * GET /api/teacher/classrooms/:classroomId/insights
   * Returns the full classroom heatmap snapshot.
   */
  async getSnapshot(req: JwtAuthenticatedRequest, res: Response) {
    const { classroomId } = req.params;
    const teacherId = req.user!.id;

    const snapshot = await insightEngineService.getClassroomSnapshot(classroomId, teacherId);
    res.json(snapshot);
  },

  /**
   * POST /api/teacher/classrooms/:classroomId/insights/audit
   * Generates an AI-powered pedagogical diagnostic audit.
   * Body: { snapshot: ClassroomSnapshot }
   */
  async generateAudit(req: JwtAuthenticatedRequest, res: Response) {
    const { classroomId } = req.params;
    const { snapshot } = req.body as { snapshot: ClassroomSnapshot };

    if (!snapshot || snapshot.classroomId !== classroomId) {
      throw new AppError('Invalid snapshot: classroomId mismatch', 400);
    }

    const audit = await insightEngineService.generateDiagnosticAudit(snapshot);
    res.json(audit);
  },
};
