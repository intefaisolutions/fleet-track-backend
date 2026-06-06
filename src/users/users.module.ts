import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { DriversModule } from '../drivers/drivers.module';
import { Company, CompanySchema } from '../companies/schemas/company.schema';
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Company.name, schema: CompanySchema },
    ]),
    forwardRef(() => AuthModule),
    MailModule,
    forwardRef(() => DriversModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
