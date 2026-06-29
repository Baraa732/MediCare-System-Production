import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  BadGatewayException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';

export interface DeepSeekHealthStatus {
  configured: boolean;
  reachable: boolean;
  model: string;
  baseUrl: string;
  message: string;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

@Injectable()
export class DeepSeekService {
  private readonly logger = new Logger(DeepSeekService.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private status: DeepSeekHealthStatus;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('DEEPSEEK_API_KEY') || '';
    this.baseUrl =
      this.configService.get<string>('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com';
    this.model = this.configService.get<string>('DEEPSEEK_MODEL') || 'deepseek-chat';
    this.timeoutMs = parseInt(this.configService.get<string>('DEEPSEEK_TIMEOUT') || '60000', 10);

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
    });

    this.status = {
      configured: !!this.apiKey,
      reachable: false,
      model: this.model,
      baseUrl: this.baseUrl,
      message: this.apiKey ? 'Not yet checked' : 'DEEPSEEK_API_KEY not set',
    };
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  getStatus(): DeepSeekHealthStatus {
    return { ...this.status };
  }

  async checkHealth(): Promise<DeepSeekHealthStatus> {
    if (!this.apiKey) {
      this.status = {
        configured: false,
        reachable: false,
        model: this.model,
        baseUrl: this.baseUrl,
        message: 'Set DEEPSEEK_API_KEY to enable cloud AI',
      };
      return this.status;
    }

    try {
      await this.client.post<ChatCompletionResponse>(
        '/chat/completions',
        {
          model: this.model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5,
        },
        { timeout: 15000 },
      );
      this.status = {
        configured: true,
        reachable: true,
        model: this.model,
        baseUrl: this.baseUrl,
        message: 'DeepSeek API ready',
      };
      this.logger.log(`DeepSeek ready — model ${this.model}`);
    } catch (err) {
      const msg = (err as Error).message;
      this.status = {
        configured: true,
        reachable: false,
        model: this.model,
        baseUrl: this.baseUrl,
        message: `DeepSeek unreachable: ${msg}`,
      };
      this.logger.warn(this.status.message);
    }

    return this.status;
  }

  async ensureAvailable(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    if (this.status.reachable) return true;
    await this.checkHealth();
    return this.status.reachable;
  }

  private mapAxiosError(err: AxiosError): never {
    const code = err.code || '';
    const apiMsg =
      (err.response?.data as { error?: { message?: string } })?.error?.message || err.message;

    this.logger.error(`DeepSeek request failed: ${code} ${apiMsg}`);

    if (err.response?.status === 401) {
      throw new ServiceUnavailableException('DeepSeek API key is invalid. Check DEEPSEEK_API_KEY.');
    }
    if (code === 'ECONNABORTED' || apiMsg.toLowerCase().includes('timeout')) {
      throw new GatewayTimeoutException('DeepSeek took too long to respond. Please retry.');
    }
    if (err.response?.status === 429) {
      throw new ServiceUnavailableException('DeepSeek rate limit reached. Please retry shortly.');
    }
    if (err.response?.status && err.response.status >= 500) {
      throw new BadGatewayException(`DeepSeek API error: ${apiMsg}`);
    }
    throw new ServiceUnavailableException(`DeepSeek request failed: ${apiMsg}`);
  }

  async generateChat(
    systemPrompt: string,
    userMessage: string,
    opts?: { maxTokens?: number; temperature?: number },
  ): Promise<{ text: string; promptTokens: number; completionTokens: number }> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'DeepSeek is not configured. Set DEEPSEEK_API_KEY in ai-service environment.',
      );
    }

    try {
      const response = await this.client.post<ChatCompletionResponse>('/chat/completions', {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: opts?.maxTokens ?? 512,
        temperature: opts?.temperature ?? 0.5,
        stream: false,
      });

      const text = (response.data.choices?.[0]?.message?.content || '').trim();
      if (!text) {
        throw new ServiceUnavailableException('DeepSeek returned an empty response.');
      }

      this.status.reachable = true;
      this.status.message = 'DeepSeek API ready';

      return {
        text,
        promptTokens: response.data.usage?.prompt_tokens || 0,
        completionTokens: response.data.usage?.completion_tokens || 0,
      };
    } catch (err) {
      if (axios.isAxiosError(err)) {
        this.mapAxiosError(err);
      }
      throw err;
    }
  }
}
