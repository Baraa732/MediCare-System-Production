import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import {
  createCorrelationId,
  requestLogContext,
} from '../../ai/security/secure-logging';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers['x-correlation-id'];
    const correlationId =
      typeof incoming === 'string' && incoming.length > 0
        ? incoming
        : createCorrelationId();
    res.setHeader('x-correlation-id', correlationId);
    requestLogContext.run({ correlationId }, () => next());
  }
}
