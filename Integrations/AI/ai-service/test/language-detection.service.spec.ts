import { LanguageDetectionService } from '../src/ai/memory/language-detection.service';

describe('LanguageDetectionService', () => {
  let service: LanguageDetectionService;

  beforeEach(() => {
    service = new LanguageDetectionService();
  });

  it('detects Arabic script as ar', () => {
    expect(service.detect('أريد حجز موعد في عيادة القلب صباحاً')).toBe('ar');
  });

  it('detects English as en', () => {
    expect(
      service.detect('I would like to book a cardiology appointment in the morning please'),
    ).toBe('en');
  });

  it('detects French as fr', () => {
    expect(
      service.detect(
        'Je voudrais réserver un rendez-vous en cardiologie le matin dans ma région',
      ),
    ).toBe('fr');
  });

  it('falls back to en for empty text', () => {
    expect(service.detect('')).toBe('en');
    expect(service.detect('   ')).toBe('en');
  });

  it('prefers preferred_language memory when supported', () => {
    const lang = service.resolveSummaryLanguage(
      [
        { detectedLang: 'en' },
        { detectedLang: 'en' },
        { detectedLang: 'ar' },
      ],
      'fr',
    );
    expect(lang).toBe('fr');
  });

  it('uses majority vote from detected_lang when preferred language is absent', () => {
    const lang = service.resolveSummaryLanguage([
      { detectedLang: 'en' },
      { detectedLang: 'ar' },
      { detectedLang: 'ar' },
      { detectedLang: 'en' },
    ]);
    expect(lang).toBe('ar');
  });

  it('falls back to en when no detected languages are present', () => {
    expect(service.resolveSummaryLanguage([])).toBe('en');
    expect(service.resolveSummaryLanguage([{ detectedLang: undefined }])).toBe('en');
  });
});
