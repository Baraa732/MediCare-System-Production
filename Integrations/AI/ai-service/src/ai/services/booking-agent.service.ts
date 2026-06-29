import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { BookingToolsService } from './booking-tools.service';
import { BookingSessionService } from './booking-session.service';
import { ConfigService } from '@nestjs/config';
import { RedactionService } from '../security/redaction.service';
import { BookingPolicyService } from '../security/booking-policy.service';
import { OutboundSanitizerService } from '../security/outbound-sanitizer.service';
import { BookingToolOrchestrator } from '../security/tools/booking-tool-orchestrator.service';
import { BookingSession } from '../security/references/reference.types';
import { BookingLangGraphWorkflow } from './booking-langgraph.workflow';
import { PatientMemoryFacade } from '../memory/patient-memory.facade';

@Injectable()
export class BookingAgentService {
  private readonly logger = new Logger(BookingAgentService.name);

  constructor(
    private toolsService: BookingToolsService,
    private sessionService: BookingSessionService,
    private configService: ConfigService,
    private redactionService: RedactionService,
    private policyService: BookingPolicyService,
    private orchestrator: BookingToolOrchestrator,
    private outboundSanitizer: OutboundSanitizerService,
    private bookingGraph: BookingLangGraphWorkflow,
    private memoryFacade: PatientMemoryFacade,
  ) {}

  async processMessage(
    sessionId: string,
    message: string,
    patientId: string,
    authHeader?: string,
  ): Promise<{ reply: string }> {
    const trimmed = this.redactionService.sanitizeUserInput(message.trim());

    const injectionCheck = this.policyService.validateUserMessage(trimmed);
    if (!injectionCheck.allowed) {
      throw new ForbiddenException(injectionCheck.reason || 'Invalid request.');
    }

    if (/^(hi|hello|hey|good morning|good afternoon|salam|marhaba)[!.?\s]*$/i.test(trimmed)) {
      return {
        reply: this.outboundSanitizer.sanitizeUserResponse(
          "Hello! I'm your medical appointment assistant. I can help you find clinics, book appointments, or check your upcoming visits. What would you like to do?",
        ),
      };
    }
    if (/^how are you[?.!\s]*$/i.test(trimmed)) {
      return {
        reply: this.outboundSanitizer.sanitizeUserResponse(
          "I'm good, thank you. How can I help with clinics, doctors, or appointments?",
        ),
      };
    }

    if (this.isNonMedicalQuery(trimmed)) {
      return {
        reply: this.outboundSanitizer.sanitizeUserResponse(
          'I can only help with medical appointments. For other matters, please contact support.',
        ),
      };
    }

    let session = await this.sessionService.assertActiveSession(patientId, sessionId);
    session = await this.applyConfirmationFromUserMessage(trimmed, session, patientId, sessionId);

    const deterministicReply = await this.tryHandleDeterministicQueries(
      trimmed,
      session,
      patientId,
      sessionId,
      authHeader,
    );
    if (deterministicReply) {
      const reply = this.outboundSanitizer.sanitizeUserResponse(deterministicReply);
      await this.recordTurnIfPossible(patientId, trimmed, reply);
      return { reply };
    }

    if (!this.isLangGraphEnabled()) {
      const reply = this.outboundSanitizer.sanitizeUserResponse(
        "I'm a medical appointment assistant. Please ask about clinics, doctors, slots, or bookings.",
      );
      await this.recordTurnIfPossible(patientId, trimmed, reply);
      return { reply };
    }

    const result = await this.bookingGraph.run({
      sessionId,
      patientId,
      authHeader,
      message: trimmed,
      session,
    });
    const reply = this.outboundSanitizer.sanitizeUserResponse(result.reply);
    await this.recordTurnIfPossible(patientId, trimmed, reply);
    return { reply };
  }

