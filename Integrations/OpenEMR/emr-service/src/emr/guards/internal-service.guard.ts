import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class InternalServiceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-service-token'];
    const expected = process.env.INTERNAL_SERVICE_TOKEN?.trim();

    if (!expected || token !== expected) {
      throw new UnauthorizedException('Invalid internal service token');
    }

    return true;
  }
}
