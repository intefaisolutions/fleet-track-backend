import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SocketService } from '../services/socket.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/fleet',
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly socketService: SocketService) {
    this.socketService.setServer(this.server);
  }

  handleConnection(client: Socket) {
    this.socketService.handleConnection(client);
  }

  handleDisconnect(client: Socket) {
    this.socketService.handleDisconnect(client);
  }
}
