import { useState, useCallback, useEffect } from 'react';
import { Classroom, ClassroomStats, InterventionAlert, Subject } from '@/types';
import { teacherApi } from '@/services/teacherApi';

interface UseClassroomReturn {
  classrooms: (Classroom & { stats?: ClassroomStats })[];
  selectedClassroom: Classroom | null;
  classroomStats: ClassroomStats | null;
  interventionAlerts: InterventionAlert[];
  totalStats: {
    totalStudents: number;
    studentsStruggling: number;
    studentsExcelling: number;
    recentActivity: number;
  };
  isLoading: boolean;
  error: string | null;
  loadClassrooms: () => Promise<void>;
  loadOverview: (classroomId?: string) => Promise<void>;
  loadInterventionAlerts: () => Promise<void>;
  selectClassroom: (id: string | null) => void;
  createClassroom: (name: string, subject?: string, gradeLevel?: string) => Promise<Classroom>;
  updateClassroom: (id: string, data: Partial<{ name: string; subject: string; gradeLevel: string }>) => Promise<Classroom>;
  deleteClassroom: (id: string) => Promise<void>;
  getSubjectAverage: (classroomId: string, subject: Subject) => Promise<number>;
}

export function useClassroom(): UseClassroomReturn {
  const [classrooms, setClassrooms] = useState<(Classroom & { stats?: ClassroomStats })[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
  const [classroomStats, setClassroomStats] = useState<ClassroomStats | null>(null);
  const [interventionAlerts, setInterventionAlerts] = useState<InterventionAlert[]>([]);
  const [totalStats, setTotalStats] = useState({
    totalStudents: 0,
    studentsStruggling: 0,
    studentsExcelling: 0,
    recentActivity: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadClassrooms = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await teacherApi.getClassrooms();
      setClassrooms(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load classrooms');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadOverview = useCallback(async (classroomId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await teacherApi.getClassroomOverview(classroomId);

      if (classroomId && data.classroom) {
        setSelectedClassroom(data.classroom);
        setClassroomStats(data.stats || null);
      } else if (data.classrooms) {
        setClassrooms(data.classrooms);
        setTotalStats({
          totalStudents: data.totalStudents,
          studentsStruggling: data.studentsStruggling,
          studentsExcelling: data.studentsExcelling || 0,
          recentActivity: data.recentActivity || 0,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load overview');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadInterventionAlerts = useCallback(async () => {
    try {
      const alerts = await teacherApi.getStrugglingStudents();
      setInterventionAlerts(alerts);
    } catch (err) {
      console.error('Failed to load intervention alerts:', err);
    }
  }, []);

  const selectClassroom = useCallback(
    (id: string | null) => {
      if (id === null) {
        setSelectedClassroom(null);
        setClassroomStats(null);
      } else {
        const classroom = classrooms.find((c) => c.id === id);
        if (classroom) {
          setSelectedClassroom(classroom);
          // Load stats for selected classroom
          loadOverview(id);
        }
      }
    },
    [classrooms, loadOverview]
  );

  const createClassroom = useCallback(async (name: string, subject?: string, gradeLevel?: string) => {
    const classroom = await teacherApi.createClassroom({ name, subject, gradeLevel });
    setClassrooms((prev) => [...prev, classroom]);
    return classroom;
  }, []);

  const updateClassroom = useCallback(async (
    id: string,
    data: Partial<{ name: string; subject: string; gradeLevel: string }>
  ) => {
    const classroom = await teacherApi.updateClassroom(id, data);
    setClassrooms((prev) => prev.map((c) => (c.id === id ? { ...c, ...classroom } : c)));
    if (selectedClassroom?.id === id) {
      setSelectedClassroom(classroom);
    }
    return classroom;
  }, [selectedClassroom]);

  const deleteClassroom = useCallback(async (id: string) => {
    await teacherApi.deleteClassroom(id);
    setClassrooms((prev) => prev.filter((c) => c.id !== id));
    if (selectedClassroom?.id === id) {
      setSelectedClassroom(null);
      setClassroomStats(null);
    }
  }, [selectedClassroom]);

  const getSubjectAverage = useCallback(async (classroomId: string, subject: Subject) => {
    const data = await teacherApi.getSubjectAverage(classroomId, subject);
    return data.average;
  }, []);

  // Load overview on mount
  useEffect(() => {
    loadOverview();
    loadInterventionAlerts();
  }, [loadOverview, loadInterventionAlerts]);

  return {
    classrooms,
    selectedClassroom,
    classroomStats,
    interventionAlerts,
    totalStats,
    isLoading,
    error,
    loadClassrooms,
    loadOverview,
    loadInterventionAlerts,
    selectClassroom,
    createClassroom,
    updateClassroom,
    deleteClassroom,
    getSubjectAverage,
  };
}
