export type LeakSurface = 'prompt' | 'reply' | 'summary';

export type LeakKind = 'uuid' | 'jwt' | 'internal_url' | 'credential';

/**
 * Thrown when an internal identifier (UUID, JWT, internal endpoint, credential)
 * is detected crossing a trust boundary it must never cross — e.g. an outbound
 * LLM prompt. Fail-closed: the request is aborted rather than leaking the value.
 */
export class InternalIdentifierLeakError extends Error {
  constructor(
    readonly surface: LeakSurface,
    readonly kind: LeakKind,
  ) {
    super(`Internal identifier leak detected on ${surface} (${kind})`);
    this.name = 'InternalIdentifierLeakError';
    Object.setPrototypeOf(this, InternalIdentifierLeakError.prototype);
  }
}