  private async applyConfirmationFromUserMessage(
    message: string,
    session: BookingSession,
    patientId: string,
    sessionId: string,
  ): Promise<BookingSession> {
    const affirmative = /^(yes|yeah|yep|confirm|ok|okay|sure|go ahead|book it|please book)\b/i.test(
      message.trim(),
    );
    if (!affirmative) return session;

    let next = { ...session };
    if (session.step === 'pick_slot' && session.pendingSlotRef) {
      next.step = 'confirm_book';
      await this.sessionService.save(patientId, sessionId, next);
      return next;
    }
    if (session.step === 'pick_slot' && session.slotTime) {
      next.step = 'confirm_book';
      await this.sessionService.save(patientId, sessionId, next);
      return next;
    }
    return session;
  }

  private isNonMedicalQuery(message: string): boolean {
    const msg = message.toLowerCase();
    const nonMedical = [
      'weather', 'news', 'stock', 'sports', 'movie', 'music', 'recipe',
      'game', 'joke', 'story', 'math', 'calculate', 'translate',
      'shopping', 'buy', 'price of', 'amazon', 'ebay',
    ];
    const medical = [
      'appointment', 'book', 'clinic', 'doctor', 'schedule', 'cancel',
      'visit', 'checkup', 'medical', 'hospital', 'health', 'patient',
      'reschedule', 'available', 'slot', 'time', 'tomorrow', 'today',
    ];
    const hasNonMedical = nonMedical.some((kw) => msg.includes(kw));
    const hasMedical = medical.some((kw) => msg.includes(kw));
    return hasNonMedical && !hasMedical;
  }

