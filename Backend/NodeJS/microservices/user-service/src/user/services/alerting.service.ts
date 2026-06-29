import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * MEDIUM FIX: Add DLT alerting
 * 
 * Service for sending alerts to monitoring systems when critical events occur.
 * Supports webhook-based alerting for integration with Alertmanager, PagerDuty, etc.
 */
@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);
  private readonly webhookUrl: string | null;
  private readonly enabled: boolean;

  constructor(private configService: ConfigService) {
    this.webhookUrl = this.configService.get<string>('ALERT_WEBHOOK_URL') || null;
    this.enabled = !!this.webhookUrl;
    
    if (this.enabled) {
      this.logger.log('Alerting service enabled with webhook URL');
    } else {
      this.logger.warn('Alerting service disabled - ALERT_WEBHOOK_URL not configured');
    }
  }

  /**
   * Send an alert for a DLT (Dead Letter Topic) event
   */
  async sendDltAlert(topic: string, partition: number, offset: string | number, data: any): Promise<void> {
    if (!this.enabled) {
      this.logger.warn(`DLT alert skipped (alerting disabled): ${topic}`);
      return;
    }

    const alert = {
      severity: 'critical' as const,
      title: `Kafka DLT Event: ${topic}`,
      message: `Message failed after retries and was sent to DLT`,
      details: {
        topic,
        partition,
        offset,
        data: JSON.stringify(data),
        timestamp: new Date().toISOString(),
        service: 'user-service',
      },
    };

    await this.sendAlert(alert);
  }

  /**
   * Send a generic alert
   */
  async sendAlert(alert: {
    severity: 'critical' | 'warning' | 'info';
    title: string;
    message: string;
    details?: any;
  }): Promise<void> {
    if (!this.enabled) return;

    try {
      const response = await fetch(this.webhookUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alert),
      });

      if (!response.ok) {
        this.logger.error(`Failed to send alert: ${response.status} ${response.statusText}`);
      } else {
        this.logger.log(`Alert sent successfully: ${alert.title}`);
      }
    } catch (error: any) {
      this.logger.error(`Error sending alert: ${error.message}`);
    }
  }
}
