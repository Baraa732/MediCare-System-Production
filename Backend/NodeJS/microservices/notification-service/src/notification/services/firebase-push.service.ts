import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface PushSendOptions {
  androidChannelId?: string;
  deepLink?: string;
}

@Injectable()
export class FirebasePushService implements OnModuleInit {
  private readonly logger = new Logger(FirebasePushService.name);
  private initialized = false;

  onModuleInit(): void {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Firebase Admin not configured — push notifications disabled until FIREBASE_* env vars are set.',
      );
      return;
    }

    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      }
      this.initialized = true;
      this.logger.log('Firebase Admin initialized for FCM push');
    } catch (error: any) {
      this.logger.error(`Firebase Admin init failed: ${error?.message}`);
    }
  }

  isEnabled(): boolean {
    return this.initialized;
  }

  getWebConfig(): Record<string, string> | null {
    const apiKey = process.env.FIREBASE_WEB_API_KEY;
    const authDomain = process.env.FIREBASE_AUTH_DOMAIN;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const messagingSenderId = process.env.FIREBASE_MESSAGING_SENDER_ID;
    const appId = process.env.FIREBASE_WEB_APP_ID;
    const vapidKey = process.env.FIREBASE_VAPID_KEY;

    if (!apiKey || !projectId || !messagingSenderId || !appId || !vapidKey) {
      return null;
    }

    return {
      apiKey,
      authDomain: authDomain || `${projectId}.firebaseapp.com`,
      projectId,
      messagingSenderId,
      appId,
      vapidKey,
    };
  }

  /** Public Android/iOS client config for Flutter Firebase.initializeApp (safe to expose). */
  getMobileConfig(): Record<string, string> | null {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const messagingSenderId = process.env.FIREBASE_MESSAGING_SENDER_ID;
    const apiKey =
      process.env.FIREBASE_ANDROID_API_KEY ||
      process.env.FIREBASE_WEB_API_KEY;
    const appId =
      process.env.FIREBASE_ANDROID_APP_ID ||
      process.env.FIREBASE_WEB_APP_ID;
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || '';

    if (!projectId || !messagingSenderId || !apiKey || !appId) {
      return null;
    }

    return {
      apiKey,
      appId,
      projectId,
      messagingSenderId,
      storageBucket,
    };
  }

  async sendToTokens(
    tokens: string[],
    payload: PushPayload,
    options?: PushSendOptions,
  ): Promise<{
    successCount: number;
    failureCount: number;
    invalidTokens: string[];
  }> {
    if (!this.initialized || tokens.length === 0) {
      return { successCount: 0, failureCount: tokens.length, invalidTokens: [] };
    }

    const unique = [...new Set(tokens)];
    const invalidTokens: string[] = [];
    let successCount = 0;
    let failureCount = 0;

    const androidChannelId = options?.androidChannelId ?? 'medicare_secretary';
    const deepLink = options?.deepLink ?? payload.data?.deepLink ?? '/dashboard';

    const chunkSize = 500;
    for (let i = 0; i < unique.length; i += chunkSize) {
      const chunk = unique.slice(i, i + chunkSize);
      try {
        const response = await admin.messaging().sendEachForMulticast({
          tokens: chunk,
          notification: {
            title: payload.title,
            body: payload.body,
            imageUrl: payload.imageUrl,
          },
          data: {
            ...(payload.data ?? {}),
            title: payload.title,
            body: payload.body,
          },
          webpush: {
            headers: {
              Urgency: 'high',
              TTL: '86400',
            },
            notification: {
              title: payload.title,
              body: payload.body,
              icon: '/favicon.svg',
              badge: '/favicon.svg',
              requireInteraction: true,
              tag: payload.data?.appointmentId || payload.data?.category || 'medicare',
            },
            fcmOptions: {
              link: deepLink,
            },
          },
          android: {
            priority: 'high',
            ttl: 86400000,
            notification: {
              channelId: androidChannelId,
              priority: 'high',
              defaultSound: true,
              defaultVibrateTimings: true,
              visibility: 'public',
              clickAction: 'FLUTTER_NOTIFICATION_CLICK',
              tag: payload.data?.category || payload.data?.notificationId || 'medicare',
            },
            data: {
              ...(payload.data ?? {}),
              title: payload.title,
              body: payload.body,
              click_action: 'FLUTTER_NOTIFICATION_CLICK',
            },
          },
          apns: {
            headers: {
              'apns-priority': '10',
              'apns-push-type': 'alert',
            },
            payload: {
              aps: {
                alert: { title: payload.title, body: payload.body },
                sound: 'default',
                badge: 1,
                'content-available': 1,
                'mutable-content': 1,
              },
            },
          },
        });

        successCount += response.successCount;
        failureCount += response.failureCount;

        response.responses.forEach((res, idx) => {
          if (!res.success) {
            const code = res.error?.code;
            if (
              code === 'messaging/invalid-registration-token' ||
              code === 'messaging/registration-token-not-registered'
            ) {
              invalidTokens.push(chunk[idx]);
            }
          }
        });
      } catch (error: any) {
        failureCount += chunk.length;
        this.logger.error(`FCM multicast failed: ${error?.message}`);
      }
    }

    return { successCount, failureCount, invalidTokens };
  }
}