  private async tryHandleDeterministicQueries(
    message: string,
    session: BookingSession,
    patientId: string,
    sessionId: string,
    authHeader?: string,
  ): Promise<string | null> {
    const lower = message.toLowerCase();

    if (this.isClinicAndDoctorBatchRequest(lower)) {
      return this.handleClinicAndDoctorBatchRequest(
        message,
        session,
        patientId,
        sessionId,
        authHeader,
      );
    }

    const requestedClinicCount = this.extractRequestedClinicCount(lower);
    if (requestedClinicCount && this.isClinicCountOnlyRequest(lower)) {
      return this.handleClinicCountRequest(
        message,
        requestedClinicCount,
        session,
        patientId,
        sessionId,
        authHeader,
      );
    }

    const doctorNameQuery = this.extractDoctorNameQuery(message);
    if (doctorNameQuery) {
      const result = await this.toolsService.searchDoctorsByName(doctorNameQuery, authHeader);
      const doctors = Array.isArray(result.data?.doctors) ? result.data.doctors : [];
      if (doctors.length === 0) {
        return `I searched the current doctor data for "${doctorNameQuery}" but did not find a match.`;
      }
      const items = doctors
        .slice(0, 10)
        .map((d: any, i: number) => {
          const doctorName =
            d.name ||
            [d.firstName, d.lastName].filter(Boolean).join(' ').trim() ||
            d.fullName ||
            'Doctor';
          const location = d.clinicName
            ? `${d.clinicName}${d.clinicCity ? ` (${d.clinicCity})` : ''}`
            : 'No active clinic assignment';
          return `${i + 1}. ${doctorName}${d.specialization ? ` - ${d.specialization}` : ''} | ${location}`;
        })
        .join('\n');
      return `I found ${doctors.length} matching doctor(s):\n${items}`;
    }

    if (lower.includes('doctor') && (lower.includes('first clinic') || lower.includes('that clinic'))) {
      if (!session.selectedClinicRef) {
        return 'Please ask me to find clinics first, then I can list doctors for the first result.';
      }
      const { result, session: updated } = await this.orchestrator.executeTool(
        'list_doctors',
        { clinicRef: session.selectedClinicRef },
        { patientId, sessionId, userMessage: message, authHeader },
        session,
      );
      session = updated;
      const doctors = (result.data?.doctors as any[]) || [];
      const clinicName = session.clinicName || 'the selected clinic';
      if (!result.success || doctors.length === 0) {
        return `I checked ${clinicName}, but there are no doctors listed yet. You can try another clinic from the search results.`;
      }
      const items = doctors
        .slice(0, 8)
        .map((d: any, i: number) => {
          const name = d.name || 'Doctor';
          return `${i + 1}. ${name}${d.specialization ? ` - ${d.specialization}` : ''}`;
        })
        .join('\n');
      return `Here are the doctors at ${clinicName}:\n${items}\n\nTell me the doctor and date you want, and I can check available slots.`;
    }

    if (this.isAnyDoctorSlotsIntent(lower, session, message)) {
      return this.handleAnyDoctorSlotsIntent(message, session, patientId, sessionId, authHeader);
    }

    const clinicNameQuery = this.extractClinicNameQuery(message);
    if (clinicNameQuery) {
      const { result } = await this.orchestrator.executeTool(
        'search_clinics',
        { query: clinicNameQuery },
        { patientId, sessionId, userMessage: message, authHeader },
        session,
      );
      const clinics = (result.data?.clinics as any[]) || [];
      if (!result.success || clinics.length === 0) {
        return `I could not find a clinic named "${clinicNameQuery}" in the current data.`;
      }
      const items = clinics
        .slice(0, 5)
        .map((c: any, i: number) => `${i + 1}. ${c.name}${c.city ? ` (${c.city})` : ''}${c.address ? ` - ${c.address}` : ''}`)
        .join('\n');
      return `Yes, I found ${clinics.length} clinic(s) matching "${clinicNameQuery}":\n${items}`;
    }

    if ((lower.includes('find') || lower.includes('search')) && lower.includes('clinic')) {
      const query = this.buildClinicSearchQuery(message);
      const { result, session: updated } = await this.orchestrator.executeTool(
        'search_clinics',
        { query },
        { patientId, sessionId, userMessage: message, authHeader },
        session,
      );
      const clinics = (result.data?.clinics as any[]) || [];
      if (!result.success || clinics.length === 0) {
        return 'I could not find matching clinics right now. Try another location or specialization.';
      }
      session = updated;
      const items = clinics
        .slice(0, 5)
        .map((c: any, i: number) => `${i + 1}. ${c.name}${c.city ? ` (${c.city})` : ''}${c.address ? ` - ${c.address}` : ''}`)
        .join('\n');
      return `I found ${clinics.length} clinic(s):\n${items}\n\nWould you like me to show doctors for the first clinic?`;
    }

    if (this.isClinicDiscoveryIntent(lower) || this.isLikelyLocationOnlyQuery(message, session)) {
      const query = this.buildClinicSearchQuery(message);
      const { result } = await this.orchestrator.executeTool(
        'search_clinics',
        { query },
        { patientId, sessionId, userMessage: message, authHeader },
        session,
      );
      const clinics = (result.data?.clinics as any[]) || [];
      if (!result.success || clinics.length === 0) {
        return 'I could not find matching clinics right now. Try another location or specialization.';
      }
      const items = clinics
        .slice(0, 5)
        .map((c: any, i: number) => `${i + 1}. ${c.name}${c.city ? ` (${c.city})` : ''}${c.address ? ` - ${c.address}` : ''}`)
        .join('\n');
      return `I found ${clinics.length} clinic(s):\n${items}\n\nWould you like me to show doctors for the first clinic?`;
    }

    return null;
  }

  private isClinicAndDoctorBatchRequest(lower: string): boolean {
    const wantsClinics = /clinic/.test(lower);
    const wantsDoctors = /doctor|staff|specialist/.test(lower);
    const wantsTwo = /\b(two|2|tow)\b/.test(lower);
    const broadRequest = /\b(any|send|show|list|give)\b/.test(lower);
    return wantsClinics && wantsDoctors && wantsTwo && broadRequest;
  }

  private isClinicCountOnlyRequest(lower: string): boolean {
    const wantsClinics = /clinic/.test(lower);
    const asksListing = /\b(any|send|show|list|give|search|find)\b/.test(lower);
    const asksDoctors = /doctor|staff|specialist/.test(lower);
    return wantsClinics && asksListing && !asksDoctors;
  }

  private extractRequestedClinicCount(lower: string): number | null {
    const numeric = lower.match(/\b(\d{1,2})\b/);
    if (numeric?.[1]) {
      const n = parseInt(numeric[1], 10);
      if (Number.isFinite(n) && n > 0 && n <= 10) return n;
    }
    if (/\b(two|tow)\b/.test(lower)) return 2;
    if (/\bthree\b/.test(lower)) return 3;
    if (/\bfour\b/.test(lower)) return 4;
    if (/\bfive\b/.test(lower)) return 5;
    return null;
  }

