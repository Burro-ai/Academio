import { useState, useCallback, useMemo, useEffect } from 'react';
import { HomeworkQuestion, HomeworkAnswer, HomeworkSubmission } from '@/types';
import { authApi } from '@/services/authApi';

interface UseHomeworkFormOptions {
  personalizedHomeworkId: string;
  content: string;
}

interface UseHomeworkFormReturn {
  questions: HomeworkQuestion[];
  answers: Record<string, string>;
  answeredCount: number;
  totalCount: number;
  isSubmitting: boolean;
  isSubmitted: boolean;
  existingSubmission: HomeworkSubmission | null;
  error: string | null;
  updateAnswer: (questionId: string, value: string) => void;
  submitHomework: () => Promise<void>;
  resetForm: () => void;
}

/**
 * Parse questions from homework content
 * Looks for numbered items like "1.", "2.", etc. or "Question 1:", "Question 2:", etc.
 */
function parseQuestionsFromContent(content: string): HomeworkQuestion[] {
  const questions: HomeworkQuestion[] = [];

  // Try different patterns
  const patterns = [
    // Pattern 1: "1. Question text" or "1) Question text"
    /(?:^|\n)\s*(\d+)[.)]\s*(.+?)(?=(?:\n\s*\d+[.)])|$)/gs,
    // Pattern 2: "Question 1:" or "Pregunta 1:"
    /(?:Question|Pregunta)\s*(\d+)[:\.]?\s*(.+?)(?=(?:Question|Pregunta)\s*\d+|$)/gis,
    // Pattern 3: "**1.**" markdown format
    /(?:^|\n)\s*\*{0,2}(\d+)\.\*{0,2}\s*(.+?)(?=(?:\n\s*\*{0,2}\d+\.\*{0,2})|$)/gs,
  ];

  for (const pattern of patterns) {
    const matches = [...content.matchAll(pattern)];
    if (matches.length > 0) {
      matches.forEach((match, index) => {
        const questionNumber = match[1];
        let questionText = match[2].trim();

        // Clean up the question text - remove trailing markdown or special chars
        questionText = questionText
          .replace(/\n+/g, ' ')
          .replace(/\s+/g, ' ')
          .replace(/\*{2,}/g, '')
          .trim();

        // Skip empty or too short questions
        if (questionText.length < 5) return;

        questions.push({
          id: `q${questionNumber}`,
          text: questionText,
          type: questionText.length > 100 ? 'textarea' : 'text',
          order: index + 1,
        });
      });

      if (questions.length > 0) break;
    }
  }

  // If no questions found using patterns, try line-by-line analysis
  if (questions.length === 0) {
    const lines = content.split('\n').filter((line) => line.trim());
    let questionCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      // Look for lines that look like questions (end with ? or contain common question words)
      if (
        trimmed.endsWith('?') ||
        /^(what|how|why|when|where|which|who|explain|describe|calculate|solve|find)/i.test(
          trimmed
        ) ||
        /^(que|como|por que|cuando|donde|cual|quien|explica|describe|calcula|resuelve|encuentra)/i.test(
          trimmed
        )
      ) {
        questionCount++;
        questions.push({
          id: `q${questionCount}`,
          text: trimmed,
          type: trimmed.length > 100 ? 'textarea' : 'text',
          order: questionCount,
        });
      }
    }
  }

  // If still no questions, create a single question for general response
  if (questions.length === 0) {
    questions.push({
      id: 'q1',
      text: 'Responde a la tarea',
      type: 'textarea',
      order: 1,
    });
  }

  return questions;
}

export function useHomeworkForm({
  personalizedHomeworkId,
  content,
}: UseHomeworkFormOptions): UseHomeworkFormReturn {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [existingSubmission, setExistingSubmission] = useState<HomeworkSubmission | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Parse questions from content
  const questions = useMemo(() => parseQuestionsFromContent(content), [content]);

  const totalCount = questions.length;
  const answeredCount = Object.values(answers).filter((a) => a.trim().length > 0).length;

  // Check for existing submission on mount
  useEffect(() => {
    const checkExistingSubmission = async () => {
      try {
        const token = authApi.getToken();
        const response = await fetch(`/api/student/homework/${personalizedHomeworkId}/submission`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.submitted && data.submission) {
            setIsSubmitted(true);
            setExistingSubmission(data.submission);

            // Populate answers from existing submission
            const existingAnswers: Record<string, string> = {};
            for (const answer of data.submission.answers) {
              existingAnswers[answer.questionId] = answer.value;
            }
            setAnswers(existingAnswers);
          }
        }
      } catch (err) {
        console.error('Failed to check existing submission:', err);
      }
    };

    checkExistingSubmission();
  }, [personalizedHomeworkId]);

  const updateAnswer = useCallback((questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  }, []);

  const submitHomework = useCallback(async () => {
    if (isSubmitting || isSubmitted) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const token = authApi.getToken();

      // Convert answers to array format
      const answersArray: HomeworkAnswer[] = questions.map((q) => ({
        questionId: q.id,
        value: answers[q.id] || '',
      }));

      const response = await fetch(`/api/student/homework/${personalizedHomeworkId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ answers: answersArray }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Submission failed' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      setIsSubmitted(true);
    } catch (err) {
      console.error('Failed to submit homework:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit homework');
    } finally {
      setIsSubmitting(false);
    }
  }, [personalizedHomeworkId, questions, answers, isSubmitting, isSubmitted]);

  const resetForm = useCallback(() => {
    setAnswers({});
    setError(null);
  }, []);

  return {
    questions,
    answers,
    answeredCount,
    totalCount,
    isSubmitting,
    isSubmitted,
    existingSubmission,
    error,
    updateAnswer,
    submitHomework,
    resetForm,
  };
}
