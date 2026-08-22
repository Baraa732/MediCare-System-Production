import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Skip JWT auth — for publicly fetchable media (clinic logos in <img>/Image.network). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
