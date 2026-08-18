/** First public hop from X-Forwarded-For, then Express req.ip. */
export function clientIp(req: {
  ip?: string;
  socket?: { remoteAddress?: string };
  headers?: Record<string, string | string[] | undefined>;
}): string {
  const forwarded = req.headers?.['x-forwarded-for'] ?? req.headers?.['x-real-ip'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const fromHeader = typeof raw === 'string' ? raw.split(',')[0]?.trim() : '';
  const value = fromHeader || req.ip || req.socket?.remoteAddress || '';
  return value.replace(/^::ffff:/, '') || 'unknown';
}