  private async handleClinicCountRequest(
    message: string,
    requestedCount: number,
    session: BookingSession,
    patientId: string,
    sessionId: string,
    authHeader?: string,
  ): Promise<string> {
    const query = this.buildClinicSearchQuery(message);
    const { result } = await this.orchestrator.executeTool(
      'search_clinics',
      { query },
      { patientId, sessionId, userMessage: message, authHeader },
      session,
    );
    const clinics = (result.data?.clinics as any[]) || [];
    if (!result.success || clinics.length === 0) {
      return 'I could not find matching clinics right now. Try another location or specialization.';
    }
    const listed = clinics.slice(0, requestedCount);
    const items = listed
      .map(
        (c: any, i: number) =>
          `${i + 1}. ${c.name}${c.city ? ` (${c.city})` : ''}${c.address ? ` - ${c.address}` : ''}`,
      )
      .join('\n');
    return `I found ${clinics.length} clinic(s). Here are ${listed.length} clinic(s):\n${items}\n\nWould you like me to show doctors for the first clinic?`;
  }

  private async handleClinicAndDoctorBatchRequest(
    message: string,
    session: BookingSession,
    patientId: string,
    sessionId: string,
    authHeader?: string,
  ): Promise<string> {
    const query = this.buildClinicSearchQuery(message);
    const clinicResult = await this.orchestrator.executeTool(
      'search_clinics',
      { query },
      { patientId, sessionId, userMessage: message, authHeader },
      session,
    );
    const clinics = (clinicResult.result.data?.clinics as any[]) || [];
    if (!clinicResult.result.success || clinics.length === 0) {
      return 'I could not find matching clinics right now. Try another location or specialization.';
    }

    let workingSession = clinicResult.session;
    const selected = clinics.slice(0, 2);
    const blocks: string[] = [];

    for (let i = 0; i < selected.length; i++) {
      const clinic = selected[i];
      const doctorResult = await this.orchestrator.executeTool(
        'list_doctors',
        { clinicRef: clinic.clinicRef },
        { patientId, sessionId, userMessage: message, authHeader },
        workingSession,
      );
      workingSession = doctorResult.session;
      const doctors = (doctorResult.result.data?.doctors as any[]) || [];
      const names = doctors.slice(0, 5).map((d: any) => d.name || 'Doctor');
      const doctorLine =
        names.length > 0 ? names.join(', ') : 'No doctors listed currently';
      blocks.push(`${i + 1}. ${clinic.name || 'Clinic'}${clinic.city ? ` (${clinic.city})` : ''}: ${doctorLine}`);
    }

    return `Here are two clinics and their listed doctors:\n${blocks.join('\n')}`;
  }

  private isClinicDiscoveryIntent(lower: string): boolean {
    const asksClinics = /clinic/.test(lower);
    const asksListing = /\b(any|show|list|give|available|near|in)\b/.test(lower);
    return asksClinics && asksListing;
  }

  private isAnyDoctorSlotsIntent(
    lower: string,
    session: BookingSession,
    message: string,
  ): boolean {
    const wantsSlotLookup = /\b(slot|slots|available|availability|time|times)\b/.test(lower);
    const wantsBooking = /\b(book|booking|appointment)\b/.test(lower);
    const mentionsClinicContext =
      /\b(this clinic|that clinic|same clinic|selected clinic|current clinic)\b/.test(lower) ||
      (!!session.selectedClinicRef && /\bclinic\b/.test(lower)) ||
      (!!session.clinicName && lower.includes(session.clinicName.toLowerCase())) ||
      !!this.extractClinicNameFromFreeText(message);
    const anyDoctor =
      /\b(any doctor|any available doctor|no specific doctor|normal to book)\b/.test(lower) ||
      /don'?t\s+need\s+specific\s+doctor/.test(lower) ||
      /do\s+not\s+need\s+specific\s+doctor/.test(lower);
    const dateOnlyFollowUp = !!session.selectedClinicRef && this.isDateOnlyMessage(lower);
    return (mentionsClinicContext && (wantsSlotLookup || wantsBooking) && anyDoctor) || dateOnlyFollowUp;
  }

