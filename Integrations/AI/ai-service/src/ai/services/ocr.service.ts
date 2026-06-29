import { Injectable, Logger, BadRequestException, OnModuleDestroy } from '@nestjs/common';
import { createWorker } from 'tesseract.js';

@Injectable()
export class OcrService implements OnModuleDestroy {
  private readonly logger = new Logger(OcrService.name);
  private workerPromise: ReturnType<typeof createWorker> | null = null;

  private async getWorker() {
    if (!this.workerPromise) {
      this.workerPromise = createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            this.logger.debug(`OCR progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      });
    }
    return this.workerPromise;
  }

  async extractTextFromBase64(imageBase64: string): Promise<string> {
    const cleaned = imageBase64.replace(/^data:image\/[a-z+]+;base64,/, '').trim();
    if (!cleaned) {
      throw new BadRequestException('Invalid imageBase64 payload');
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(cleaned, 'base64');
    } catch {
      throw new BadRequestException('imageBase64 is not valid base64');
    }

    if (buffer.length > 5 * 1024 * 1024) {
      throw new BadRequestException('Image exceeds 5MB limit');
    }

    try {
      const worker = await this.getWorker();
      const { data } = await worker.recognize(buffer);
      const text = data.text?.trim() || '';
      if (!text) {
        throw new BadRequestException('OCR could not extract text from the image');
      }
      return text;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`OCR failed: ${(err as Error).message}`);
      throw new BadRequestException('OCR processing failed');
    }
  }

  async onModuleDestroy() {
    if (this.workerPromise) {
      const worker = await this.workerPromise;
      await worker.terminate();
      this.workerPromise = null;
    }
  }
}
