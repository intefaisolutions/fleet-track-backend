import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@Injectable()
export class SocketService {
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  emitToCompany(companyId: string, event: string, payload: unknown) {
    this.server?.to(`company:${companyId}`).emit(event, payload);
  }

  emitVehicleLocation(companyId: string, vehicleId: string, location: unknown) {
    this.emitToCompany(companyId, 'vehicle:location', { vehicleId, location });
  }

  emitNotification(companyId: string, notification: unknown) {
    this.emitToCompany(companyId, 'notification:new', notification);
  }
}
