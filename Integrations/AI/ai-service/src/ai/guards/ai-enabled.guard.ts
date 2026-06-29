import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeepSeekService } from '../services/deepseek.service';
import { GeminiService } from '../services/gemini.service';

@Injectable()
export class AiEnabledGuard implements CanActivate {
  constructor(
    private deepSeekService: DeepSeekService,
    private geminiService: GeminiService,
    private configService: ConfigService,
  ) {}

  private isPatientChatRoute(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ url?: string; path?: string }>();
    const path = request.url || request.path || '';
    return path.includes('patient-chat');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPatientChatRoute(context)) {
      const mode = this.configService.get<string>('PATIENT_CHAT_MODE') || 'hybrid';
      if (mode === 'template' || mode === 'hybrid') return true;

      const provider = (this.configService.get<string>('PATIENT_CHAT_PROVIDER') || 'auto').toLowerCase();
      if (provider === 'deepseek') {
        if (await this.deepSeekService.ensureAvailable()) return true;
      } else if (provider === 'gemini') {
        const status = await this.geminiService.checkHealth();
        if (status.reachable) return true;
      } else {
        const geminiStatus = await this.geminiService.checkHealth();
        if (geminiStatus.reachable) return true;
        if (await this.deepSeekService.ensureAvailable()) return true;
      }

      throw new ServiceUnavailableException(
        'Patient chat LLM unavailable — configure GEMINI_API_KEY (or DEEPSEEK_API_KEY).',
      );
    }

    const aiProvider = (this.configService.get<string>('AI_PROVIDER') || 'gemini').toLowerCase();
    if (aiProvider === 'deepseek') {
      if (await this.deepSeekService.ensureAvailable()) return true;
      throw new ServiceUnavailableException(
        'AI service is currently unavailable. DeepSeek is not configured or unreachable.',
      );
    }

    const geminiStatus = await this.geminiService.checkHealth();
    if (!geminiStatus.reachable) {
      throw new ServiceUnavailableException(
        geminiStatus.message || 'AI service is currently unavailable. Gemini is unreachable.',
      );
    }
    return true;
  }
}
