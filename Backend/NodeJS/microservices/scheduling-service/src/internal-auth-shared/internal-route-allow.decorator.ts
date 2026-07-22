import { SetMetadata } from '@nestjs/common';
import { InternalServiceName } from './types';

export const INTERNAL_ROUTE_ALLOW_KEY = 'internalRouteAllow';

export const InternalRouteAllow = (...callers: InternalServiceName[]) =>
  SetMetadata(INTERNAL_ROUTE_ALLOW_KEY, callers);
