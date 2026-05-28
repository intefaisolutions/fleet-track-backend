import { Global, Module } from '@nestjs/common';
import { SocketGateway } from './controllers/socket.gateway';
import { SocketService } from './services/socket.service';

@Global()
@Module({
  providers: [SocketGateway, SocketService],
  exports: [SocketService],
})
export class SocketModule {}
