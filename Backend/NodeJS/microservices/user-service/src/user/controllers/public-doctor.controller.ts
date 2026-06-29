import { Controller, Get, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UserService } from '../services/user.service';

/** Public doctor profiles — any authenticated user (including patients). */
@Controller('v1/users/doctors')
@UseGuards(JwtAuthGuard)
export class PublicDoctorController {
  constructor(private readonly userService: UserService) {}

  @Get('public')
  async listPublic(@Query('ids') ids: string) {
    const userIds = (ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
    const doctors = await this.userService.getPublicDoctorProfiles(userIds);
    return { success: true, doctors };
  }

  @Get(':id/public')
  async getOne(@Param('id', ParseUUIDPipe) id: string) {
    const doctor = await this.userService.getPublicDoctorProfile(id);
    return { success: true, doctor };
  }
}