  private async handleAnyDoctorSlotsIntent(
    message: string,
    session: BookingSession,
    patientId: string,
    sessionId: string,
    authHeader?: string,
  ): Promise<string> {
    let workingSession = session;
    let clinicRef = workingSession.selectedClinicRef;
    let clinicName = workingSession.clinicName;

    if (!clinicRef) {
      const freeTextClinic = this.extractClinicNameFromFreeText(message);
      if (freeTextClinic) {
        const clinicLookup = await this.orchestrator.executeTool(
          'search_clinics',
          { query: freeTextClinic },
          { patientId, sessionId, userMessage: message, authHeader },
          workingSession,
        );
        const clinics = (clinicLookup.result.data?.clinics as any[]) || [];
        if (!clinicLookup.result.success || clinics.length === 0) {
          return `I could not find a clinic matching "${freeTextClinic}" right now.`;
        }
        workingSession = clinicLookup.session;
        clinicRef = workingSession.selectedClinicRef || clinics[0]?.clinicRef;
        clinicName = workingSession.clinicName || clinics[0]?.name;
      }
    }

    if (!clinicRef) {
      return 'Sure. First, tell me the clinic name (or ask me to search clinics), then I can check slots for any doctor there.';
    }

    const date = this.extractRequestedDate(message);
    if (!date) {
      return `I can check available slots at ${clinicName || 'this clinic'} for any doctor. Tell me your preferred date (for example: tomorrow or 2026-06-25).`;
    }

    const doctorResult = await this.orchestrator.executeTool(
      'list_doctors',
      { clinicRef },
      { patientId, sessionId, userMessage: message, authHeader },
      workingSession,
    );
    workingSession = doctorResult.session;
    const doctors = (doctorResult.result.data?.doctors as any[]) || [];
    if (!doctorResult.result.success || doctors.length === 0) {
      return `I checked ${clinicName || 'that clinic'}, but there are no doctors listed yet.`;
    }

    const candidates = doctors
      .map((d: any) => ({
        doctorRef: typeof d.doctorRef === 'string' ? d.doctorRef : '',
        name: typeof d.name === 'string' ? d.name : 'Doctor',
      }))
      .filter((d: any) => !!d.doctorRef)
      .slice(0, 3);

    if (candidates.length === 0) {
      return `I found doctors at ${clinicName || 'that clinic'}, but I could not resolve booking references yet.`;
    }

    for (const doctor of candidates) {
      const slotResult = await this.orchestrator.executeTool(
        'get_available_slots',
        { clinicRef, doctorRef: doctor.doctorRef, date },
        { patientId, sessionId, userMessage: message, authHeader },
        workingSession,
      );
      workingSession = slotResult.session;
      const slots = (slotResult.result.data?.slots as any[]) || [];
      if (!slotResult.result.success || slots.length === 0) {
        continue;
      }

      const items = slots
        .slice(0, 5)
        .map((s: any, i: number) => {
          const time =
            s.startTime ||
            s.time ||
            s.slotTime ||
            s.scheduledAt ||
            'Time unavailable';
          return `${i + 1}. ${time}`;
        })
        .join('\n');
      return `I found available slots at ${clinicName || 'this clinic'} on ${date} with ${doctor.name}:\n${items}\n\nWould you like me to book the first slot?`;
    }

    return `I checked ${clinicName || 'this clinic'} for ${date}, but I could not find open slots yet. Try another date and I can check again.`;
  }

