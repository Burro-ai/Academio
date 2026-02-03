import fs from 'fs/promises';
import path from 'path';

// Try to load sharp, but make it optional for platforms without support
let sharp: typeof import('sharp') | null = null;
try {
  sharp = require('sharp');
} catch (error) {
  console.warn('Sharp not available, using fallback image processing');
}

class ImageService {
  /**
   * Process and optimize an uploaded image
   * Returns the path to the processed image and base64 for LLM
   */
  async processImage(
    filePath: string,
    outputDir: string
  ): Promise<{ processedPath: string; base64: string; mimeType: string }> {
    const filename = path.basename(filePath);
    const ext = path.extname(filename).toLowerCase();

    // If sharp is available, use it for processing
    if (sharp) {
      try {
        const outputPath = path.join(outputDir, `processed_${filename}`);

        // Get image metadata
        const metadata = await sharp(filePath).metadata();

        // Resize if too large (max 1024px on longest side for LLM efficiency)
        let pipeline = sharp(filePath);

        const maxDimension = 1024;
        if (
          (metadata.width && metadata.width > maxDimension) ||
          (metadata.height && metadata.height > maxDimension)
        ) {
          pipeline = pipeline.resize(maxDimension, maxDimension, {
            fit: 'inside',
            withoutEnlargement: true,
          });
        }

        // Convert to JPEG for consistency and smaller size
        const processedBuffer = await pipeline.jpeg({ quality: 85 }).toBuffer();

        // Save processed image
        await fs.writeFile(outputPath, processedBuffer);

        // Convert to base64 for potential LLM vision capabilities
        const base64 = processedBuffer.toString('base64');

        return {
          processedPath: outputPath,
          base64,
          mimeType: 'image/jpeg',
        };
      } catch (error) {
        console.error('Sharp processing failed, using fallback:', error);
      }
    }

    // Fallback: just read the file as-is
    const buffer = await fs.readFile(filePath);
    const base64 = buffer.toString('base64');

    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };

    return {
      processedPath: filePath,
      base64,
      mimeType: mimeTypes[ext] || 'image/jpeg',
    };
  }

  /**
   * Get image metadata
   */
  async getMetadata(
    filePath: string
  ): Promise<{ width: number; height: number; format: string }> {
    // If sharp is available, use it
    if (sharp) {
      try {
        const metadata = await sharp(filePath).metadata();
        return {
          width: metadata.width || 0,
          height: metadata.height || 0,
          format: metadata.format || 'unknown',
        };
      } catch (error) {
        console.error('Sharp metadata failed:', error);
      }
    }

    // Fallback: return placeholder metadata
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    return {
      width: 0,
      height: 0,
      format: ext || 'unknown',
    };
  }

  /**
   * Create a text description prompt for an image
   * (Used when LLM doesn't support vision directly)
   */
  createImageContextPrompt(filename: string, metadata: { width: number; height: number }): string {
    const sizeInfo = metadata.width > 0 ? ` (${metadata.width}x${metadata.height}px)` : '';
    return `[The student has uploaded an image: "${filename}"${sizeInfo}. Please ask them to describe what's in the image or what question they have about it, since you cannot view images directly.]`;
  }
}

export const imageService = new ImageService();
