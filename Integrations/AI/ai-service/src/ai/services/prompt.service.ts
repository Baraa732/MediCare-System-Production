import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PromptService {
  private readonly logger = new Logger(PromptService.name);
  private readonly cache = new Map<string, string>();
  private readonly promptsDir: string;

  constructor(private configService: ConfigService) {
    const candidates = [
      path.join(process.cwd(), 'prompts'),
      path.join(process.cwd(), '..', 'prompts'),
      path.join(process.cwd(), 'dist', 'prompts'),
      path.join(__dirname, '..', '..', '..', 'prompts'),
      path.join(__dirname, '..', '..', 'prompts'),
    ];
    this.promptsDir = candidates.find((d) => fs.existsSync(d)) || candidates[0];
    this.logger.log(`Prompt templates directory: ${this.promptsDir}`);
  }

  load(templateName: string): string {
    const cached = this.cache.get(templateName);
    if (cached) return cached;

    const filePath = path.join(this.promptsDir, `${templateName}.prompt`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Prompt template not found: ${templateName}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    this.cache.set(templateName, content);
    return content;
  }

  render(templateName: string, variables: Record<string, string>): string {
    let template = this.load(templateName);
    for (const [key, value] of Object.entries(variables)) {
      template = template.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
    }
    return template;
  }
}