  private isLikelyLocationOnlyQuery(message: string, session: BookingSession): boolean {
    const normalized = message.trim().toLowerCase().replace(/[^\p{L}\s-]/gu, '');
    if (!normalized) return false;
    if (session.selectedClinicRef) return false;
    const words = normalized.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 3) return false;
    const blocked = ['yes', 'no', 'ok', 'okay', 'thanks', 'thank', 'hello', 'hi', 'hey'];
    if (words.every((w) => blocked.includes(w))) return false;
    return words.every((w) => w.length >= 3);
  }

  private buildClinicSearchQuery(message: string): string {
    const location = this.extractLocationHint(message);
    if (location) return location.trim().toLowerCase();

    const stopWords = new Set([
      'search',
      'find',
      'show',
      'list',
      'give',
      'send',
      'two',
      'tow',
      'three',
      'four',
      'five',
      'me',
      'about',
      'clinic',
      'clinics',
      'in',
      'near',
      'at',
      'for',
      'please',
      'the',
      'a',
      'an',
      'with',
      'any',
      'available',
    ]);

    const terms = message
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .filter((word) => !stopWords.has(word))
      .filter((word) => !/^\d+$/.test(word))
      .slice(0, 6);

    if (terms.length === 0) return '';
    return terms.join(' ').trim();
  }

  private extractLocationHint(message: string): string | null {
    const trimmed = message.trim();
    const m = trimmed.match(/\b(?:in|near|at)\s+([a-zA-Z\u0600-\u06FF\s-]{3,})/i);
    if (m?.[1]) {
      const candidate = m[1].trim().toLowerCase();
      if (
        /^(this|that|same|selected|current)\s+clinic$/.test(candidate) ||
        /^(this|that|same|selected|current)$/.test(candidate)
      ) {
        return null;
      }
      return candidate;
    }
    return null;
  }

  private extractDoctorNameQuery(message: string): string | null {
    const trimmed = message.trim();
    const patterns = [
      /\bdoctor\s+with\s+name\s+(.+)$/i,
      /\bsearch\s+(?:me\s+)?(?:for\s+)?doctor\s+(?:with\s+name\s+)?(.+)$/i,
      /\bfind\s+doctor\s+(?:named|name)\s+(.+)$/i,
    ];
    for (const p of patterns) {
      const m = trimmed.match(p);
      if (m?.[1]) {
        return m[1].trim().replace(/[?.!]+$/, '');
      }
    }
    return null;
  }

  private extractClinicNameQuery(message: string): string | null {
    const trimmed = message.trim();
    const patterns = [
      /\bclinic.*(?:with\s+name|named|called)\s+(.+)$/i,
      /\bclinic\s+(?:with\s+name|named|name)\s+(.+)$/i,
      /\bis\s+there\s+(?:a\s+)?clinic\s+(?:called|named|with\s+name)\s+(.+)$/i,
      /\bthis\s+clinic\s*[:\-]\s*(.+)$/i,
      /\bclinic\s*[:\-]\s*(.+)$/i,
    ];
    for (const p of patterns) {
      const m = trimmed.match(p);
      if (m?.[1]) {
        return m[1].trim().replace(/[?.!]+$/, '');
      }
    }
    return null;
  }

  private extractClinicNameFromFreeText(message: string): string | null {
    const trimmed = message.trim();
    const explicit = this.extractClinicNameQuery(trimmed);
    if (explicit) return explicit;
    const m = trimmed.match(/\b([a-zA-Z\u0600-\u06FF][a-zA-Z\u0600-\u06FF\s-]{2,}clinic)\b/i);
    if (m?.[1]) return m[1].trim();
    return null;
  }

  private extractRequestedDate(message: string): string | null {
    const lower = message.toLowerCase();
    const direct = lower.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (direct?.[1]) return direct[1];
    const now = new Date();
    if (/\btoday\b/.test(lower)) {
      return this.formatDate(now);
    }
    if (/\btomorrow\b/.test(lower)) {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      return this.formatDate(d);
    }
    return null;
  }

  private isDateOnlyMessage(lower: string): boolean {
    const normalized = lower.trim().replace(/[?.!]+$/g, '');
    return /^(today|tomorrow|20\d{2}-\d{2}-\d{2})$/.test(normalized);
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private isLangGraphEnabled(): boolean {
    return (this.configService.get<string>('LANGGRAPH_ENABLED') || 'true') === 'true';
  }

  private async recordTurnIfPossible(
    patientId: string,
    userMessage: string,
    assistantReply: string,
  ): Promise<void> {
    try {
      await this.memoryFacade.recordTurn(patientId, userMessage, assistantReply);
    } catch (error) {
      this.logger.warn(`Failed to write booking memory turn: ${(error as Error).message}`);
    }
  }
}
