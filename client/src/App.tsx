import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ChatProvider } from '@/context/ChatContext';
import { TeacherProvider } from '@/context/TeacherContext';
import { StudentPage } from '@/pages/StudentPage';
import { AdminPage } from '@/pages/AdminPage';
import { TeacherPage } from '@/pages/TeacherPage';
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
        <div className="relative z-10 min-h-screen">
          <Routes>
            <Route
              path="/"
              element={
                <ChatProvider>
                  <StudentPage />
                </ChatProvider>
              }
            />
            <Route path="/admin" element={<AdminPage />} />
            <Route
              path="/teacher/*"
              element={
                <TeacherProvider>
                  <TeacherPage />
                </TeacherProvider>
              }
            />
          </Routes>
        </div>
      </BrowserRouter>
    </>
  );
}

export default App;
