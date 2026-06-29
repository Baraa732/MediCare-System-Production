import { Controller, Post, Get, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AccountLinkingService } from '../services/account-linking.service';
import { LinkPatientAccountDto, LinkAccountDto } from '../dto/account-link.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

// LOW FIX: Add API versioning
@Controller('v1/account-linking')
@UseGuards(JwtAuthGuard)
export class AccountLinkingController {
  constructor(private readonly accountLinkingService: AccountLinkingService) {}

  // systemManagerId comes from the authenticated token — never from the request body
  @Post('link-patient')
  @UseGuards(RolesGuard)
  @Roles('SYSTEM_MANAGER')
  async linkPatientAccount(@Body() linkDto: LinkPatientAccountDto, @Request() req) {
    return this.accountLinkingService.linkPatientAccount(req.user.userId, linkDto);
  }

  @Post('link')
  @UseGuards(RolesGuard)
  @Roles('SYSTEM_MANAGER')
  async linkAccounts(@Body() linkDto: LinkAccountDto, @Request() req) {
    // Override systemManagerId with the authenticated user's ID
    return this.accountLinkingService.linkAccounts({
      ...linkDto,
      systemManagerId: req.user.userId,
    });
  }

  @Get('linked')
  @UseGuards(RolesGuard)
  @Roles('SYSTEM_MANAGER')
  async getLinkedAccounts(@Request() req) {
    const links = await this.accountLinkingService.getLinkedAccounts(req.user.userId);
    // Project safe shape — never expose password, permissions, linkedSystemManagerId
    return links.map(link => ({
      linkId: link.id,
      userId: link.userId,
      linkType: link.linkType,
      isActive: link.isActive,
      createdAt: link.createdAt,
    }));
  }

  @Delete('unlink/:userId')
  @UseGuards(RolesGuard)
  @Roles('SYSTEM_MANAGER')
  async unlinkAccount(@Param('userId') userId: string, @Request() req) {
    return this.accountLinkingService.unlinkAccount(req.user.userId, userId);
  }

  @Get('available-roles')
  async getAvailableRoles(@Request() req) {
    return {
      roles: await this.accountLinkingService.getAvailableRolesForUser(req.user.userId),
    };
  }
}
