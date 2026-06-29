import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiLlmProvider } from './gemini-llm.provider';
import { LlmProvider } from './llm-provider';

const SUPPORTED = ['gemini'] as const;
type SupportedProvider = (typeof SUPPORTED)[number];

@Injectable()
export class LlmProviderRegistry {
  constructor(
    private readonly config: ConfigService,
    private readonly geminiProvider: GeminiLlmProvider,
  ) {}

  resolve(): LlmProvider {
    const configured = (this.config.get<string>('AI_PROVIDER') || 'gemini').toLowerCase();
    const provider = this.resolveConfiguredProvider(configured);
    return this.providerFor(provider);
  }

  private resolveConfiguredProvider(configured: string): SupportedProvider {
    if (configured === 'gemini') return 'gemini';
    if (
      configured === 'claude' ||
      configured === 'openai' ||
      configured === 'deepseek' ||
      configured === 'openrouter'
    ) {
      throw new ServiceUnavailableException(
        `AI_PROVIDER=${configured} is planned but not wired yet. Available now: gemini.`,
      );
    }
    throw new ServiceUnavailableException(
      `Unsupported AI_PROVIDER=${configured}. Available: ${SUPPORTED.join(', ')}`,
    );
  }

  private providerFor(provider: SupportedProvider): LlmProvider {
    if (provider === 'gemini') return this.geminiProvider;
    throw new ServiceUnavailableException(`Unsupported AI provider: ${provider}`);
  }
}
