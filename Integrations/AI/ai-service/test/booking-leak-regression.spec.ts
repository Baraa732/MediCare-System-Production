import { BookingAgentService } from '../src/ai/services/booking-agent.service';
import { RedactionService } from '../src/ai/security/redaction.service';
import { OutboundSanitizerService } from '../src/ai/security/outbound-sanitizer.service';
import { InternalIdentifierLeakError } from '../src/ai/security/internal-identifier-leak.error';
import { BookingSession } from '../src/ai/security/references/reference.types';

const ANY_UUID =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const REDIS_REF = /\b(CLN|DOC|SLT|APT)-[A-Z0-9]{4}\b/;

const INCIDENT_UUID = 'a3d6d4b7-1edf-4476-a25f-c7f4f70df833';
const UUID_V7 = '01890a5d-ac96-774b-bcce-b302099a8057';

const PATIENT = 'patient-1';
const SESSION = 'session-1';

interface Harness {
  agent: BookingAgentService;
  executeTool: jest.Mock;
  runGraph: jest.Mock;
  save: jest.Mock;
  getSession: () => BookingSession;
}

function buildAgent(initial: BookingSession): Harness {
  let session: BookingSession = { ...initial };
  const tools = { searchDoctorsByName: jest.fn() } as any;

  const save = jest.fn(async (_p: string, _s: string, next: BookingSession) => {
    session = next;
  });
  const sessions = {
    assertActiveSession: jest.fn(async () => session),
    save,
  } as any;

  const config = { get: () => undefined } as any;
  const redaction = new RedactionService();
  const policy = { validateUserMessage: () => ({ allowed: true }) } as any;
  const executeTool = jest.fn();
  const orchestrator = { executeTool } as any;
  const outbound = new OutboundSanitizerService();
  const runGraph = jest.fn(async () => ({
    reply: 'How can I help with your booking?',
    session,
  }));
  const bookingGraph = { run: runGraph } as any;
  const memoryFacade = { recordTurn: jest.fn(), loadPatientMemory: jest.fn() } as any;

  const agent = new BookingAgentService(
    tools,
    sessions,
    config as any,
    redaction,
    policy,
    orchestrator,
    outbound,
    bookingGraph,
    memoryFacade,
  );

  return { agent, executeTool, runGraph, save, getSession: () => session };
}

