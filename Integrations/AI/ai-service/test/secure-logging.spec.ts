import { hashRef } from '../src/ai/security/secure-logging';

describe('secure-logging', () => {
  it('hashRef never returns raw UUID', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const hashed = hashRef(uuid);
    expect(hashed).not.toBe(uuid);
    expect(hashed).toHaveLength(8);
  });
});
