import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return {
      success: true,
      message: 'Fleet SaaS API is running',
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
