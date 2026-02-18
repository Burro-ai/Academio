import { useState, useCallback, useMemo, useEffect } from 'react';
import { HomeworkQuestion, HomeworkAnswer, HomeworkSubmission, HomeworkQuestionJson } from '@/types';
import { authApi } from '@/services/authApi';

interface UseHomeworkFormOptions {
  personalizedHomeworkId: string;
  content: string;
  questionsJson?: HomeworkQuestionJson[];  // Structured questions from backend
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
 * Convert JSON questions to form questions
 * Maps the backend HomeworkQuestionJson format to the frontend HomeworkQuestion format
 */
function convertJsonToFormQuestions(questionsJson: HomeworkQuestionJson[]): HomeworkQuestion[] {
  return questionsJson.map((q, index) => ({
    id: `q${q.id}`,
    text: q.text,
    type: q.text.length > 100 ? 'textarea' : 'text',
    order: index + 1,
  }));
}

/**
 * Legacy fallback: Parse questions from homework content using regex
 * Only used when questionsJson is not available (for backwards compatibility)
 */
function parseQuestionsFromContent(content: string): HomeworkQuestion[] {
  const questions: HomeworkQuestion[] = [];

  // Pattern to match numbered questions: "1. Question text" or "1) Question text"
  const pattern = /(?:^|\n)\s*(\d+)[.)]\s*(.+?)(?=(?:\n\s*\d+[.)])|$)/gs;
  const matches = [...content.matchAll(pattern)];

  if (matches.length > 0) {
    matches.forEach((match, index) => {
      const questionNumber = match[1];
      let questionText = match[2].trim()
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
  }

  // If no questions found, create a single question for general response
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
  questionsJson,
}: UseHomeworkFormOptions): UseHomeworkFormReturn {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [existingSubmission, setExistingSubmission] = useState<HomeworkSubmission | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Use JSON questions if available, otherwise fall back to content parsing
  const questions = useMemo(() => {
    // Prioritize structured JSON questions from backend
    if (questionsJson && questionsJson.length > 0) {
      console.log(`[HomeworkForm] Using ${questionsJson.length} JSON questions`);
      return convertJsonToFormQuestions(questionsJson);
    }
    // Fallback to regex parsing for backwards compatibility
    console.log('[HomeworkForm] Falling back to content parsing');
    return parseQuestionsFromContent(content);
  }, [questionsJson, content]);

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
