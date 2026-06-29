import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  BadGatewayException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';

export interface GeminiHealthStatus {
  configured: boolean;
  reachable: boolean;
  model: string;
  baseUrl: string;
  message: string;
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private status: GeminiHealthStatus;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    this.baseUrl =
      this.configService.get<string>('GEMINI_BASE_URL') ||
      'https://generativelanguage.googleapis.com/v1beta';
    this.model = this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
    this.timeoutMs = parseInt(this.configService.get<string>('GEMINI_TIMEOUT') || '60000', 10);

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.status = {
      configured: !!this.apiKey,
      reachable: false,
      model: this.model,
      baseUrl: this.baseUrl,
      message: this.apiKey ? 'Not yet checked' : 'GEMINI_API_KEY not set',
    };
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  getStatus(): GeminiHealthStatus {
    return { ...this.status };
  }

  async checkHealth(): Promise<GeminiHealthStatus> {
    if (!this.apiKey) {
      this.status = {
        configured: false,
        reachable: false,
        model: this.model,
        baseUrl: this.baseUrl,
        message: 'Set GEMINI_API_KEY to enable Google Gemini',
      };
      return this.status;
    }

    try {
      await this.client.get(`/${this.modelPath()}`, {
        params: { key: this.apiKey },
      });
      this.status = {
        configured: true,
        reachable: true,
        model: this.model,
        baseUrl: this.baseUrl,
        message: 'Gemini API ready',
      };
      this.logger.log(`Gemini ready — model ${this.model}`);
    } catch (err) {
      const msg = (err as Error).message;
      this.status = {
        configured: true,
        reachable: false,
        model: this.model,
        baseUrl: this.baseUrl,
        message: `Gemini unreachable: ${msg}`,
      };
      this.logger.warn(this.status.message);
    }

    return this.status;
  }

  private mapAxiosError(err: AxiosError): never {
    const code = err.code || '';
    const apiMsg =
      (err.response?.data as { error?: { message?: string } })?.error?.message || err.message;

    this.logger.error(`Gemini request failed: ${code} ${apiMsg}`);

    if (err.response?.status === 400) {
      throw new ServiceUnavailableException(`Gemini request rejected: ${apiMsg}`);
    }
    if (err.response?.status === 401 || err.response?.status === 403) {
      throw new ServiceUnavailableException('Gemini API key is invalid. Check GEMINI_API_KEY.');
    }
    if (code === 'ECONNABORTED' || apiMsg.toLowerCase().includes('timeout')) {
      throw new GatewayTimeoutException('Gemini took too long to respond. Please retry.');
    }
    if (err.response?.status === 429) {
      throw new ServiceUnavailableException('Gemini rate limit reached. Please retry shortly.');
    }
    if (err.response?.status && err.response.status >= 500) {
      throw new BadGatewayException(`Gemini API error: ${apiMsg}`);
    }
    throw new ServiceUnavailableException(`Gemini request failed: ${apiMsg}`);
  }

  private modelPath(): string {
    return this.model.startsWith('models/') ? this.model : `models/${this.model}`;
  }

  async generateChat(
    systemPrompt: string,
    userMessage: string,
    opts?: { maxTokens?: number; temperature?: number },
  ): Promise<{ text: string; promptTokens: number; completionTokens: number }> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Gemini is not configured. Set GEMINI_API_KEY in ai-service environment.',
      );
    }

    try {
      const response = await this.client.post<GeminiGenerateResponse>(
        `/${this.modelPath()}:generateContent`,
        {
          systemInstruction: {
            role: 'system',
            parts: [{ text: systemPrompt }],
          },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          generationConfig: {
            maxOutputTokens: opts?.maxTokens ?? 512,
            temperature: opts?.temperature ?? 0.5,
          },
        },
        {
          params: { key: this.apiKey },
        },
      );

      const text =
        response.data.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || '')
          .join('\n')
          .trim() || '';
      if (!text) {
        throw new ServiceUnavailableException('Gemini returned an empty response.');
      }

      this.status.reachable = true;
      this.status.message = 'Gemini API ready';

      return {
        text,
        promptTokens: response.data.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.data.usageMetadata?.candidatesTokenCount || 0,
      };
    } catch (err) {
      if (axios.isAxiosError(err)) {
        this.mapAxiosError(err);
      }
      throw err;
    }
  }
}
