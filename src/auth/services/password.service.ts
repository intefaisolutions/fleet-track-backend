import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class PasswordService {
  private readonly saltRounds = 12;

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.saltRounds);
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  generateResetToken(): { token: string; expires: Date; hash: string } {
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const hash = this.hashToken(token);
    return { token, expires, hash };
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
