import { ToolResultSanitizerService } from '../src/ai/security/tool-result-sanitizer.service';

describe('ToolResultSanitizerService', () => {
  let sanitizer: ToolResultSanitizerService;

  beforeEach(() => {
    sanitizer = new ToolResultSanitizerService();
  });

  it('summarizes clinics without UUIDs', () => {
    const summary = sanitizer.summarize('search_clinics', {
      success: true,
      data: {
        clinics: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Damascus Heart Clinic',
            city: 'Damascus',
          },
        ],
      },
    });
    expect(summary).toContain('Damascus Heart Clinic');
    expect(summary).not.toMatch(/550e8400-e29b-41d4-a716-446655440000/);
  });

  it('summarizes upcoming appointments without internal ids', () => {
    const summary = sanitizer.summarize('get_upcoming_appointments', {
      success: true,
      data: {
        appointments: [
          {
            appointmentId: 'secret-uuid',
            clinicName: 'Heart Clinic',
            doctorName: 'Dr. Layla',
            scheduledAt: '2026-06-25T10:00:00Z',
            status: 'SCHEDULED',
          },
        ],
      },
    });
    expect(summary).toContain('Heart Clinic');
    expect(summary).not.toContain('secret-uuid');
  });
});
