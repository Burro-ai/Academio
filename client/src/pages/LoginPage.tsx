import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '@/context/AuthContext';
import { GlassCard, GlassButton, GlassInput } from '@/components/glass';
import { UserRole } from '@/types';

type AuthMode = 'login' | 'register';

export function LoginPage() {
  const { login, register, isLoading, error, clearError } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('STUDENT');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match');
        return;
      }
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters');
        return;
      }
      if (!name.trim()) {
        setLocalError('Name is required');
        return;
      }

      try {
        await register({ email, password, name, role });
      } catch {
        // Error handled by context
      }
    } else {
      try {
        await login({ email, password });
      } catch {
        // Error handled by context
      }
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    clearError();
    setLocalError(null);
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <GlassCard variant="elevated" className="p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 backdrop-blur-md bg-emerald-500/30 border border-emerald-400/30 rounded-2xl flex items-center justify-center shadow-glass">
              <svg
                className="w-8 h-8 text-emerald-100"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-solid">Academio</h1>
            <p className="text-prominent mt-2">
              {mode === 'login' ? 'Welcome back!' : 'Create your account'}
            </p>
          </div>

          {/* Error Message */}
          {displayError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-4 p-3 backdrop-blur-md bg-red-500/20 border border-red-400/30 rounded-xl"
            >
              <p className="text-red-100 text-sm text-center">{displayError}</p>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-prominent mb-1.5">
                    Full Name
                  </label>
                  <GlassInput
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-prominent mb-1.5">
                    I am a...
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole('STUDENT')}
                      className={`p-3 rounded-xl border transition-all ${
                        role === 'STUDENT'
                          ? 'backdrop-blur-md bg-emerald-500/30 border-emerald-400/40 text-emerald-100'
                          : 'backdrop-blur-md bg-white/10 border-white/20 text-prominent hover:bg-white/20'
                      }`}
                    >
                      <svg
                        className="w-6 h-6 mx-auto mb-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        />
                      </svg>
                      <span className="text-sm font-medium">Student</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('TEACHER')}
                      className={`p-3 rounded-xl border transition-all ${
                        role === 'TEACHER'
                          ? 'backdrop-blur-md bg-blue-500/30 border-blue-400/40 text-blue-100'
                          : 'backdrop-blur-md bg-white/10 border-white/20 text-prominent hover:bg-white/20'
                      }`}
                    >
                      <svg
                        className="w-6 h-6 mx-auto mb-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                        />
                      </svg>
                      <span className="text-sm font-medium">Teacher</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-prominent mb-1.5">
                Email
              </label>
              <GlassInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-prominent mb-1.5">
                Password
              </label>
              <GlassInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-prominent mb-1.5">
                  Confirm Password
                </label>
                <GlassInput
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                />
              </div>
            )}

            <GlassButton
              type="submit"
              variant="primary"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : mode === 'login' ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </GlassButton>
          </form>

          {/* Switch Mode */}
          <div className="mt-6 text-center">
            <p className="text-prominent">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={switchMode}
                className="text-emerald-300 hover:text-emerald-200 font-medium"
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>

          {/* Demo Credentials */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-subtle text-center mb-2">Demo Credentials</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-prominent">
              <div className="p-2 backdrop-blur-sm bg-white/5 rounded-lg">
                <p className="font-medium">Teacher</p>
                <p className="text-subtle">sarah.johnson@academio.edu</p>
                <p className="text-subtle">password123</p>
              </div>
              <div className="p-2 backdrop-blur-sm bg-white/5 rounded-lg">
                <p className="font-medium">Student</p>
                <p className="text-subtle">emma.rodriguez@student.academio.edu</p>
                <p className="text-subtle">password123</p>
              </div>
            </div>
          </div>

          {/* Admin Link */}
          <div className="mt-4 text-center">
            <Link
              to="/admin"
              className="text-xs text-subtle hover:text-prominent transition-colors"
            >
              Admin Portal
            </Link>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
