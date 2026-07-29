/**
 * Soft-delete helpers.
 * Records are never removed from MongoDB — only flagged.
 */

export const NOT_DELETED_FILTER = { isDeleted: { $ne: true } } as const;

export type SoftDeleteFields = {
  isDeleted?: boolean;
  deletedAt?: Date | null;
};

/** Merge into list/count query filters so soft-deleted rows stay hidden. */
export function withNotDeleted<T extends Record<string, unknown>>(
  filter: T = {} as T,
): T & typeof NOT_DELETED_FILTER {
  return { ...filter, ...NOT_DELETED_FILTER };
}

/** $set payload for soft delete. Also deactivates `isActive` when present on the schema. */
export function softDeleteUpdate(
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    isDeleted: true,
    deletedAt: new Date(),
    isActive: false,
    ...extra,
  };
}

/** $set payload to restore a soft-deleted record. */
export function restoreUpdate(
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    isDeleted: false,
    deletedAt: null,
    isActive: true,
    ...extra,
  };
}

/**
 * Free unique indexes (email/phone/registration/license key) while keeping the row.
 * Original value is recoverable via {@link restoreUniqueValue}.
 */
export function tombstoneUniqueValue(value: string, id: string): string {
  const marker = `__del_${id}`;
  if (!value || value.includes('__del_')) return value;
  return `${value}${marker}`;
}

export function restoreUniqueValue(value: string, id: string): string {
  const marker = `__del_${id}`;
  if (!value || !value.endsWith(marker)) return value;
  return value.slice(0, -marker.length);
}
