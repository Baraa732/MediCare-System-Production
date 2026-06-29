type AuthSession = {
  accessToken: string;
  refreshToken?: string;
};

type RegisterResponse = {
  devOtp?: string;
  userId?: string;
  message?: string;
};

type LoginResponse = AuthSession & {
  requiresMfa?: boolean;
  mfaToken?: string;
  devOtp?: string;
  message?: string;
};

type BookingResponse = { reply: string };
type BookingSessionResponse = { sessionId: string; expiresInSeconds: number };
type ChatResponse = { answer?: string; response?: string; text?: string };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const apiBaseInput = $<HTMLInputElement>('apiBase');
const phoneInput = $<HTMLInputElement>('phoneNumber');
const passwordInput = $<HTMLInputElement>('password');
const otpWrap = $<HTMLLabelElement>('otpWrap');
const otpInput = $<HTMLInputElement>('otpCode');
const sessionStatus = $<HTMLDivElement>('sessionStatus');
const messagesEl = $<HTMLDivElement>('messages');
const chatMode = $<HTMLSelectElement>('chatMode');
const sessionIdInput = $<HTMLInputElement>('sessionId');
const messageInput = $<HTMLTextAreaElement>('messageInput');
const chatForm = $<HTMLFormElement>('chatForm');

let accessToken: string | null = null;
let pendingRegisterPhone: string | null = null;
let bookingSessionId: string | null = null;

function apiBase(): string {
  return apiBaseInput.value.replace(/\/$/, '');
}

function setSession(token: string | null, label?: string) {
  accessToken = token;
  bookingSessionId = null;
  sessionIdInput.value = '';
  if (token) {
    sessionStatus.textContent = label || 'Signed in';
    sessionStatus.classList.add('online');
  } else {
    sessionStatus.textContent = 'Not signed in';
    sessionStatus.classList.remove('online');
  }
}

function appendMessage(role: 'user' | 'assistant' | 'system', text: string) {
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  el.textContent = text;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return el;
}

