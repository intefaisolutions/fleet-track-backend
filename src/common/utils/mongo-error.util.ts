import { ConflictException } from '@nestjs/common';

type MongoLikeError = {
  name?: string;
  code?: number | string;
  message?: string;
  keyPattern?: Record<string, number>;
  keyValue?: Record<string, unknown>;
};

export function asMongoError(err: unknown): MongoLikeError | null {
  if (!err || typeof err !== 'object') return null;
  return err as MongoLikeError;
}

export function isMongoDuplicateKey(err: unknown): boolean {
  const e = asMongoError(err);
  return e?.code === 11000 || e?.code === '11000';
}

export function isTransientMongoError(err: unknown): boolean {
  const e = asMongoError(err);
  if (!e) return false;
  const name = e.name ?? '';
  const message = e.message ?? '';
  if (
    name === 'MongoNetworkError' ||
    name === 'MongoNetworkTimeoutError' ||
    name === 'MongoServerSelectionError'
  ) {
    return true;
  }
  return /timed out|ECONNRESET|not primary|TransientTransactionError|topology was destroyed|connection.*closed/i.test(
    message,
  );
}

/** Map known Mongo errors to a user-facing message (or null). */
export function mongoUserMessage(err: unknown): string | null {
  const e = asMongoError(err);
  if (!e) return null;

  if (isMongoDuplicateKey(e)) {
    if (e.keyPattern?.registrationNumber) {
      return 'A vehicle with this registration number already exists.';
    }
    if (e.keyPattern?.email) {
      return 'Email already exists.';
    }
    if (e.keyPattern?.phone) {
      return 'Phone number already exists.';
    }
    if (e.keyPattern?.licenseKey) {
      return 'License key already exists.';
    }
    return 'This record already exists (duplicate value).';
  }

  if (isTransientMongoError(e)) {
    return 'Database connection issue. Please try again in a moment.';
  }

  if (e.name === 'ValidationError' || e.name === 'CastError') {
    return e.message?.slice(0, 240) || 'Invalid data for this request.';
  }

  if (e.name === 'MongoServerError' && e.message) {
    return e.message.slice(0, 240);
  }

  return null;
}

export function throwIfMongoDuplicate(
  err: unknown,
  fallbackMessage = 'Duplicate value — this record already exists.',
): never {
  if (isMongoDuplicateKey(err)) {
    throw new ConflictException(mongoUserMessage(err) ?? fallbackMessage);
  }
  throw err;
}
