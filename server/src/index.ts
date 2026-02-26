import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler.middleware';
import routes from './routes';
import { initializeDatabase } from './database/db';

const app = express();

// Ensure data directories exist
const ensureDirectories = () => {
  const dirs = [config.paths.data, config.paths.uploads];
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// CORS configuration - supports multiple origins for development flexibility
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    const allowedOrigins = [config.clientUrl, ...config.allowedOrigins];
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In development, allow any localhost or 127.0.0.1 port.
    // 127.0.0.1 must be explicit — browsers don't always treat it as equivalent to localhost.
    if (config.nodeEnv === 'development' && (
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:')
    )) {
      return callback(null, true);
    }

    console.warn(`[CORS] Blocked request from origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(config.paths.uploads));

// API Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    ensureDirectories();
    await initializeDatabase();

    app.listen(config.port, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🎓 Academio Server Running                               ║
║                                                            ║
║   Local:    http://localhost:${config.port}                      ║
║   Ollama:   ${config.ollama.baseUrl}                   ║
║   Model:    ${config.ollama.model}                         ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); // Initialize
