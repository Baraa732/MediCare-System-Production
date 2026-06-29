import { Injectable, CanActivate, ExecutionContext, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService } from '../services/rate-limit.service';
import { RateLimitType } from '../entities/rate-limit.entity';

export const RATE_LIMIT_TYPE_KEY = 'rateLimitType';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rateLimitService: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimitType = this.reflector.getAllAndOverride<RateLimitType>(
      RATE_LIMIT_TYPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!rateLimitType) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    // Prefer authenticated userId, fall back to IP
    const identifier = request.user?.userId || request.ip || 'unknown';

    const result = await this.rateLimitService.checkRateLimit(identifier, rateLimitType);

    if (!result.allowed) {
      const res = context.switchToHttp().getResponse();
      res.setHeader('Retry-After', result.retryAfter ?? 60);
      throw new BadRequestException(
        `Too many requests. Please try again in ${result.retryAfter ?? 60} seconds.`,
      );
    }

    const res = context.switchToHttp().getResponse();
    res.setHeader('X-RateLimit-Remaining', result.remaining);

    return true;
  }
}

export const RateLimit = (type: RateLimitType) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(RATE_LIMIT_TYPE_KEY, type, descriptor.value);
  };
};
