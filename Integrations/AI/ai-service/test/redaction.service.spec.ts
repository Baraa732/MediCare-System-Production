import { RedactionService } from '../src/ai/security/redaction.service';

describe('RedactionService', () => {
  let service: RedactionService;

  beforeEach(() => {
    service = new RedactionService();
  });

  it('redacts UUIDs from output', () => {
    const input = 'Your appointment id is 550e8400-e29b-41d4-a716-446655440000';
    expect(service.redactOutput(input)).not.toMatch(/550e8400-e29b-41d4-a716-446655440000/);
    expect(service.redactOutput(input)).toContain('[redacted-id]');
  });

  it('redacts UUIDv7 from output', () => {
    const input = 'Your clinic id is 01890a5d-ac96-774b-bcce-b302099a8057';
    expect(service.redactOutput(input)).not.toMatch(/01890a5d-ac96-774b-bcce-b302099a8057/);
    expect(service.redactOutput(input)).toContain('[redacted-id]');
  });

  it('redacts JWT tokens', () => {
    const token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    expect(service.redactOutput(`Bearer ${token}`)).toContain('[redacted-token]');
  });

  it('sanitizes internal URLs', () => {
    const text = 'Call http://appointment-service:3007/v1/appointments/abc';
    expect(service.sanitizeUserInput(text)).toContain('[redacted-endpoint]');
  });

  it('redactValue recursively redacts nested messages', () => {
    const value = service.redactValue({
      message: 'id 550e8400-e29b-41d4-a716-446655440000',
      nested: ['token eyJhbGciOiJIUzI1NiJ9.abc.def'],
    });
    expect(JSON.stringify(value)).not.toMatch(/550e8400-e29b-41d4-a716-446655440000/);
  });
});
