import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PlatformDataService } from './platform-data.service';
import { NotificationHttpClient } from './notification-http.client';

@Injectable()
export class PlatformBroadcastService {
  private readonly logger = new Logger(PlatformBroadcastService.name);

  constructor(
    private readonly platformDataService: PlatformDataService,
    private readonly notificationHttpClient: NotificationHttpClient,
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
}
