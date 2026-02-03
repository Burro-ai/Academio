import fs from 'fs/promises';
import pdfParse from 'pdf-parse';

class PdfService {
  /**
   * Extract text content from a PDF file
   */
  async extractText(filePath: string): Promise<string> {
    try {
      const buffer = await fs.readFile(filePath);
      const data = await pdfParse(buffer);

      // Clean up the extracted text
      let text = data.text;

      // Remove excessive whitespace
      text = text.replace(/\s+/g, ' ').trim();

      // Limit text length to avoid overwhelming the LLM
      const maxLength = 10000;
      if (text.length > maxLength) {
        text = text.substring(0, maxLength) + '... [content truncated]';
      }

      return text;
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }

  /**
   * Get PDF metadata
   */
  async getMetadata(
    filePath: string
  ): Promise<{ pages: number; title?: string; author?: string }> {
    try {
      const buffer = await fs.readFile(filePath);
      const data = await pdfParse(buffer);

      return {
        pages: data.numpages,
        title: data.info?.Title,
        author: data.info?.Author,
      };
    } catch (error) {
      console.error('PDF metadata error:', error);
      throw new Error('Failed to read PDF metadata');
    }
  }
}

export const pdfService = new PdfService();
