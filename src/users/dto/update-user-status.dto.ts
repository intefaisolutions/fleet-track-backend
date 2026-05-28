import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserStatus } from '../../common/enums';

export class UpdateUserStatusDto {
  @ApiProperty({
    enum: UserStatus,
    example: UserStatus.ACTIVE,
    description: 'ACTIVE | INACTIVE | SUSPENDED | PENDING_APPROVAL',
  })
  @IsEnum(UserStatus)
  status: UserStatus;
}
