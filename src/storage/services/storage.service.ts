import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import {
  ALLOWED_IMAGE_MIME,
  MAX_UPLOAD_BYTES,
  type StorageFolder,
} from '../storage.constants';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: SupabaseClient | null = null;

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    const enabled = this.configService.get<boolean>('supabase.enabled');
    const url = this.configService.get<string>('supabase.url');
    const key = this.configService.get<string>('supabase.serviceRoleKey');
    return Boolean(enabled && url && key);
  }

  private getClient(): SupabaseClient {
    if (!this.client) {
      const url = this.configService.get<string>('supabase.url');
      const key = this.configService.get<string>('supabase.serviceRoleKey');
      if (!url || !key) {
        throw new ServiceUnavailableException(
          'Image storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env',
        );
      }
      this.client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return this.client;
  }

  async uploadImage(params: {
    folder: StorageFolder;
    buffer: Buffer;
    mimeType: string;
    originalName?: string;
    userId: string;
    companyId?: string;
  }): Promise<{ url: string; path: string }> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Supabase storage is disabled');
    }

    const { folder, buffer, mimeType, originalName, userId, companyId } = params;

    if (buffer.length > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('Image must be 5MB or smaller');
    }
    if (!ALLOWED_IMAGE_MIME.has(mimeType)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are allowed');
    }

    const ext = this.extensionFromMime(mimeType, originalName);
    const scope = companyId ? `company-${companyId}` : `user-${userId}`;
    const path = `${folder}/${scope}/${randomUUID()}${ext}`;
    const bucket = this.configService.get<string>('supabase.bucket') || 'fleet-uploads';

    const supabase = this.getClient();
    const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType: mimeType,
      upsert: false,
    });

    if (error) {
      this.logger.error(`Supabase upload failed: ${error.message}`, error);
      throw new BadRequestException(
        error.message.includes('Bucket not found')
          ? `Storage bucket "${bucket}" not found. Create it in Supabase Dashboard (public).`
          : `Upload failed: ${error.message}`,
      );
    }

    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
    return { url: publicData.publicUrl, path };
  }

  private extensionFromMime(mime: string, name?: string): string {
    if (name) {
      const match = name.match(/\.[a-zA-Z0-9]+$/);
      if (match) return match[0].toLowerCase();
    }
    switch (mime) {
      case 'image/png':
        return '.png';
      case 'image/webp':
        return '.webp';
      default:
        return '.jpg';
    }
  }
}
