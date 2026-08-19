import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PlatformDataService } from './platform-data.service';
import { NotificationHttpClient } from './notification-http.client';
import { PlatformOpsNotifyService } from './platform-ops-notify.service';

@Injectable()
export class PlatformBroadcastService {
  private readonly logger = new Logger(PlatformBroadcastService.name);

  constructor(
    private readonly platformDataService: PlatformDataService,
    private readonly notificationHttpClient: NotificationHttpClient,
    private readonly opsNotify: PlatformOpsNotifyService,
  ) {}

  async broadcastToAllPatients(title: string, body: string) {
    const cleanTitle = title?.trim();
    const cleanBody = body?.trim();
    if (!cleanTitle || cleanTitle.length > 80) {
      throw new BadRequestException('Title is required (max 80 characters)');
    }
    if (!cleanBody || cleanBody.length > 500) {
      throw new BadRequestException('Body is required (max 500 characters)');
    }

    const pageSize = 500;
    let page = 1;
    let totalPatients = 0;
    let inboxSaved = 0;
    let pushSuccess = 0;
    let pushFailed = 0;
    let batches = 0;

    while (page <= 200) {
      const ids = await this.platformDataService.listPatientIds(page, pageSize);
      if (!ids.length) break;

      totalPatients += ids.length;
      const result = await this.notificationHttpClient.broadcastToPatients(
        cleanTitle,
        cleanBody,
        ids,
      );
      inboxSaved += result.inboxSaved;
      pushSuccess += result.pushSuccess;
      pushFailed += result.pushFailed;
      batches += 1;

      if (ids.length < pageSize) break;
      page += 1;
    }

    this.logger.log(
      `Broadcast complete: patients=${totalPatients} inbox=${inboxSaved} pushOk=${pushSuccess} pushFail=${pushFailed} batches=${batches}`,
    );
    void this.opsNotify.notifyAll({
      title: 'Patient broadcast sent',
      body:
        totalPatients === 0
          ? `“${cleanTitle}” reached no patients.`
          : `“${cleanTitle}” saved to ${inboxSaved} inboxes (${pushSuccess} push, ${pushFailed} failed).`,
      severity: totalPatients === 0 || (totalPatients > 0 && pushSuccess === 0) ? 'warning' : 'info',
      kind: 'BROADCAST',
      deepLink: '/notifications/broadcast',
      dedupeKey: `broadcast:${Date.now()}`,
    });
    if (totalPatients > 0 && pushSuccess === 0) {
      this.logger.warn(
        'Broadcast inbox was saved but no FCM push was delivered. Patients need a registered device token, and notification-service needs FIREBASE_* Admin credentials.',
      );
    }

    return {
      success: true,
      title: cleanTitle,
      queued: totalPatients,
      inboxSaved,
      pushSuccess,
      pushFailed,
      batches,
      message:
        totalPatients === 0
          ? 'No patients found on the platform.'
          : pushSuccess === 0
            ? `Saved to ${inboxSaved} patient inboxes, but no phone push was delivered (FCM not configured or no device tokens).`
            : `Notification delivered to ${inboxSaved} of ${totalPatients} patients (${pushSuccess} push).`,
    };
  }

  async broadcastToAllDoctors(title: string, body: string) {
    const cleanTitle = title?.trim();
    const cleanBody = body?.trim();
    if (!cleanTitle || cleanTitle.length > 80) {
      throw new BadRequestException('Title is required (max 80 characters)');
    }
    if (!cleanBody || cleanBody.length > 500) {
      throw new BadRequestException('Body is required (max 500 characters)');
    }

    const pageSize = 500;
    let page = 1;
    let totalDoctors = 0;
    let inboxSaved = 0;
    let pushSuccess = 0;
    let pushFailed = 0;
    let batches = 0;

    while (page <= 200) {
      const ids = await this.platformDataService.listDoctorIds(page, pageSize);
      if (!ids.length) break;

      totalDoctors += ids.length;
      const result = await this.notificationHttpClient.broadcastToDoctors(
        cleanTitle,
        cleanBody,
        ids,
      );
      inboxSaved += result.inboxSaved;
      pushSuccess += result.pushSuccess;
      pushFailed += result.pushFailed;
      batches += 1;

      if (ids.length < pageSize) break;
      page += 1;
    }

    this.logger.log(
      `Doctor broadcast complete: doctors=${totalDoctors} inbox=${inboxSaved} pushOk=${pushSuccess} pushFail=${pushFailed} batches=${batches}`,
    );
    void this.opsNotify.notifyAll({
      title: 'Doctor broadcast sent',
      body:
        totalDoctors === 0
          ? `“${cleanTitle}” reached no doctors.`
          : `“${cleanTitle}” saved to ${inboxSaved} doctor inboxes (${pushSuccess} push, ${pushFailed} failed).`,
      severity: totalDoctors === 0 || (totalDoctors > 0 && pushSuccess === 0) ? 'warning' : 'info',
      kind: 'BROADCAST',
      deepLink: '/notifications/broadcast',
      dedupeKey: `doctor-broadcast:${Date.now()}`,
    });

    return {
      success: true,
      title: cleanTitle,
      queued: totalDoctors,
      inboxSaved,
      pushSuccess,
      pushFailed,
      batches,
      message:
        totalDoctors === 0
          ? 'No doctors found on the platform.'
          : pushSuccess === 0
            ? `Saved to ${inboxSaved} doctor inboxes, but no phone push was delivered (FCM not configured or no device tokens).`
            : `Notification delivered to ${inboxSaved} of ${totalDoctors} doctors (${pushSuccess} push).`,
    };
  }
}
