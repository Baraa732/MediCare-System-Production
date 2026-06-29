import { SetMetadata } from '@nestjs/common';

// UserRole enum - should be moved to a shared types package in production
export enum UserRole {
  SYSTEM_MANAGER = 'SYSTEM_MANAGER',
  CLINIC_ADMIN = 'CLINIC_ADMIN',
  DOCTOR = 'DOCTOR',
  SECRETARY = 'SECRETARY',
  PATIENT = 'PATIENT'
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);