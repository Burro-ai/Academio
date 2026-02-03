import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { pdfService } from '../services/pdf.service';
import { imageService } from '../services/image.service';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler.middleware';
import { FileUploadResult } from '../types';

export const uploadController = {
  /**
   * Handle file upload (PDF or Image)
   */
  async uploadFile(req: Request, res: Response) {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const file = req.file;
    const ext = path.extname(file.originalname).toLowerCase();
    const id = uuidv4();

    let result: FileUploadResult;

    // Handle PDF
    if (ext === '.pdf') {
      const extractedText = await pdfService.extractText(file.path);

      result = {
        id,
        filename: file.originalname,
        type: 'pdf',
        extractedText,
        path: file.path,
      };
    }
    // Handle images
    else if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      const processed = await imageService.processImage(
        file.path,
        config.paths.uploads
      );

      const metadata = await imageService.getMetadata(file.path);

      // For now, create a context prompt since DeepSeek may not support vision
      const contextPrompt = imageService.createImageContextPrompt(
        file.originalname,
        metadata
      );

      result = {
        id,
        filename: file.originalname,
        type: 'image',
        extractedText: contextPrompt,
        path: processed.processedPath,
      };
    } else {
      throw new AppError(
        'Unsupported file type. Please upload PDF or image files.',
        400
      );
    }

    res.json(result);
  },
};
