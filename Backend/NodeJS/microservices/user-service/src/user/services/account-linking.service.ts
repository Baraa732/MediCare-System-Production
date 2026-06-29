import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User, UserRole, UserStatus } from '../entities/user.entity';
import { UserAccountLink } from '../entities/user-account-link.entity';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { LinkPatientAccountDto, LinkAccountDto } from '../dto/account-link.dto';

@Injectable()
export class AccountLinkingService {
  private readonly logger = new Logger(AccountLinkingService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserAccountLink)
    private userAccountLinkRepository: Repository<UserAccountLink>,
    @InjectDataSource()
    private dataSource: DataSource,
    @Inject('KAFKA_CLIENT')
    private kafkaClient: ClientKafka,
  ) {}

  async linkPatientAccount(
    systemManagerId: string,
    patientData: LinkPatientAccountDto,
  ): Promise<{ userId: string; message: string }> {
    this.logger.log(`Linking patient account for system manager: ${systemManagerId}`);
    const patient = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const linkRepo = manager.getRepository(UserAccountLink);
      const outboxRepo = manager.getRepository(OutboxEvent);

      // Check if patient account already exists for this phone
      let localPatient = await userRepo.findOne({
        where: { phoneNumber: patientData.phoneNumber },
      });

      let isNewPatient = false;

      if (localPatient) {
        // Check if already linked
        const existingLink = await linkRepo.findOne({
          where: {
            systemManagerId,
            userId: localPatient.id,
            linkType: 'PATIENT',
          },
        });

        if (existingLink) {
          throw new BadRequestException('Patient account already linked to this system manager');
        }

        // Update patient to link to system manager
        localPatient.linkedSystemManagerId = systemManagerId;
        localPatient = await userRepo.save(localPatient);
      } else {
        // Create new patient account
        // Generate a secure random temp password — user must reset on first login
        const tempPassword = require('crypto').randomBytes(16).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        localPatient = userRepo.create({
          ...patientData,
          password: hashedPassword,
          role: UserRole.PATIENT,
          status: UserStatus.ACTIVE,
          linkedSystemManagerId: systemManagerId,
          isPhoneVerified: true, // Auto-verify since system manager is linking
          permissions: [],
        });

        // Set default permissions for patient
        localPatient.permissions = localPatient.getDefaultPermissionsForRole();
        localPatient = await userRepo.save(localPatient);
        isNewPatient = true;
      }

      // Create account link
      const link = linkRepo.create({
        systemManagerId,
        userId: localPatient.id,
        linkType: 'PATIENT',
      });
      await linkRepo.save(link);

      if (isNewPatient) {
        await outboxRepo.save({
          aggregateId: localPatient.id,
          aggregateType: 'User',
          eventType: 'user.created',
          payload: {
            userId: localPatient.id,
            phoneNumber: localPatient.phoneNumber,
            firstName: localPatient.firstName,
            lastName: localPatient.lastName,
            email: localPatient.email,
            role: UserRole.PATIENT,
            createdAt: new Date().toISOString(),
          },
        });
      }

      return localPatient;
    });

    // Emit event
    this.kafkaClient.emit('account.linked', {
      systemManagerId,
      userId: patient.id,
      linkType: 'PATIENT',
      phoneNumber: patient.phoneNumber,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Patient account linked successfully: ${patient.id}`);

    return {
      userId: patient.id,
      message: 'Patient account created and linked successfully',
    };
  }

  async linkAccounts(linkDto: LinkAccountDto): Promise<{ message: string }> {
    const { systemManagerId, userId, linkType } = linkDto;

    this.logger.log(`Linking accounts: systemManager=${systemManagerId}, user=${userId}, type=${linkType}`);

    await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const linkRepo = manager.getRepository(UserAccountLink);

      // Check if user exists
      const user = await userRepo.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if link already exists
      const existingLink = await linkRepo.findOne({
        where: {
          systemManagerId,
          userId,
          linkType,
        },
      });

      if (existingLink) {
        throw new BadRequestException('Accounts already linked');
      }

      // Update user to link to system manager
      user.linkedSystemManagerId = systemManagerId;
      await userRepo.save(user);

      // Create account link
      const link = linkRepo.create({
        systemManagerId,
        userId,
        linkType,
      });
      await linkRepo.save(link);
    });

    // Emit event
    this.kafkaClient.emit('account.linked', {
      systemManagerId,
      userId,
      linkType,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Accounts linked successfully`);

    return { message: 'Accounts linked successfully' };
  }

  async getLinkedAccounts(systemManagerId: string): Promise<UserAccountLink[]> {
    return this.userAccountLinkRepository.find({
      where: { systemManagerId, isActive: true },
      relations: ['user'],
    });
  }

  async unlinkAccount(
    systemManagerId: string,
    userId: string,
  ): Promise<{ message: string }> {
    this.logger.log(`Unlinking accounts: systemManager=${systemManagerId}, user=${userId}`);
    await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const linkRepo = manager.getRepository(UserAccountLink);

      const link = await linkRepo.findOne({
        where: { systemManagerId, userId },
      });

      if (!link) {
        throw new NotFoundException('Account link not found');
      }

      link.isActive = false;
      await linkRepo.save(link);

      // Update user to remove system manager link
      const user = await userRepo.findOne({ where: { id: userId } });
      if (user && user.linkedSystemManagerId === systemManagerId) {
        user.linkedSystemManagerId = null;
        await userRepo.save(user);
      }
    });

    // Emit event
    this.kafkaClient.emit('account.unlinked', {
      systemManagerId,
      userId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Account unlinked successfully`);

    return { message: 'Account unlinked successfully' };
  }

  async getUserBySystemManagerId(
    systemManagerId: string,
    linkType: string,
  ): Promise<User | null> {
    const link = await this.userAccountLinkRepository.findOne({
      where: {
        systemManagerId,
        linkType,
        isActive: true,
      },
    });

    if (!link) {
      return null;
    }

    return this.userRepository.findOne({ where: { id: link.userId } });
  }

  async getAvailableRolesForUser(userId: string): Promise<string[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      return [];
    }

    const roles: UserRole[] = [user.role];

    // If user is linked to system manager, add SYSTEM_MANAGER role
    if (user.linkedSystemManagerId) {
      roles.push(UserRole.SYSTEM_MANAGER);
    }

    // Check if user has other linked accounts
    const links = await this.userAccountLinkRepository.find({
      where: { userId, isActive: true },
    });

    for (const link of links) {
      if (!roles.includes(link.linkType as UserRole)) {
        roles.push(link.linkType as UserRole);
      }
    }

    return [...new Set(roles)]; // Remove duplicates
  }
}
