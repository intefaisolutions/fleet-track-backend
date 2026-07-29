import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@Injectable()
export class SocketService {
  private readonly logger = new Logger(SocketService.name);
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  handleConnection(client: Socket) {
    const companyId =
      (client.handshake.auth?.companyId as string | undefined) ||
      (client.handshake.query?.companyId as string | undefined);
    const userId =
      (client.handshake.auth?.userId as string | undefined) ||
      (client.handshake.query?.userId as string | undefined);

    if (companyId) {
      void client.join(`company:${companyId}`);
    }
    if (userId) {
      void client.join(`user:${userId}`);
    }

    this.logger.debug(
      `Client connected ${client.id} company=${companyId ?? '-'} user=${userId ?? '-'}`,
    );
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  emitToCompany(companyId: string, event: string, payload: unknown) {
    this.server?.to(`company:${companyId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  emitVehicleLocation(companyId: string, vehicleId: string, location: unknown) {
    this.emitToCompany(companyId, 'vehicle:location', { vehicleId, location });
  }

  emitNotification(companyId: string, notification: unknown) {
    this.emitToCompany(companyId, 'notification:new', notification);
  }
}
