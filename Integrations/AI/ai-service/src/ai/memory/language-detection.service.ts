import { Injectable, OnModuleInit } from '@nestjs/common';

const SUPPORTED_LANGS = new Set(['ar', 'en', 'fr']);

const FRANC_TO_ISO6391: Record<string, string> = {
  ara: 'ar',
  arz: 'ar',
  apc: 'ar',
  acm: 'ar',
  eng: 'en',
  fra: 'fr',
};

type FrancDetector = (text: string, options?: { minLength?: number }) => string;

export interface DetectedMessageLang {
  detectedLang?: string;
}

@Injectable()
export class LanguageDetectionService implements OnModuleInit {
  private francDetect?: FrancDetector;

  async onModuleInit(): Promise<void> {
    try {
      const mod = await import('franc');
      this.francDetect = mod.franc;
    } catch {
      this.francDetect = undefined;
    }
  }

  detect(text: string): string {
    const trimmed = (text || '').trim();
    if (!trimmed) return 'en';

    if (/[\u0600-\u06FF]/.test(trimmed)) {
      return 'ar';
    }

    if (trimmed.length < 10) {
      return this.fallbackFromScript(trimmed);
    }

    if (this.francDetect) {
      const code = this.francDetect(trimmed, { minLength: 10 });
      if (code !== 'und') {
        const mapped = FRANC_TO_ISO6391[code] || code.slice(0, 2);
        if (SUPPORTED_LANGS.has(mapped)) {
          return mapped;
        }
      }
    }

    return this.fallbackFromScript(trimmed);
  }

  resolveSummaryLanguage(
    messages: DetectedMessageLang[],
    preferredLanguage?: string,
  ): string {
    const preferred = (preferredLanguage || '').trim().slice(0, 2);
    if (preferred && SUPPORTED_LANGS.has(preferred)) {
      return preferred;
    }

    const counts = new Map<string, number>();
    for (const message of messages) {
      const lang = message.detectedLang;
      if (!lang || !SUPPORTED_LANGS.has(lang)) continue;
      counts.set(lang, (counts.get(lang) || 0) + 1);
    }

    let best = 'en';
    let max = 0;
    const tiePriority: Record<string, number> = { ar: 3, fr: 2, en: 1 };
    for (const [lang, count] of counts) {
      const priority = tiePriority[lang] || 0;
      const bestPriority = tiePriority[best] || 0;
      if (count > max || (count === max && priority > bestPriority)) {
        max = count;
        best = lang;
      }
    }
    return best;
  }

  private fallbackFromScript(text: string): string {
    if (/[\u0600-\u06FF]/.test(text)) return 'ar';
    if (/[àâçéèêëîïôùûüœæ]/i.test(text)) return 'fr';
    return 'en';
  }
}
