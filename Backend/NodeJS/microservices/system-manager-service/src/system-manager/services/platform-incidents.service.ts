import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformIncident, PlatformIncidentStatus } from '../entities/platform-incident.entity';

export interface IncidentActionDto {
  assignee?: string;
  notes?: string;
  title?: string;
  service?: string;
}

@Injectable()
export class PlatformIncidentsService {
  constructor(
    @InjectRepository(PlatformIncident)
    private readonly repo: Repository<PlatformIncident>,
  ) {}

  async list(): Promise<PlatformIncident[]> {
    return this.repo.find({ order: { updatedAt: 'DESC' }, take: 500 });
  }

  async get(id: string): Promise<PlatformIncident | null> {
    return this.repo.findOne({ where: { id } });
  }

  private async upsert(id: string, patch: Partial<PlatformIncident>, meta?: IncidentActionDto): Promise<PlatformIncident> {
    let row = await this.repo.findOne({ where: { id } });
    if (!row) {
      row = this.repo.create({
        id,
        title: meta?.title ?? null,
        service: meta?.service ?? null,
        status: 'open',
      });
    }
    Object.assign(row, patch);
    if (meta?.title) row.title = meta.title;
    if (meta?.service) row.service = meta.service;
    return this.repo.save(row);
  }

  async acknowledge(id: string, meta?: IncidentActionDto): Promise<PlatformIncident> {
    return this.upsert(id, {
      status: 'acknowledged',
      acknowledgedAt: new Date(),
    }, meta);
  }

  async assign(id: string, assignee: string, meta?: IncidentActionDto): Promise<PlatformIncident> {
    return this.upsert(id, {
      status: 'assigned',
      assignee,
      assignedAt: new Date(),
      acknowledgedAt: new Date(),
    }, meta);
  }

  async resolve(id: string, notes?: string, meta?: IncidentActionDto): Promise<PlatformIncident> {
    return this.upsert(id, {
      status: 'resolved',
      resolutionNotes: notes ?? null,
      resolvedAt: new Date(),
    }, meta);
  }

  async escalate(id: string, notes?: string, meta?: IncidentActionDto): Promise<PlatformIncident> {
    return this.upsert(id, {
      status: 'escalated',
      notes: notes ?? null,
      escalatedAt: new Date(),
      acknowledgedAt: new Date(),
    }, meta);
  }

  isAcknowledged(status: PlatformIncidentStatus): boolean {
    return status === 'acknowledged' || status === 'assigned' || status === 'escalated' || status === 'resolved';
  }

  isResolved(status: PlatformIncidentStatus): boolean {
    return status === 'resolved';
  }

  isEscalated(status: PlatformIncidentStatus): boolean {
    return status === 'escalated';
  }

  async require(id: string): Promise<PlatformIncident> {
    const row = await this.get(id);
    if (!row) throw new NotFoundException(`Incident ${id} not found`);
    return row;
  }
}
