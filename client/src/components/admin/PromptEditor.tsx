import { useState, useEffect } from 'react';
import { Button } from '@/components/common/Button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { api } from '@/services/api';

interface PromptEditorProps {
  password: string;
  onLogout: () => void;
}

export function PromptEditor({ password, onLogout }: PromptEditorProps) {
  const [prompt, setPrompt] = useState('');
  const [defaultPrompt, setDefaultPrompt] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadPrompt();
  }, []);

  const loadPrompt = async () => {
    setIsLoading(true);
    try {
      const data = await api.getSystemPrompt(password);
      setPrompt(data.prompt);
      setDefaultPrompt(data.defaultPrompt);
      setIsDefault(data.isDefault);
      setHasChanges(false);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load prompt' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      await api.updateSystemPrompt(password, prompt);
      setMessage({ type: 'success', text: 'Prompt saved successfully!' });
      setHasChanges(false);
      setIsDefault(prompt === defaultPrompt);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save prompt' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset to default Socratic prompt? Your current changes will be lost.')) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const data = await api.resetSystemPrompt(password);
      setPrompt(data.prompt);
      setIsDefault(true);
      setHasChanges(false);
      setMessage({ type: 'success', text: 'Prompt reset to default' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to reset prompt' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-100">
      {/* Header */}
      <header className="bg-white border-b border-surface-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-surface-800 flex items-center gap-2">
              <span>🎓</span>
              <span>Academio Admin</span>
            </h1>
            <p className="text-sm text-surface-500">System Prompt Management</p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="text-sm text-primary-600 hover:underline">
              ← Student Portal
            </a>
            <Button variant="secondary" size="sm" onClick={onLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Status bar */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                isDefault
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {isDefault ? 'Default Prompt' : 'Custom Prompt'}
            </span>
            {hasChanges && (
              <span className="text-sm text-amber-600">• Unsaved changes</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReset}
              disabled={isSaving || isDefault}
            >
              Reset to Default
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              isLoading={isSaving}
            >
              Save Changes
            </Button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Editor */}
        <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden">
          <div className="border-b border-surface-200 px-4 py-3 bg-surface-50">
            <h2 className="font-medium text-surface-700">System Prompt</h2>
            <p className="text-sm text-surface-500">
              This prompt defines how the AI tutor behaves. Edit carefully to maintain the Socratic teaching method.
            </p>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            className="w-full h-[600px] p-4 font-mono text-sm resize-none focus:outline-none"
            placeholder="Enter your system prompt..."
          />
        </div>

        {/* Warning */}
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h3 className="font-medium text-amber-800 mb-1">Important Reminder</h3>
          <p className="text-sm text-amber-700">
            The system prompt must preserve the <strong>Socratic Prime Directive</strong>:
            The AI must never give direct answers. It should guide students to discover
            answers through questioning, analogies, and step-by-step breakdowns.
          </p>
        </div>
      </main>
    </div>
  );
}
