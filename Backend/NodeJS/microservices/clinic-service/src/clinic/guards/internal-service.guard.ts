import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalServiceGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-service-token'];
    const expected = this.configService.getOrThrow<string>('INTERNAL_SERVICE_TOKEN');

    if (!token || token !== expected) {
      throw new UnauthorizedException('Invalid or missing internal service token');
    }

    return true;
  }
}
