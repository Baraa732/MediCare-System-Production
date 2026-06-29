import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { JwtCacheService } from '../services/jwt-cache.service';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly jwtCacheService: JwtCacheService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip authentication for public routes
    if (this.isPublicRoute(req.path, req.method)) {
      return next();
    }

    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
      throw new HttpException('Authorization header is required', HttpStatus.UNAUTHORIZED);
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      // Check cache first
      const cached = await this.jwtCacheService.get(token);
      
      if (cached) {
        // Cache hit - use cached validation
        (req as any).user = {
          id: cached.userId,
          role: cached.role,
          sessionId: cached.sessionId,
        };
        return next();
      }

      // Cache miss - validate with auth service
      const authServiceUrl = this.configService.get('AUTH_SERVICE_URL') || 'http://localhost:3001';
      const internalToken = this.configService.get<string>('INTERNAL_SERVICE_TOKEN');
      
      const response = await firstValueFrom(
        this.httpService.get(`${authServiceUrl}/v1/auth/validate-token`, {
          headers: {
            'Authorization': authHeader,
            ...(internalToken && { 'x-service-token': internalToken }),
          },
          timeout: 10000,
        })
      );

      if (response.status === 200) {
        // Add user info to request for downstream services
        const user = response.data.user;
        (req as any).user = user;
        
        // Cache the validation result
        await this.jwtCacheService.set(token, {
          userId: user.id,
          role: user.role,
          sessionId: user.sessionId,
          expiresAt: Date.now() + (5 * 60 * 1000), // 5 minutes
        });
        
        return next();
      } else {
        throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
      }
    } catch (error: any) {
      if (error.response) {
        throw new HttpException(error.response.data.message || 'Authentication failed', error.response.status);
      }
      throw new HttpException('Authentication service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  private isPublicRoute(path: string, method: string): boolean {
    const publicRoutes = [
      { path: '/api/auth/register', method: 'POST' },
      { path: '/api/auth/send-otp', method: 'POST' },
      { path: '/api/auth/forgot-password/send-otp', method: 'POST' },
      { path: '/api/auth/forgot-password/verify-otp', method: 'POST' },
      { path: '/api/auth/reset-password', method: 'POST' },
      { path: '/api/auth/verify-otp', method: 'POST' },
      { path: '/api/auth/login', method: 'POST' },
      { path: '/api/auth/resend-otp', method: 'POST' },
      { path: '/api/auth/check-otp-status', method: 'POST' },
      { path: '/api/auth/clinic-admin/activate', method: 'POST' },
      { path: '/api/auth/clinic-admin/onboarding-status', method: 'GET' },
      { path: '/api/system-manager/login', method: 'POST' },
      { path: '/api/health', method: 'GET' },
      { path: '/api/health/auth', method: 'GET' },
      { path: '/api/health/user', method: 'GET' },
      { path: '/api/health/system-manager', method: 'GET' },
    ];

    return publicRoutes.some(route => 
      route.path === path && route.method === method
    );
  }
}