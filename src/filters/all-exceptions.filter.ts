import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { mongoUserMessage } from '../common/utils/mongo-error.util';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message: string | string[] =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as { message?: string | string[] })?.message ||
          'Internal server error';

    if (
      status === HttpStatus.INTERNAL_SERVER_ERROR &&
      (message === 'Internal server error' || !message)
    ) {
      const mongoMsg = mongoUserMessage(exception);
      if (mongoMsg) {
        message = mongoMsg;
      }
    }

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.message : String(exception),
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const extraData =
      exceptionResponse &&
      typeof exceptionResponse === 'object' &&
      'data' in exceptionResponse
        ? (exceptionResponse as { data?: unknown }).data
        : undefined;

    const resolvedMessage = Array.isArray(message)
      ? message.join(', ')
      : message;

    response.status(status).json({
      success: false,
      message: resolvedMessage,
      error:
        exception instanceof Error ? exception.name : 'InternalServerError',
      ...(extraData !== undefined ? { data: extraData } : {}),
    });
  }
}
