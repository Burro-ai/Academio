import { Request, Response } from 'express';
import { promptService } from '../services/prompt.service';
import { AppError } from '../middleware/errorHandler.middleware';

export const adminController = {
  /**
   * Get the current system prompt
   */
  async getPrompt(req: Request, res: Response) {
    const prompt = await promptService.getPrompt();
    const defaultPrompt = promptService.getDefaultPrompt();

    res.json({
      prompt,
      defaultPrompt,
      isDefault: prompt === defaultPrompt,
    });
  },

  /**
   * Update the system prompt
   */
  async updatePrompt(req: Request, res: Response) {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      throw new AppError('prompt is required and must be a string', 400);
    }

    if (prompt.trim().length < 50) {
      throw new AppError('Prompt must be at least 50 characters', 400);
    }

    await promptService.savePrompt(prompt);

    res.json({
      success: true,
      message: 'System prompt updated successfully',
    });
  },

  /**
   * Reset to default Socratic prompt
   */
  async resetPrompt(req: Request, res: Response) {
    await promptService.resetToDefault();

    res.json({
      success: true,
      message: 'System prompt reset to default',
      prompt: promptService.getDefaultPrompt(),
    });
  },

  /**
   * Verify admin credentials
   */
  async verifyAuth(req: Request, res: Response) {
    // If we reach here, auth middleware passed
    res.json({ authenticated: true });
  },
};
