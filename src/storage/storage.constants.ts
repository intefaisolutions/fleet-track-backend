export const STORAGE_FOLDERS = ['receipts', 'vehicles', 'profiles'] as const;
export type StorageFolder = (typeof STORAGE_FOLDERS)[number];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
