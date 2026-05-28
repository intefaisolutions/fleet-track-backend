import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Permissions } from '../../decorators/permissions.decorator';
import { ROLES } from '../../constants';
import { Permission } from '../../constants/permissions.constant';
import { UserStatus } from '../../common/enums';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser } from '../../types';
import { UsersService } from '../services/users.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UpdateUserStatusDto } from '../dto/update-user-status.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN)
  @Permissions(Permission.USERS_WRITE)
  @ApiOperation({ summary: 'Create user (admin) — defaults to ACTIVE status' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto, { status: dto.status ?? UserStatus.ACTIVE });
  }

  @Get()
  @ApiQuery({ name: 'status', enum: UserStatus, required: false })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: UserStatus,
  ) {
    return this.usersService.findAll(user.companyId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN)
  @Permissions(Permission.USERS_WRITE)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN)
  @Permissions(Permission.USERS_WRITE)
  @ApiOperation({
    summary: 'Update user status — ACTIVE, INACTIVE, SUSPENDED, PENDING_APPROVAL',
  })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.usersService.updateStatus(id, dto);
  }

  @Patch(':id/verify-email')
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN)
  @Permissions(Permission.USERS_WRITE)
  @ApiOperation({ summary: 'Mark user email as verified (admin)' })
  verifyEmail(@Param('id') id: string) {
    return this.usersService.verifyEmail(id);
  }

  @Delete(':id')
  @Roles(ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN)
  @Permissions(Permission.USERS_DELETE)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
