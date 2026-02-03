import { useState, useCallback } from 'react';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { PromptEditor } from '@/components/admin/PromptEditor';
import { api } from '@/services/api';

export function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');

  const handleLogin = useCallback(async (pwd: string): Promise<boolean> => {
    const success = await api.adminVerify(pwd);
    if (success) {
      setIsAuthenticated(true);
      setPassword(pwd);
    }
    return success;
  }, []);

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
    setPassword('');
  }, []);

  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return <PromptEditor password={password} onLogout={handleLogout} />;
}
