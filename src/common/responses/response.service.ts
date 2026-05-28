import { Injectable } from '@nestjs/common';
import { ApiResponse } from './api-response.interface';

@Injectable()
export class ResponseService {
  success<T>(message: string, data?: T, meta?: Record<string, unknown>): ApiResponse<T> {
    return { success: true, message, data, meta };
  }

  error<T = unknown>(message: string, error?: string, data?: T): ApiResponse<T> {
    return { success: false, message, error, data };
  }

  created<T>(message: string, data?: T): ApiResponse<T> {
    return { success: true, message, data };
  }
}
