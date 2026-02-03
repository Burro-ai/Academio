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

// Middleware
app.use(cors({ origin: config.clientUrl, credentials: true }));
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
