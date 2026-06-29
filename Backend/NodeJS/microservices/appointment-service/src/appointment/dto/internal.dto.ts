import { IsUUID } from 'class-validator';

export class VerifyOwnershipDto {
  @IsUUID()
  appointmentId: string;
}
