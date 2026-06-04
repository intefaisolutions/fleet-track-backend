import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { APP_CONSTANTS } from './constants';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.setGlobalPrefix(APP_CONSTANTS.API_PREFIX);

  app.enableCors({
    origin: configService.get<string | string[]>('app.corsOrigin') || '*',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Fleet SaaS API')
    .setDescription('Enterprise fleet management platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth')
    .addTag('Companies')
    .addTag('Users')
    .addTag('Vehicles')
    .addTag('Drivers')
    .addTag('Expenses')
    .addTag('Licenses')
    .addTag('Subscriptions')
    .addTag('Payments')
    .addTag('Reports')
    .addTag('Analytics')
    .addTag('Notifications')
    .addTag('Settings')
    .addTag('Storage')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`Fleet SaaS API running on port ${port}`);
  console.log(`Swagger docs: http://localhost:${port}/docs`);
}

bootstrap();
