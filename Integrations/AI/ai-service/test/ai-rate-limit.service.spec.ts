import { AiRateLimitService } from '../src/ai/services/ai-rate-limit.service';
import { ConfigService } from '@nestjs/config';

describe('AiRateLimitService memory fallback', () => {
  it('E6 enforces limit in memory when redis is unavailable', async () => {
    const service = new AiRateLimitService({
      get: (key: string) => {
        if (key === 'AI_RATE_LIMIT_MAX') return '2';
        if (key === 'AI_RATE_LIMIT_WINDOW_SECONDS') return '60';
        return undefined;
      },
    } as ConfigService);

    await service.check('user-1');
    await service.check('user-1');
    await expect(service.check('user-1')).rejects.toMatchObject({
      status: 429,
    });
  });
});
