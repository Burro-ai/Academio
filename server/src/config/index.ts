import dotenv from 'dotenv';
import path from 'path';

// Load .env from root directory
dotenv.config({ path: path.join(__dirname, '../../../.env') });

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Ollama
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'deepseek-r1:1.5b',
  },

  // JWT Authentication
  jwtSecret: process.env.JWT_SECRET || 'academio-jwt-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Admin
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',

  // Teacher (legacy - use JWT auth now)
  teacherPassword: process.env.TEACHER_PASSWORD || 'teacher123',

  // CORS
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  // Paths
  paths: {
    data: path.join(__dirname, '../../data'),
    uploads: path.join(__dirname, '../../data/uploads'),
    systemPrompt: path.join(__dirname, '../../data/system-prompt.txt'),
    teacherSystemPrompt: path.join(__dirname, '../../data/teacher-system-prompt.txt'),
    database: path.join(__dirname, '../../data/sqlite.db'),
    fewShotPrompts: path.join(__dirname, '../../data/few-shot-prompts'),
  },
};