describe('Booking flow — internal UUID leak regression', () => {
  it('clinic search returns refs only, reply has no UUID', async () => {
    const h = buildAgent({ step: 'start' });
    h.executeTool.mockResolvedValue({
      result: {
        success: true,
        data: {
          clinics: [{ clinicRef: 'CLN-A7K2', name: 'Damascus Heart Clinic', city: 'Damascus' }],
        },
      },
      summary: '1. Damascus Heart Clinic (Damascus)',
      session: {
        step: 'pick_doctor',
        selectedClinicRef: 'CLN-A7K2',
        clinicName: 'Damascus Heart Clinic',
      },
    });

    const { reply } = await h.agent.processMessage(SESSION, 'find a clinic in Damascus', PATIENT);

    expect(reply).toContain('Damascus Heart Clinic');
    expect(reply).not.toMatch(ANY_UUID);
    // Only opaque refs are passed to the tool layer — never a UUID.
    const [, params] = h.executeTool.mock.calls[0];
    expect(JSON.stringify(params)).not.toMatch(ANY_UUID);
    expect(params).toEqual(expect.objectContaining({ query: 'damascus' }));
  });

  it('normalizes phrase-based clinic search queries before calling the tool', async () => {
    const h = buildAgent({ step: 'start' });
    h.executeTool.mockResolvedValue({
      result: {
        success: true,
        data: {
          clinics: [{ clinicRef: 'CLN-A7K2', name: 'Damascus Heart Clinic', city: 'Damascus' }],
        },
      },
      summary: '1. Damascus Heart Clinic (Damascus)',
      session: {
        step: 'pick_doctor',
        selectedClinicRef: 'CLN-A7K2',
        clinicName: 'Damascus Heart Clinic',
      },
    });

    const { reply } = await h.agent.processMessage(
      SESSION,
      'search me about clinic in Damascus',
      PATIENT,
    );

    expect(h.executeTool).toHaveBeenCalledWith(
      'search_clinics',
      expect.objectContaining({ query: 'damascus' }),
      expect.anything(),
      expect.anything(),
    );
    expect(reply).toContain('Damascus Heart Clinic');
    expect(reply).not.toMatch(ANY_UUID);
  });

  it('doctor lookup reply has no UUID', async () => {
    const h = buildAgent({
      step: 'pick_doctor',
      selectedClinicRef: 'CLN-A7K2',
      clinicName: 'Damascus Heart Clinic',
    });
    h.executeTool.mockResolvedValue({
      result: {
        success: true,
        data: {
          doctors: [{ doctorRef: 'DOC-X9P4', name: 'Dr. Sample', specialization: 'Cardiology' }],
        },
      },
      summary: '1. Dr. Sample (Cardiology)',
      session: {
        step: 'pick_slot',
        selectedClinicRef: 'CLN-A7K2',
        clinicName: 'Damascus Heart Clinic',
      },
    });

    const { reply } = await h.agent.processMessage(
      SESSION,
      'show me doctors at that clinic',
      PATIENT,
    );

    expect(reply).not.toMatch(ANY_UUID);
    const [tool] = h.executeTool.mock.calls[0];
    expect(tool).toBe('list_doctors');
  });

  it('slot lookup path through LangGraph keeps reply UUID-free', async () => {
    const h = buildAgent({
      step: 'pick_slot',
      selectedClinicRef: 'CLN-A7K2',
      selectedDoctorRef: 'DOC-X9P4',
      clinicName: 'Damascus Heart Clinic',
      doctorName: 'Dr. Sample',
    });
    h.runGraph.mockResolvedValue({
      reply: 'Available time: 09:00. Would you like me to book it?',
      session: {
        step: 'confirm_book',
        selectedClinicRef: 'CLN-A7K2',
        selectedDoctorRef: 'DOC-X9P4',
      } as BookingSession,
    });

    const { reply } = await h.agent.processMessage(
      SESSION,
      'what times are available next monday',
      PATIENT,
    );

    expect(reply).not.toMatch(ANY_UUID);
    expect(h.runGraph).toHaveBeenCalled();
  });

  it('booking confirmation after "yeah" keeps reply UUID-free', async () => {
    const h = buildAgent({
      step: 'pick_slot',
      selectedClinicRef: 'CLN-A7K2',
      selectedDoctorRef: 'DOC-X9P4',
      pendingSlotRef: 'SLT-M3Q8',
      slotTime: '09:00',
      date: '2026-06-29',
    });
    h.runGraph.mockResolvedValue({
      reply: 'Your appointment is booked for 09:00.',
      session: { step: 'completed', pendingAppointmentRef: 'APT-R6T1' } as BookingSession,
    });

    const { reply } = await h.agent.processMessage(SESSION, 'yeah', PATIENT);

    expect(reply).not.toMatch(ANY_UUID);
    expect(reply.toLowerCase()).toContain('booked');
    expect(h.runGraph).toHaveBeenCalled();
  });

  it('follow-up "book the first one" does not crash and reply is clean', async () => {
    const h = buildAgent({
      step: 'pick_slot',
      selectedClinicRef: 'CLN-A7K2',
      selectedDoctorRef: 'DOC-X9P4',
      pendingSlotRef: 'SLT-M3Q8',
      slotTime: '09:00',
    });
    h.runGraph.mockResolvedValueOnce({
      reply: 'Booking the first available slot now.',
      session: h.getSession(),
    });

    const { reply } = await h.agent.processMessage(SESSION, 'book the first one', PATIENT);

    expect(reply).not.toMatch(ANY_UUID);
    expect(h.runGraph).toHaveBeenCalled();
  });

  it('handles "any tow clinics" by listing two clinics and doctors deterministically', async () => {
    const h = buildAgent({ step: 'start' });
    h.executeTool
      .mockResolvedValueOnce({
        result: {
          success: true,
          data: {
            clinics: [
              { clinicRef: 'CLN-A7K2', name: 'Damascus Heart Clinic', city: 'Damascus' },
              { clinicRef: 'CLN-B9Q1', name: 'Damascus Care Center', city: 'Damascus' },
            ],
          },
        },
        summary: '2 clinics found',
        session: { step: 'pick_doctor', selectedClinicRef: 'CLN-A7K2', clinicName: 'Damascus Heart Clinic' },
      })
      .mockResolvedValueOnce({
        result: {
          success: true,
          data: {
            doctors: [
              { doctorRef: 'DOC-X9P4', name: 'Dr. Alpha' },
              { doctorRef: 'DOC-Y8R3', name: 'Dr. Beta' },
            ],
          },
        },
        summary: '2 doctors',
        session: { step: 'pick_slot', selectedClinicRef: 'CLN-A7K2' },
      })
      .mockResolvedValueOnce({
        result: {
          success: true,
          data: {
            doctors: [
              { doctorRef: 'DOC-M2N7', name: 'Dr. Gamma' },
            ],
          },
        },
        summary: '1 doctor',
        session: { step: 'pick_slot', selectedClinicRef: 'CLN-B9Q1' },
      });

    const { reply } = await h.agent.processMessage(
      SESSION,
      'send me list with tow clinics , and the staff of doctors that work in these clinic !',
      PATIENT,
    );

    expect(reply).toContain('Here are two clinics and their listed doctors');
    expect(reply).toContain('Damascus Heart Clinic');
    expect(reply).toContain('Dr. Alpha');
    expect(reply).toContain('Damascus Care Center');
    expect(reply).toContain('Dr. Gamma');
    expect(h.executeTool).toHaveBeenCalledTimes(3);
    expect(h.runGraph).not.toHaveBeenCalled();
    expect(reply).not.toMatch(ANY_UUID);
  });

  it('handles location-only follow-up like "damascus" as clinic search', async () => {
    const h = buildAgent({ step: 'start' });
    h.executeTool.mockResolvedValueOnce({
      result: {
        success: true,
        data: {
          clinics: [{ clinicRef: 'CLN-A7K2', name: 'Damascus Heart Clinic', city: 'Damascus' }],
        },
      },
      summary: '1 clinic found',
      session: { step: 'pick_doctor', selectedClinicRef: 'CLN-A7K2', clinicName: 'Damascus Heart Clinic' },
    });

    const { reply } = await h.agent.processMessage(SESSION, 'damascus', PATIENT);

    expect(h.executeTool).toHaveBeenCalledWith(
      'search_clinics',
      expect.objectContaining({ query: 'damascus' }),
      expect.anything(),
      expect.anything(),
    );
    expect(reply).toContain('I found 1 clinic(s)');
    expect(h.runGraph).not.toHaveBeenCalled();
    expect(reply).not.toMatch(ANY_UUID);
  });

  it('handles "search me about 2 clinics" as a count request (not query "2")', async () => {
    const h = buildAgent({ step: 'start' });
    h.executeTool.mockResolvedValueOnce({
      result: {
        success: true,
        data: {
          clinics: [
            { clinicRef: 'CLN-A7K2', name: 'Damascus Heart Clinic', city: 'Damascus' },
            { clinicRef: 'CLN-B9Q1', name: 'Aleppo Family Medical Center', city: 'Aleppo' },
            { clinicRef: 'CLN-C3R7', name: 'Homs Care Hospital', city: 'Homs' },
          ],
        },
      },
      summary: '3 clinics found',
      session: { step: 'pick_doctor', selectedClinicRef: 'CLN-A7K2', clinicName: 'Damascus Heart Clinic' },
    });

    const { reply } = await h.agent.processMessage(SESSION, 'search me about 2 clinics', PATIENT);

    expect(h.executeTool).toHaveBeenCalledWith(
      'search_clinics',
      expect.objectContaining({ query: '' }),
      expect.anything(),
      expect.anything(),
    );
    expect(reply).toContain('Here are 2 clinic(s)');
    expect(reply).toContain('Damascus Heart Clinic');
    expect(reply).toContain('Aleppo Family Medical Center');
    expect(reply).not.toContain('Homs Care Hospital');
    expect(reply).not.toMatch(ANY_UUID);
  });

  it('uses selected clinic context for "any doctor" booking intent instead of re-searching clinics', async () => {
    const h = buildAgent({
      step: 'pick_doctor',
      selectedClinicRef: 'CLN-A7K2',
      clinicName: 'Damascus Heart Clinic',
    });

    const { reply } = await h.agent.processMessage(
      SESSION,
      'i want to book in this clinic, i dont need specific doctor, any doctor is fine but i need available slots',
      PATIENT,
    );

    expect(reply).toContain('Tell me your preferred date');
    expect(h.executeTool).not.toHaveBeenCalled();
    expect(h.runGraph).not.toHaveBeenCalled();
    expect(reply).not.toMatch(ANY_UUID);
  });

  it('checks slots for any doctor at current clinic when a date is provided', async () => {
    const h = buildAgent({
      step: 'pick_doctor',
      selectedClinicRef: 'CLN-A7K2',
      clinicName: 'Damascus Heart Clinic',
    });
    h.executeTool
      .mockResolvedValueOnce({
        result: {
          success: true,
          data: {
            doctors: [
              { doctorRef: 'DOC-X9P4', name: 'Dr. Alpha' },
              { doctorRef: 'DOC-Y8R3', name: 'Dr. Beta' },
            ],
          },
        },
        summary: '2 doctors',
        session: {
          step: 'pick_slot',
          selectedClinicRef: 'CLN-A7K2',
          clinicName: 'Damascus Heart Clinic',
        },
      })
      .mockResolvedValueOnce({
        result: {
          success: true,
          data: {
            slots: [
              { slotRef: 'SLT-M3Q8', startTime: '09:00' },
              { slotRef: 'SLT-Q2W1', startTime: '10:30' },
            ],
          },
        },
        summary: '2 slots',
        session: {
          step: 'pick_slot',
          selectedClinicRef: 'CLN-A7K2',
          selectedDoctorRef: 'DOC-X9P4',
          pendingSlotRef: 'SLT-M3Q8',
          slotTime: '09:00',
        },
      });

    const { reply } = await h.agent.processMessage(
      SESSION,
      'book in this clinic with any doctor tomorrow and show available slots',
      PATIENT,
    );

    expect(h.executeTool).toHaveBeenCalledWith(
      'list_doctors',
      expect.objectContaining({ clinicRef: 'CLN-A7K2' }),
      expect.anything(),
      expect.anything(),
    );
    expect(h.executeTool).toHaveBeenCalledWith(
      'get_available_slots',
      expect.objectContaining({ clinicRef: 'CLN-A7K2', doctorRef: 'DOC-X9P4' }),
      expect.anything(),
      expect.anything(),
    );
    expect(reply).toContain('I found available slots at Damascus Heart Clinic');
    expect(reply).toContain('Would you like me to book the first slot?');
    expect(reply).not.toMatch(ANY_UUID);
  });

  it('treats date-only follow-up like "tomorrow" as continuation for selected clinic slots', async () => {
    const h = buildAgent({
      step: 'pick_doctor',
      selectedClinicRef: 'CLN-A7K2',
      clinicName: 'Damascus Heart Clinic',
    });
    h.executeTool
      .mockResolvedValueOnce({
        result: {
          success: true,
          data: {
            doctors: [{ doctorRef: 'DOC-X9P4', name: 'Dr. Alpha' }],
          },
        },
        summary: '1 doctor',
        session: {
          step: 'pick_slot',
          selectedClinicRef: 'CLN-A7K2',
          clinicName: 'Damascus Heart Clinic',
        },
      })
      .mockResolvedValueOnce({
        result: {
          success: true,
          data: {
            slots: [{ slotRef: 'SLT-M3Q8', startTime: '09:00' }],
          },
        },
        summary: '1 slot',
        session: {
          step: 'pick_slot',
          selectedClinicRef: 'CLN-A7K2',
          selectedDoctorRef: 'DOC-X9P4',
          pendingSlotRef: 'SLT-M3Q8',
          slotTime: '09:00',
        },
      });

    const { reply } = await h.agent.processMessage(SESSION, 'tomorrow', PATIENT);

    expect(h.executeTool).toHaveBeenCalledWith(
      'list_doctors',
      expect.objectContaining({ clinicRef: 'CLN-A7K2' }),
      expect.anything(),
      expect.anything(),
    );
    expect(h.executeTool).toHaveBeenCalledWith(
      'get_available_slots',
      expect.objectContaining({ clinicRef: 'CLN-A7K2', doctorRef: 'DOC-X9P4' }),
      expect.anything(),
      expect.anything(),
    );
    expect(reply).toContain('I found available slots at Damascus Heart Clinic');
    expect(reply).not.toMatch(ANY_UUID);
  });

  it('redacts a UUID echoed by the model (the production incident)', async () => {
    const h = buildAgent({
      step: 'pick_doctor',
      selectedClinicRef: 'CLN-A7K2',
      clinicName: 'Damascus Heart Clinic',
    });
    h.runGraph.mockResolvedValueOnce({
      reply: `Great! We're currently looking at Damascus Heart Clinic with ID ${INCIDENT_UUID}.`,
      session: h.getSession(),
    });

    const { reply } = await h.agent.processMessage(SESSION, 'where are we in the booking', PATIENT);

    expect(reply).not.toContain(INCIDENT_UUID);
    expect(reply).not.toMatch(ANY_UUID);
    expect(reply).toContain('Damascus Heart Clinic');
  });

  it('redacts a UUIDv7 echoed by the model (missed by the legacy guard)', async () => {
    const h = buildAgent({ step: 'pick_doctor', selectedClinicRef: 'CLN-A7K2' });
    h.runGraph.mockResolvedValueOnce({
      reply: `Your record id is ${UUID_V7}.`,
      session: h.getSession(),
    });

    const { reply } = await h.agent.processMessage(SESSION, 'what is my record', PATIENT);

    expect(reply).not.toContain(UUID_V7);
    expect(reply).not.toMatch(ANY_UUID);
  });

  it('removes leaked tool-call syntax from booking replies', async () => {
    const h = buildAgent({ step: 'pick_doctor', selectedClinicRef: 'CLN-A7K2' });
    h.runGraph.mockResolvedValueOnce({
      reply: `I have retrieved the list of doctors for you. They are [list_doctors('${INCIDENT_UUID}')].`,
      session: h.getSession(),
    });

    const { reply } = await h.agent.processMessage(SESSION, 'who are the doctors?', PATIENT);

    expect(reply).not.toContain('list_doctors(');
    expect(reply).not.toContain(INCIDENT_UUID);
    expect(reply).not.toMatch(ANY_UUID);
  });

  it('FAILS CLOSED: a UUID in session context never reaches the model', async () => {
    // Simulates a regression where selected state stored a UUID instead of a ref.
    const h = buildAgent({
      step: 'pick_doctor',
      selectedClinicRef: INCIDENT_UUID as unknown as string,
      clinicName: 'Damascus Heart Clinic',
    });

    h.runGraph.mockRejectedValueOnce(new InternalIdentifierLeakError('prompt', 'uuid'));
    await expect(h.agent.processMessage(SESSION, 'book the first one', PATIENT)).rejects.toBeInstanceOf(
      InternalIdentifierLeakError,
    );
    expect(h.runGraph).toHaveBeenCalled();
  });

  it('persisted session state stores opaque refs, never UUIDs', async () => {
    const h = buildAgent({
      step: 'pick_slot',
      selectedClinicRef: 'CLN-A7K2',
      selectedDoctorRef: 'DOC-X9P4',
      pendingSlotRef: 'SLT-M3Q8',
      slotTime: '09:00',
      date: '2026-06-29',
    });
    h.runGraph.mockResolvedValue({
      reply: 'Your appointment is booked.',
      session: { step: 'completed', pendingAppointmentRef: 'APT-R6T1' } as BookingSession,
    });

    await h.agent.processMessage(SESSION, 'yeah', PATIENT);

    // Every session payload written to Redis must be free of internal UUIDs.
    expect(h.save).toHaveBeenCalled();
    for (const call of h.save.mock.calls) {
      expect(JSON.stringify(call[2])).not.toMatch(ANY_UUID);
    }
    const persisted = h.getSession();
    expect(persisted.selectedClinicRef).toMatch(REDIS_REF);
  });
});
