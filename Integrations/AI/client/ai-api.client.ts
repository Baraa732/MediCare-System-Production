/**
 * MediCare AI API Client
 * Use from React dashboards or Flutter apps (via Dart FFI / platform channel wrapper).
 *
 * @example
 * const ai = new MediCareAiClient('http://localhost:3000', accessToken);
 * const summary = await ai.generateSummary('Patient notes...');
 */

export interface MedicalReportInput {
  patientInfo?: string;
  labResults?: string;
  doctorNotes?: string;
  diagnoses?: string;
}

export interface MedicalReportOutput {
  summary: string;
  assessment: string;
  recommendations: string;
  followUp: string;
}

export interface OcrCleanupInput {
  rawText?: string;
  imageBase64?: string;
  documentType?: string;
}

export interface OcrCleanupOutput {
  rawText: string;
  cleanedText: string;
  structuredData: Record<string, unknown>;
}

export class MediCareAiClient {
  constructor(
    private baseUrl: string,
    private getAccessToken: () => string | Promise<string>,
  ) {}

  private async request<T>(path: string, body: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}/api/ai/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `AI request failed: ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  generateSummary(text: string) {
    return this.request<{ summary: string }>('summary', { text });
  }

  generateMedicalReport(data: MedicalReportInput) {
    return this.request<MedicalReportOutput>('report', data);
  }

  cleanOcrText(data: OcrCleanupInput) {
    return this.request<OcrCleanupOutput>('ocr-cleanup', data);
  }

  /** Pass base64 image from camera/file picker — runs OCR then AI cleanup */
  cleanOcrImage(imageBase64: string, documentType?: string) {
    return this.cleanOcrText({ imageBase64, documentType });
  }

  patientChat(question: string, context?: string) {
    return this.request<{ answer: string }>('patient-chat', { question, context });
  }

  doctorChat(question: string, patientContext?: string) {
    return this.request<{ answer: string }>('doctor-chat', { question, patientContext });
  }

  generateAppointmentNote(notes: string, context?: string) {
    return this.request<{ note: string }>('appointment-note', { notes, context });
  }

  async getStatus() {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}/api/ai/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
    return res.json();
  }
}
