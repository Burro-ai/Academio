import { useState, useCallback } from 'react';
import { api } from '@/services/api';

interface UploadedFile {
  id: string;
  filename: string;
  type: 'pdf' | 'image';
  extractedText?: string;
}

interface UseFileUploadReturn {
  uploadedFile: UploadedFile | null;
  isUploading: boolean;
  error: string | null;
  uploadFile: (file: File) => Promise<UploadedFile>;
  clearUpload: () => void;
}

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function useFileUpload(): UseFileUploadReturn {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(async (file: File): Promise<UploadedFile> => {
    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      const err = 'Invalid file type. Please upload a PDF or image.';
      setError(err);
      throw new Error(err);
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const err = 'File too large. Maximum size is 10MB.';
      setError(err);
      throw new Error(err);
    }

    setIsUploading(true);
    setError(null);

    try {
      const result = await api.uploadFile(file);
      setUploadedFile(result);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMsg);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const clearUpload = useCallback(() => {
    setUploadedFile(null);
    setError(null);
  }, []);

  return {
    uploadedFile,
    isUploading,
    error,
    uploadFile,
    clearUpload,
  };
}
