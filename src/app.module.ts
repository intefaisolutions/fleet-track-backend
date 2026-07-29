import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseModule } from './database/database.module';
import { ResponseModule } from './common/responses/response.module';
import { HealthController } from './common/controllers/health.controller';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { Company, CompanySchema } from './companies/schemas/company.schema';
import { LicensesModule } from './licenses/licenses.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { DriversModule } from './drivers/drivers.module';
import { ExpensesModule } from './expenses/expenses.module';
import { ReportsModule } from './reports/reports.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { SettingsModule } from './settings/settings.module';
import { PlatformModule } from './platform/platform.module';
import { SocketModule } from './socket/socket.module';
import { MailModule } from './mail/mail.module';
import { StorageModule } from './storage/storage.module';
import { DriverAppModule } from './driver-app/driver-app.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { SupportAdminPermissionsGuard } from './guards/support-admin-permissions.guard';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { WalletsModule } from './wallets/wallets.module';
import { LicenseSessionMiddleware } from './middleware/license-session.middleware';

@Module({
  imports: [
    DatabaseModule,
    ResponseModule,
    MailModule,
    StorageModule,
    DriverAppModule,
    AuthModule,
    CompaniesModule,
    LicensesModule,
    SubscriptionsModule,
    UsersModule,
    VehiclesModule,
    DriversModule,
    ExpensesModule,
    ReportsModule,
    AnalyticsModule,
    NotificationsModule,
    PaymentsModule,
    PlatformModule,
    SettingsModule,
    SocketModule,
    WalletsModule,
    MongooseModule.forFeature([
      { name: Company.name, schema: CompanySchema },
    ]),
  ],
  controllers: [HealthController],
  providers: [
    LicenseSessionMiddleware,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: SupportAdminPermissionsGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LicenseSessionMiddleware)
      .forRoutes({ path: '{*splat}', method: RequestMethod.ALL });
  }
}
