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
   * Generates an AI-powered pedagogical diagnostic audit and persists it.
   * Body: { snapshot: ClassroomSnapshot }
   */
  async generateAudit(req: JwtAuthenticatedRequest, res: Response) {
    const { classroomId } = req.params;
    const teacherId = req.user!.id;
    const { snapshot } = req.body as { snapshot: ClassroomSnapshot };

    if (!snapshot || snapshot.classroomId !== classroomId) {
      throw new AppError('Invalid snapshot: classroomId mismatch', 400);
    }

    const audit = await insightEngineService.generateDiagnosticAudit(snapshot, teacherId);
    res.json(audit);
  },

  /**
   * GET /api/teacher/classrooms/:classroomId/insights/audits
   * Returns the audit history for a classroom (most recent first).
   */
  async getAuditHistory(req: JwtAuthenticatedRequest, res: Response) {
    const { classroomId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const audits = insightEngineService.getAuditHistory(classroomId, limit);
    res.json(audits);
  },

  /**
   * GET /api/teacher/classrooms/:classroomId/insights/audits/:auditId
   * Returns a single stored audit by ID.
   */
  async getAuditById(req: JwtAuthenticatedRequest, res: Response) {
    const { auditId } = req.params;
    const audit = insightEngineService.getAuditById(auditId);
    if (!audit) {
      throw new AppError('Audit not found', 404);
    }
    res.json(audit);
  },
};
