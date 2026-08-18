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

  async list(): Promise<Array<PlatformIncident & { silencedUntil: string | null }>> {
    const rows = await this.repo.find({ order: { updatedAt: 'DESC' }, take: 500 });
    return rows.map((row) => Object.assign(row, { silencedUntil: parseSilencedUntil(row.notes) }));
  }

  async get(id: string): Promise<(PlatformIncident & { silencedUntil: string | null }) | null> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) return null;
    return Object.assign(row, { silencedUntil: parseSilencedUntil(row.notes) });
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

  async silence(id: string, hours: number, meta?: IncidentActionDto): Promise<PlatformIncident> {
    const until = new Date(Date.now() + Math.max(1, hours) * 3_600_000);
    return this.upsert(id, {
      notes: `silencedUntil:${until.toISOString()}`,
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

const SILENCE_PREFIX = 'silencedUntil:';

function parseSilencedUntil(notes: string | null): string | null {
  if (!notes?.startsWith(SILENCE_PREFIX)) return null;
  const iso = notes.slice(SILENCE_PREFIX.length);
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts) || ts <= Date.now()) return null;
  return iso;
}