async function request<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (options.auth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${apiBase()}${path}`, {
    ...options,
    headers,
  });

  const bodyText = await res.text();
  let data: unknown = {};
  try {
    data = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    data = { raw: bodyText };
  }

  if (!res.ok) {
    const err = data as {
      message?: string | string[];
      error?: { message?: string };
    };
    const msg =
      (typeof err.error?.message === 'string' ? err.error.message : null) ||
      (Array.isArray(err.message) ? err.message[0] : err.message) ||
      bodyText;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(data));
  }

  return data as T;
}

async function initBookingSession(resumeToken?: string) {
  if (!accessToken) return;
  const data = await request<BookingSessionResponse>('/ai/patient-booking-session', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(resumeToken ? { resumeToken } : {}),
  });
  bookingSessionId = data.sessionId;
  sessionIdInput.value = data.sessionId;
}

async function login() {
  const phoneNumber = phoneInput.value.trim();
  const password = passwordInput.value;

  const data = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber, password }),
  });

  if (data.requiresMfa && data.mfaToken) {
    let otp = data.devOtp || otpInput.value.trim();
    if (data.devOtp) {
      otpInput.value = data.devOtp;
    }
    if (!otp) {
      otpWrap.classList.remove('hidden');
      appendMessage('system', 'MFA required — enter devOtp from login response, then click Login again.');
      return;
    }

    const mfa = await request<LoginResponse>('/auth/verify-mfa', {
      method: 'POST',
      body: JSON.stringify({ mfaToken: data.mfaToken, otp }),
    });

    if (!mfa.accessToken) {
      throw new Error('MFA verify did not return accessToken');
    }

    setSession(mfa.accessToken, `Signed in · ${phoneNumber}`);
    appendMessage('system', 'Logged in with MFA.');
    await initBookingSession();
    return;
  }

  if (!data.accessToken) {
    throw new Error('Login did not return accessToken');
  }

  setSession(data.accessToken, `Signed in · ${phoneNumber}`);
  appendMessage('system', 'Logged in successfully.');
  await initBookingSession();
}

async function register() {
  const phoneNumber = phoneInput.value.trim();
  const password = passwordInput.value;
  const firstName = 'Test';
  const lastName = 'Patient';

  const data = await request<RegisterResponse>('/auth/register', {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({
      phoneNumber,
      firstName,
      lastName,
      password,
      role: 'PATIENT',
    }),
  });

  pendingRegisterPhone = phoneNumber;

  if (data.devOtp) {
    otpInput.value = data.devOtp;
    appendMessage('system', `Registered. devOtp filled automatically (${data.devOtp}).`);
  } else {
    appendMessage('system', 'Registered. Enter devOtp from the API response.');
  }

  otpWrap.classList.remove('hidden');
}

async function verifyOtp() {
  const phoneNumber = pendingRegisterPhone || phoneInput.value.trim();
  const otp = otpInput.value.trim();

  const data = await request<LoginResponse>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber, otp, autoLogin: 'true' }),
  });

  if (!data.accessToken) {
    throw new Error('Verify did not return accessToken');
  }

  setSession(data.accessToken, `Signed in · ${phoneNumber}`);
  otpWrap.classList.add('hidden');
  appendMessage('system', 'Phone verified and logged in.');
  await initBookingSession();
}

async function sendChatMessage(text: string) {
  if (!accessToken) {
    throw new Error('Login first');
  }

  appendMessage('user', text);
  const thinking = appendMessage('assistant', 'Thinking… (first reply can take up to a minute while the local AI model loads)');

  try {
    if (chatMode.value === 'booking') {
      const isExpiredBookingSession = (message: string) =>
        /invalid or expired booking session/i.test(message);

      let data: BookingResponse | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (!bookingSessionId) {
          await initBookingSession();
        }

        try {
          data = await request<BookingResponse>('/ai/patient-booking-assistant', {
            method: 'POST',
            auth: true,
            body: JSON.stringify({
              sessionId: bookingSessionId,
              message: text,
            }),
          });
          break;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (attempt === 0 && isExpiredBookingSession(message)) {
            // Auto-heal stale session IDs after backend/container restarts.
            await initBookingSession();
            continue;
          }
          throw err;
        }
      }

      thinking.remove();
      appendMessage('assistant', data?.reply || JSON.stringify(data));
      return;
    }

    const data = await request<ChatResponse>('/ai/patient-chat', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ question: text }),
    });

    const reply = data.answer || data.response || data.text;
    thinking.remove();
    if (!reply?.trim()) {
      throw new Error('AI returned an empty response');
    }
    appendMessage('assistant', reply);
  } catch (err) {
    thinking.remove();
    throw err;
  }
}

function bindEvents() {
  $('loginBtn').addEventListener('click', () => {
    login().catch((e: Error) => appendMessage('system', `Login error: ${e.message}`));
  });

  $('registerBtn').addEventListener('click', () => {
    register().catch((e: Error) => appendMessage('system', `Register error: ${e.message}`));
  });

  $('verifyBtn').addEventListener('click', () => {
    verifyOtp().catch((e: Error) => appendMessage('system', `Verify error: ${e.message}`));
  });

  $('clearChatBtn').addEventListener('click', () => {
    messagesEl.innerHTML = '';
  });

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;
    messageInput.value = '';
    sendChatMessage(text).catch((err: Error) => appendMessage('system', `Chat error: ${err.message}`));
  });

  document.querySelectorAll<HTMLButtonElement>('.chip[data-prompt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prompt = btn.dataset.prompt || '';
      if (prompt.includes('bring')) {
        chatMode.value = 'health';
      } else {
        chatMode.value = 'booking';
      }
      messageInput.value = prompt;
      messageInput.focus();
    });
  });
}

bindEvents();
appendMessage('system', 'Ready. Run seed script, then login or register a seed patient.');
