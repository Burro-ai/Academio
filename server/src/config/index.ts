import dotenv from 'dotenv';
import path from 'path';

// Load .env from root directory
dotenv.config({ path: path.join(__dirname, '../../../.env') });

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // AI Provider: 'deepseek' (cloud) or 'ollama' (local)
  aiProvider: (process.env.AI_PROVIDER || 'deepseek') as 'deepseek' | 'ollama',

  // DeepSeek Cloud API (faster, recommended)
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    apiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1',
    model: process.env.AI_MODEL_NAME || 'deepseek-chat',
  },

  // Ollama (local, slower, for offline use)
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

  // CORS - supports multiple origins for development flexibility
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5174',
  // Additional allowed origins (comma-separated in env)
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:5175').split(',').map(o => o.trim()),

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
