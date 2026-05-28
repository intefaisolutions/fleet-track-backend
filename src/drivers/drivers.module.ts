import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Driver, DriverSchema } from './schemas/driver.schema';
import { DriversController } from './controllers/drivers.controller';
import { DriversService } from './services/drivers.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Driver.name, schema: DriverSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [DriversController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
