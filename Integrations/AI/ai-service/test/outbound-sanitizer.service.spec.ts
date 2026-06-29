import { OutboundSanitizerService } from '../src/ai/security/outbound-sanitizer.service';
import { RedactionService } from '../src/ai/security/redaction.service';
import { InternalIdentifierLeakError } from '../src/ai/security/internal-identifier-leak.error';

const ANY_UUID =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

// The exact UUID from the production incident report.
const INCIDENT_UUID = 'a3d6d4b7-1edf-4476-a25f-c7f4f70df833';
const UUID_V4 = '550e8400-e29b-41d4-a716-446655440000';
const UUID_V7 = '01890a5d-ac96-774b-bcce-b302099a8057'; // version nibble = 7
const UUID_V1 = 'f47ac10b-58cc-11e1-b86c-0800200c9a66';
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

describe('OutboundSanitizerService', () => {
  let service: OutboundSanitizerService;

  beforeEach(() => {
    service = new OutboundSanitizerService();
  });

  describe('uuid masking', () => {
    it('RedactionService masks UUIDv7', () => {
      const legacy = new RedactionService();
      expect(legacy.redactOutput(`clinic id ${UUID_V7}`)).toContain('[redacted-id]');
      expect(legacy.redactOutput(`clinic id ${UUID_V7}`)).not.toContain(UUID_V7);
    });

    it('OutboundSanitizer redacts UUIDv7', () => {
      const out = service.sanitizeUserResponse(`clinic id ${UUID_V7}`);
      expect(out).not.toMatch(ANY_UUID);
      expect(out).toContain('[redacted-id]');
    });
  });

  describe('sanitizeUserResponse', () => {
    it.each([
      ['incident', INCIDENT_UUID],
      ['v1', UUID_V1],
      ['v4', UUID_V4],
      ['v7', UUID_V7],
      ['nil', NIL_UUID],
    ])('removes %s UUID from user-facing text', (_label, uuid) => {
      const out = service.sanitizeUserResponse(
        `Great! We're currently looking at Damascus Heart Clinic with ID ${uuid}.`,
      );
      expect(out).not.toMatch(ANY_UUID);
      expect(out).not.toContain(uuid);
    });

    it('reproduces and neutralizes the exact incident message', () => {
      const leaked = `Great! We're currently looking at Damascus Heart Clinic with ID ${INCIDENT_UUID}.`;
      const out = service.sanitizeUserResponse(leaked);
      expect(out).not.toContain(INCIDENT_UUID);
      expect(out).toContain('Damascus Heart Clinic');
    });

    it('redacts JWTs and internal endpoints', () => {
      const jwt =
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      expect(service.sanitizeUserResponse(`token ${jwt}`)).not.toContain(jwt);
      expect(
        service.sanitizeUserResponse('see http://clinic-service:3005/v1/clinics/abc'),
      ).toContain('[redacted-endpoint]');
    });

    it('strips leaked tool call artifacts from replies', () => {
      const leaked = `I have retrieved the list of doctors for you. They are [list_doctors('${INCIDENT_UUID}')].`;
      const out = service.sanitizeUserResponse(leaked);
      expect(out).not.toContain('list_doctors(');
      expect(out).not.toContain('[');
      expect(out).not.toContain(INCIDENT_UUID);
      expect(out).not.toMatch(ANY_UUID);
    });

    it('strips raw tool JSON payloads from replies', () => {
      const leaked = `{"tool":"list_doctors","params":{"clinicRef":"${INCIDENT_UUID}"}}`;
      const out = service.sanitizeUserResponse(leaked);
      expect(out).not.toContain('"tool"');
      expect(out).not.toContain(INCIDENT_UUID);
      expect(out).not.toMatch(ANY_UUID);
    });

    it('leaves opaque refs and clean text untouched', () => {
      const clean = 'I found Damascus Heart Clinic (Damascus). Ref CLN-A7K2, doctor DOC-X9P4.';
      expect(service.sanitizeUserResponse(clean)).toBe(clean);
    });
  });

  describe('assertPromptClean (fail-closed)', () => {
    it.each([
      ['incident', INCIDENT_UUID],
      ['v4', UUID_V4],
      ['v7', UUID_V7],
      ['nil', NIL_UUID],
    ])('throws InternalIdentifierLeakError when a %s UUID is in a prompt', (_label, uuid) => {
      expect(() => service.assertPromptClean(`Context: clinicRef: ${uuid}`)).toThrow(
        InternalIdentifierLeakError,
      );
    });

    it('does not throw for prompts containing only opaque refs', () => {
      expect(() =>
        service.assertPromptClean(
          'Context: Currently looking at Damascus Heart Clinic, clinicRef: CLN-A7K2, doctorRef: DOC-X9P4, Date: 2026-06-23',
        ),
      ).not.toThrow();
    });

    it('tags the leak surface and kind on the error', () => {
      let caught: InternalIdentifierLeakError | undefined;
      try {
        service.assertPromptClean(`clinicRef: ${UUID_V4}`);
      } catch (err) {
        caught = err as InternalIdentifierLeakError;
      }
      expect(caught).toBeInstanceOf(InternalIdentifierLeakError);
      expect(caught?.surface).toBe('prompt');
      expect(caught?.kind).toBe('uuid');
    });
  });

  describe('findLeak', () => {
    it('detects all UUID versions and returns null for clean refs', () => {
      expect(service.findLeak(UUID_V7)).toBe('uuid');
      expect(service.findLeak('CLN-A7K2 DOC-X9P4 SLT-M3Q8 APT-R6T1')).toBeNull();
    });
  });
});
