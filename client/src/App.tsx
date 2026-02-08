import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { LoginPage } from '@/pages/LoginPage';
import { StudentDashboard } from '@/pages/StudentDashboard';
import { TeacherDashboard } from '@/pages/TeacherDashboard';
import { AdminPage } from '@/pages/AdminPage';
import { DynamicBackground } from '@/components/layout/DynamicBackground';
import { LiquidEdgeFilter } from '@/components/effects/LiquidEdgeFilter';

function App() {
  return (
    <>
      {/* SVG Filters for liquid effects */}
      <LiquidEdgeFilter />

      {/* Animated gradient mesh background */}
      <DynamicBackground />

      {/* Main app content */}
      <BrowserRouter>
        <AuthProvider>
          <div className="relative z-10 min-h-screen">
            <Routes>
              {/* Auth Routes */}
              <Route path="/login" element={<LoginPage />} />

              {/* Dashboard Routes (JWT Auth) */}
              <Route path="/dashboard/student/*" element={<StudentDashboard />} />
              <Route path="/dashboard/teacher/*" element={<TeacherDashboard />} />

              {/* Root redirects to login */}
              <Route path="/" element={<Navigate to="/login" replace />} />

              {/* Admin route */}
              <Route path="/admin" element={<AdminPage />} />

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </div>
        </AuthProvider>
      </BrowserRouter>
    </>
  );
}

export default App;
