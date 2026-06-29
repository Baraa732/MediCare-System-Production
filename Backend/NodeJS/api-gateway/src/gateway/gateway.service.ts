import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { AxiosRequestConfig, AxiosResponse } from 'axios';

interface ServiceConfig {
  url: string;
  timeout: number;
}

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);
  private readonly services: Record<string, ServiceConfig>;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.services = {
      'auth-service': {
        url: this.configService.get('AUTH_SERVICE_URL') || 'http://localhost:3001',
        timeout: 30000,
      },
      'user-service': {
        url: this.configService.get('USER_SERVICE_URL') || 'http://localhost:3002',
        timeout: 30000,
      },
      'system-manager-service': {
        url: this.configService.get('SYSTEM_MANAGER_SERVICE_URL') || 'http://localhost:3003',
        timeout: 30000,
      },
      'emr-service': {
        url: this.configService.get('EMR_SERVICE_URL') || 'http://localhost:3004',
        timeout: 30000,
      },
    };
  }

  async proxyRequest(
    serviceName: string,
    path: string,
    method: string,
    body: any,
    headers: any,
    res: Response,
  ): Promise<void> {
    const service = this.services[serviceName];
    if (!service) {
      throw new HttpException(`Service ${serviceName} not found`, HttpStatus.BAD_GATEWAY);
    }

    const url = `${service.url}${path}`;
    
    // Filter and prepare headers
    const filteredHeaders = this.filterHeaders(headers);
    
    // Remove host header to avoid conflicts
    delete filteredHeaders['host'];

    // Attach internal service token so downstream services can verify the caller
    const internalToken = this.configService.get<string>('INTERNAL_SERVICE_TOKEN');
    if (internalToken) {
      filteredHeaders['x-service-token'] = internalToken;
    }
    
    const config: AxiosRequestConfig = {
      method: method as any,
      url,
      headers: filteredHeaders,
      timeout: service.timeout,
      validateStatus: () => true, // We'll handle status codes ourselves
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.data = body;
    }

    try {
      this.logger.log(`Proxying ${method} ${url}`);
      
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.request(config)
      );

      // Forward the response
      res.status(response.status);
      
      // Copy headers from response
      Object.keys(response.headers).forEach(key => {
        res.setHeader(key, response.headers[key]);
      });
      
      res.send(response.data);
      
    } catch (error: any) {
      this.logger.error(`Error proxying to ${serviceName}: ${error.message}`, error.stack);
      
      if (error.code === 'ECONNREFUSED') {
        throw new HttpException(
          `Service ${serviceName} is unavailable`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      
      if (error.response) {
        // Forward error response from service
        res.status(error.response.status);
        res.send(error.response.data);
      } else {
        throw new HttpException(
          `Gateway error: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  private filterHeaders(headers: any): Record<string, string> {
    const filtered: Record<string, string> = {};
    
    // List of headers to forward
    const allowedHeaders = [
      'authorization',
      'content-type',
      'accept',
      'user-agent',
      'x-requested-with',
      'x-csrf-token',
      'x-forwarded-for',
      'x-forwarded-proto',
      'x-forwarded-host',
      'x-request-id',
      'x-session-id',
      'x-tenant-id',
      'idempotency-key',
    ];

    Object.keys(headers).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (allowedHeaders.includes(lowerKey)) {
        filtered[key] = headers[key];
      }
    });

    return filtered;
  }

  async healthCheck(serviceName: string): Promise<{ status: string; responseTime?: number }> {
    const service = this.services[serviceName];
    if (!service) {
      return { status: 'SERVICE_NOT_FOUND' };
    }

    const startTime = Date.now();
    
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${service.url}/health`, { timeout: 5000 })
      );
      
      const responseTime = Date.now() - startTime;
      
      if (response.status === 200) {
        return { status: 'UP', responseTime };
      } else {
        return { status: 'DOWN' };
      }
    } catch (error) {
      return { status: 'DOWN' };
    }
  }
}