import { ToolRegistry } from '../src/ai/security/tools/tool-registry.service';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('normalizes tool aliases', () => {
    expect(registry.normalizeToolName('search_clinic')).toBe('search_clinics');
    expect(registry.normalizeToolName('get_slots')).toBe('get_available_slots');
  });

  it('rejects unknown tools', () => {
    expect(registry.normalizeToolName('delete_all_data')).toBeNull();
  });

  it('validates search_clinics params', () => {
    const ok = registry.validateParams('search_clinics', { query: 'cardiology' });
    expect(ok.success).toBe(true);

    const bad = registry.validateParams('search_clinics', { query: 'x', clinicId: 'evil' });
    expect(bad.success).toBe(false);
  });

  it('rejects UUID in clinicRef', () => {
    const result = registry.validateParams('list_doctors', {
      clinicRef: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(false);
  });

  it('accepts opaque refs for book_appointment', () => {
    const result = registry.validateParams('book_appointment', { slotRef: 'SLT-M3Q8' });
    expect(result.success).toBe(true);
  });

  it('includes modify_appointment in approved list', () => {
    expect(registry.listApproved()).toContain('modify_appointment');
  });
});
