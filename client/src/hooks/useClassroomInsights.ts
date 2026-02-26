import { useState, useCallback } from 'react';
import { teacherApi } from '@/services/teacherApi';
import { ClassroomSnapshot, DiagnosticAudit } from '../../../shared/types/insight.types';

export function useClassroomInsights() {
  const [snapshot, setSnapshot] = useState<ClassroomSnapshot | null>(null);
  const [audit, setAudit] = useState<DiagnosticAudit | null>(null);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [isGeneratingAudit, setIsGeneratingAudit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async (classroomId: string) => {
    setIsLoadingSnapshot(true);
    setError(null);
    setSnapshot(null);
    setAudit(null);
    try {
      const data = await teacherApi.getClassroomSnapshot(classroomId);
      setSnapshot(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al cargar el análisis';
      setError(msg);
    } finally {
      setIsLoadingSnapshot(false);
    }
  }, []);

  const generateAudit = useCallback(async (classroomId: string) => {
    if (!snapshot) return;
    setIsGeneratingAudit(true);
    setError(null);
    try {
      const data = await teacherApi.generateDiagnosticAudit(classroomId, snapshot);
      setAudit(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al generar el diagnóstico';
      setError(msg);
    } finally {
      setIsGeneratingAudit(false);
    }
  }, [snapshot]);

  return {
    snapshot,
    audit,
    isLoadingSnapshot,
    isGeneratingAudit,
    error,
    loadSnapshot,
    generateAudit,
  };
}
