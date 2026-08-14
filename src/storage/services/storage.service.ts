import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import {
  ALLOWED_IMAGE_MIME,
  MAX_UPLOAD_BYTES,
  type StorageFolder,
} from '../storage.constants';

export type UploadImageResult = {
  /** Canonical URL stored in MongoDB (may be private). */
  url: string;
  path: string;
  /** Browser-ready URL (presigned when bucket is private). */
  viewUrl: string;
};

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3: S3Client | null = null;
  private supabase: SupabaseClient | null = null;

  constructor(private readonly configService: ConfigService) {}

  /** Prefer AWS S3 when credentials are present; otherwise Supabase. */
  isConfigured(): boolean {
    return this.isS3Configured() || this.isSupabaseConfigured();
  }

  isS3Configured(): boolean {
    const region = this.configService.get<string>('aws.region');
    const bucket = this.configService.get<string>('aws.bucket');
    const accessKeyId = this.configService.get<string>('aws.accessKeyId');
    const secretAccessKey = this.configService.get<string>('aws.secretAccessKey');
    return Boolean(region && bucket && accessKeyId && secretAccessKey);
  }

  private isSupabaseConfigured(): boolean {
    const enabled = this.configService.get<boolean>('supabase.enabled');
    const url = this.configService.get<string>('supabase.url');
    const key = this.configService.get<string>('supabase.serviceRoleKey');
    return Boolean(enabled && url && key);
  }

  private isPublicRead(): boolean {
    const raw = this.configService.get<string>('aws.publicRead');
    return raw === 'true' || raw === '1';
  }

  private getS3(): S3Client {
    if (!this.s3) {
      const region = this.configService.get<string>('aws.region') || 'ap-south-1';
      const accessKeyId = this.configService.get<string>('aws.accessKeyId');
      const secretAccessKey = this.configService.get<string>('aws.secretAccessKey');
      if (!accessKeyId || !secretAccessKey) {
        throw new ServiceUnavailableException(
          'S3 is not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env',
        );
      }
      this.s3 = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
    }
    return this.s3;
  }

  private getSupabase(): SupabaseClient {
    if (!this.supabase) {
      const url = this.configService.get<string>('supabase.url');
      const key = this.configService.get<string>('supabase.serviceRoleKey');
      if (!url || !key) {
        throw new ServiceUnavailableException(
          'Image storage is not configured. Set AWS S3 or SUPABASE_* in .env',
        );
      }
      this.supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return this.supabase;
  }

  async uploadImage(params: {
    folder: StorageFolder;
    buffer: Buffer;
    mimeType: string;
    originalName?: string;
    userId: string;
    companyId?: string;
  }): Promise<UploadImageResult> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Image storage is not configured. Set AWS_S3_BUCKET_NAME + AWS keys (preferred) or Supabase.',
      );
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
    const fileName =
      folder === 'companies' ? `logo${ext}` : `${randomUUID()}${ext}`;
    const path =
      folder === 'companies' && companyId
        ? `companies/${companyId}/${fileName}`
        : `${folder}/${scope}/${fileName}`;

    if (this.isS3Configured()) {
      return this.uploadToS3(path, buffer, mimeType);
    }
    return this.uploadToSupabase(path, buffer, mimeType);
  }

  /**
   * Turn a stored S3/public URL into something an <img> can load.
   * No-op for data URLs, blob URLs, and non-S3 links.
   */
  async toViewUrl(storedUrl?: string | null): Promise<string | undefined> {
    if (!storedUrl) return undefined;
    if (
      storedUrl.startsWith('data:') ||
      storedUrl.startsWith('blob:') ||
      !this.isS3Configured() ||
      this.isPublicRead()
    ) {
      return storedUrl;
    }

    const key = this.extractS3Key(storedUrl);
    if (!key) return storedUrl;

    try {
      return await this.signGetUrl(key);
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to sign S3 URL: ${err instanceof Error ? err.message : err}`,
      );
      return storedUrl;
    }
  }

  private async uploadToS3(
    path: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<UploadImageResult> {
    const bucket = this.configService.get<string>('aws.bucket');
    const region = this.configService.get<string>('aws.region') || 'ap-south-1';
    if (!bucket) {
      throw new ServiceUnavailableException('AWS_S3_BUCKET_NAME is not set');
    }

    try {
      await this.getS3().send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: path,
          Body: buffer,
          ContentType: mimeType,
          CacheControl: 'public, max-age=31536000',
        }),
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown S3 error';
      this.logger.error(`S3 upload failed: ${message}`, err);
      throw new BadRequestException(`S3 upload failed: ${message}`);
    }

    const url = `https://${bucket}.s3.${region}.amazonaws.com/${path}`;
    const viewUrl = this.isPublicRead() ? url : await this.signGetUrl(path);
    return { url, path, viewUrl };
  }

  private async signGetUrl(key: string, expiresIn = 60 * 60 * 24 * 7) {
    const bucket = this.configService.get<string>('aws.bucket');
    if (!bucket) {
      throw new ServiceUnavailableException('AWS_S3_BUCKET_NAME is not set');
    }
    return getSignedUrl(
      this.getS3(),
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn },
    );
  }

  private extractS3Key(urlOrPath: string): string | null {
    const bucket = this.configService.get<string>('aws.bucket');
    const region = this.configService.get<string>('aws.region') || 'ap-south-1';
    if (!bucket) return null;

    if (!/^https?:\/\//i.test(urlOrPath)) {
      return urlOrPath.replace(/^\//, '');
    }

    try {
      const u = new URL(urlOrPath);
      const host = u.hostname.toLowerCase();
      // virtual-hosted–style: bucket.s3.region.amazonaws.com/key
      if (
        host === `${bucket}.s3.${region}.amazonaws.com`.toLowerCase() ||
        host === `${bucket}.s3.amazonaws.com`.toLowerCase() ||
        host.startsWith(`${bucket}.s3.`) && host.endsWith('.amazonaws.com')
      ) {
        return decodeURIComponent(u.pathname.replace(/^\//, ''));
      }
      // path-style: s3.region.amazonaws.com/bucket/key
      if (host.startsWith('s3.') && host.endsWith('.amazonaws.com')) {
        const parts = u.pathname.replace(/^\//, '').split('/');
        if (parts[0] === bucket) {
          return decodeURIComponent(parts.slice(1).join('/'));
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  private async uploadToSupabase(
    path: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<UploadImageResult> {
    const bucket =
      this.configService.get<string>('supabase.bucket') || 'fleet-uploads';
    const supabase = this.getSupabase();
    const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType: mimeType,
      upsert: true,
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
    return {
      url: publicData.publicUrl,
      path,
      viewUrl: publicData.publicUrl,
    };
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
