import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileUploadButton } from '@/components/common/FileUploadButton';
import { useFileUpload } from '@/hooks/useFileUpload';

interface ChatInputProps {
  onSend: (message: string, attachmentContext?: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder,
}: ChatInputProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { uploadedFile, isUploading, uploadFile, clearUpload, error: uploadError } = useFileUpload();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || disabled) return;

    onSend(message.trim(), uploadedFile?.extractedText);
    setMessage('');
    clearUpload();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileSelect = async (file: File) => {
    try {
      await uploadFile(file);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-white/15 backdrop-blur-xl bg-white/15 p-4">
      {/* Upload preview */}
      {uploadedFile && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 glass-surface">
          <span>{uploadedFile.type === 'pdf' ? '📄' : '🖼️'}</span>
          <span className="flex-1 text-sm text-prominent truncate">
            {uploadedFile.filename}
          </span>
          <button
            type="button"
            onClick={clearUpload}
            className="text-subtle hover:text-solid transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div className="mb-3 px-3 py-2 backdrop-blur-md bg-red-500/20 border border-red-400/30 text-red-100 rounded-lg text-sm">
          {uploadError}
        </div>
      )}

      <div className="flex items-end gap-2">
        <FileUploadButton
          onFileSelect={handleFileSelect}
          isLoading={isUploading}
          disabled={disabled}
        />

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || t('chat.askAbout', { topic: t('topicLabels.general') })}
            disabled={disabled}
            rows={1}
            className="w-full resize-none rounded-xl px-4 py-3
                       backdrop-blur-md bg-white/20 border border-white/20
                       focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-white/40
                       placeholder:text-surface-500/70 text-solid
                       disabled:bg-white/10 disabled:cursor-not-allowed
                       transition-all duration-200"
          />
        </div>

        <button
          type="submit"
          disabled={!message.trim() || disabled}
          className="flex-shrink-0 p-3 glass-btn-primary rounded-xl
                     disabled:bg-white/20 disabled:border-white/15 disabled:text-surface-400 disabled:cursor-not-allowed
                     transition-all duration-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>

      <p className="mt-2 text-xs text-subtle text-center">
        {t('chat.pressEnterToSend')}
      </p>
    </form>
  );
}
