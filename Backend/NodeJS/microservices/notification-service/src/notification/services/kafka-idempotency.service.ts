import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessedKafkaMessage } from '../entities/processed-kafka-message.entity';

@Injectable()
export class KafkaIdempotencyService {
  constructor(
    @InjectRepository(ProcessedKafkaMessage)
    private readonly processedRepo: Repository<ProcessedKafkaMessage>,
  ) {}

  async isProcessed(eventId: string, topic: string): Promise<boolean> {
    const count = await this.processedRepo.count({
      where: { messageId: eventId, topic },
    });
    return count > 0;
  }

  async markProcessed(eventId: string, topic: string): Promise<void> {
    try {
      await this.processedRepo.insert({ messageId: eventId, topic });
    } catch {
      // Duplicate key — event already recorded.
    }
  }
}
