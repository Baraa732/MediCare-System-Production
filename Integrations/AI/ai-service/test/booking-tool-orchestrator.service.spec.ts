import { ConfigService } from '@nestjs/config';
import { BookingToolOrchestrator } from '../src/ai/security/tools/booking-tool-orchestrator.service';
import { ToolRegistry } from '../src/ai/security/tools/tool-registry.service';
import { ReferenceResolverService } from '../src/ai/security/references/reference-resolver.service';
import { ToolResultSanitizerService } from '../src/ai/security/tool-result-sanitizer.service';
import { BookingSession } from '../src/ai/security/references/reference.types';

describe('BookingToolOrchestrator', () => {
  let orchestrator: BookingToolOrchestrator;
  let resolver: ReferenceResolverService;
  const stores = new Map<string, string>();
  const sessions = new Map<string, string>();

  const tools = {
    searchClinics: jest.fn(),
    listDoctors: jest.fn(),
    getAvailableSlots: jest.fn(),
    getUpcomingAppointments: jest.fn(),
    bookAppointment: jest.fn(),
    updateAppointment: jest.fn(),
    cancelAppointment: jest.fn(),
  };

  const sessionService = {
    save: jest.fn(async (patientId: string, sessionId: string, session: BookingSession) => {
      sessions.set(`booking:session:${patientId}:${sessionId}`, JSON.stringify(session));
    }),
  };

  const appointments = {
    verifyOwnership: jest.fn(),
  };

  beforeEach(() => {
    stores.clear();
    sessions.clear();
    jest.clearAllMocks();

    const config = {
      get: () => undefined,
      getOrThrow: () => 'redis://localhost:6379',
    } as unknown as ConfigService;

    resolver = new ReferenceResolverService(config);
    (resolver as any).redis = {
      get: jest.fn(async (key: string) => stores.get(key) || null),
      setex: jest.fn(async (key: string, _ttl: number, value: string) => {
        stores.set(key, value);
      }),
      del: jest.fn(async (key: string) => stores.delete(key)),
    };

    orchestrator = new BookingToolOrchestrator(
      new ToolRegistry(),
      resolver,
      tools as any,
      sessionService as any,
      appointments as any,
      new ToolResultSanitizerService(),
      config,
    );
  });

  it('denies tools with forbidden identity params', async () => {
    const { result } = await orchestrator.executeTool(
      'list_doctors',
      { clinicRef: 'CLN-AB12', patientId: 'attacker' },
      { patientId: 'p1', sessionId: 's1', userMessage: 'doctors' },
      { step: 'start' },
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/identity fields/i);
  });

  it('allocates clinic refs from search results without UUIDs in payload', async () => {
    await resolver.initStore('p1', 's1');
    tools.searchClinics.mockResolvedValue({
      success: true,
      data: {
        clinics: [{ id: 'uuid-clinic-1', name: 'Damascus Heart', city: 'Damascus' }],
      },
    });

    const { result } = await orchestrator.executeTool(
      'search_clinics',
      { query: 'heart' },
      { patientId: 'p1', sessionId: 's1', userMessage: 'heart clinic' },
      { step: 'start' },
    );

    expect(result.success).toBe(true);
    const clinics = result.data?.clinics as Array<{ clinicRef: string; name: string }>;
    expect(clinics[0].clinicRef).toMatch(/^CLN-[A-Z0-9]{4}$/);
    expect(JSON.stringify(result.data)).not.toContain('uuid-clinic-1');
  });

  it('returns denied (not throw) when tool uses unknown reference', async () => {
    await resolver.initStore('p1', 's1');
    const { result } = await orchestrator.executeTool(
      'list_doctors',
      { clinicRef: 'CLN-XXXX' },
      { patientId: 'p1', sessionId: 's1', userMessage: 'who are the doctors?' },
      { step: 'pick_doctor' },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('unknown_reference');
  });

  it('blocks book_appointment until confirm_book step', async () => {
    await resolver.initStore('p1', 's1');
    const slotRef = await resolver.allocate('p1', 's1', 'slot', 'slot-1');
    const { result } = await orchestrator.executeTool(
      'book_appointment',
      { slotRef },
      { patientId: 'p1', sessionId: 's1', userMessage: 'book', authHeader: 'Bearer x' },
      { step: 'pick_slot', selectedClinicRef: 'CLN-AB12', selectedDoctorRef: 'DOC-CD34' },
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/confirmation/i);
  });

  it('consumes slot ref after successful booking', async () => {
    await resolver.initStore('p1', 's1');
    const clinicRef = await resolver.allocate('p1', 's1', 'clinic', 'c1');
    const doctorRef = await resolver.allocate('p1', 's1', 'doctor', 'd1', {}, clinicRef);
    const slotRef = await resolver.allocate(
      'p1',
      's1',
      'slot',
      'slot-1',
      { startTime: '10:00', scheduledAt: '2026-06-25T10:00:00.000Z' },
      doctorRef,
    );
    tools.bookAppointment.mockResolvedValue({
      success: true,
      data: { appointmentId: 'appt-1' },
    });

    const { result } = await orchestrator.executeTool(
      'book_appointment',
      { slotRef },
      { patientId: 'p1', sessionId: 's1', userMessage: 'yes book', authHeader: 'Bearer x' },
      {
        step: 'confirm_book',
        selectedClinicRef: clinicRef,
        selectedDoctorRef: doctorRef,
        date: '2026-06-25',
        slotTime: '10:00',
      },
    );

    expect(result.success).toBe(true);
    await expect(resolver.resolve('p1', 's1', slotRef, 'slot')).rejects.toThrow('reference_consumed');
  });

  it('consumes appointment ref after cancel', async () => {
    await resolver.initStore('p1', 's1');
    const aptRef = await resolver.allocate('p1', 's1', 'appointment', 'appt-1');
    appointments.verifyOwnership.mockResolvedValue(true);
    tools.cancelAppointment.mockResolvedValue({ success: true, data: {} });

    const { result } = await orchestrator.executeTool(
      'cancel_appointment',
      { appointmentRef: aptRef, reason: 'busy' },
      { patientId: 'p1', sessionId: 's1', userMessage: 'cancel', authHeader: 'Bearer x' },
      { step: 'confirm_cancel' },
    );

    expect(result.success).toBe(true);
    await expect(resolver.resolve('p1', 's1', aptRef, 'appointment')).rejects.toThrow(
      'reference_consumed',
    );
  });
});
