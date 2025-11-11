/**
 * Storage quota monitoring and error recovery utilities.
 * Provides warnings when approaching quota limits and facilitates data cleanup.
 */

import type { StorageLike } from "./storage";
import { getStorage } from "./storage";

export interface StorageQuotaInfo {
  used: number;
  available: number | null;
  percentage: number | null;
  isNearLimit: boolean;
  isAtLimit: boolean;
}

/**
 * Estimates the size of data stored under a specific key prefix.
 * Returns size in bytes.
 */
export function estimateStorageSize(
  prefix: string,
  storage: StorageLike | null = getStorage()
): number {
  if (!storage) return 0;

  let totalBytes = 0;
  try {
    for (let i = 0; i < (storage as Storage).length; i++) {
      const key = (storage as Storage).key(i);
      if (key && key.startsWith(prefix)) {
        const value = storage.getItem(key);
        if (value) {
          // Estimate: each character is ~2 bytes in UTF-16
          totalBytes += (key.length + value.length) * 2;
        }
      }
    }
  } catch {
    // If storage doesn't support length/key enumeration, return 0
    return 0;
  }
  return totalBytes;
}

/**
 * Gets quota information for localStorage.
 * Uses StorageManager API when available, otherwise provides estimates.
 */
export async function getStorageQuota(): Promise<StorageQuotaInfo> {
  const defaultInfo: StorageQuotaInfo = {
    used: 0,
    available: null,
    percentage: null,
    isNearLimit: false,
    isAtLimit: false,
  };

  // Try modern StorageManager API
  if ("storage" in navigator && "estimate" in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || null;

      if (quota && quota > 0) {
        const percentage = (usage / quota) * 100;
        return {
          used: usage,
          available: quota - usage,
          percentage,
          isNearLimit: percentage >= 80,
          isAtLimit: percentage >= 95,
        };
      }
    } catch {
      // Fall through to legacy estimation
    }
  }

  // Fallback: estimate based on typical 5-10MB localStorage limit
  const storage = getStorage();
  if (!storage) return defaultInfo;

  const used = estimateStorageSize("", storage);
  const estimatedQuota = 5 * 1024 * 1024; // Conservative 5MB estimate
  const percentage = (used / estimatedQuota) * 100;

  return {
    used,
    available: estimatedQuota - used,
    percentage,
    isNearLimit: percentage >= 80,
    isAtLimit: percentage >= 95,
  };
}

/**
 * Formats bytes into human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Checks if an error is a quota exceeded error.
 */
export function isQuotaExceededError(error: unknown): boolean {
  if (error instanceof DOMException) {
    // Different browsers use different error names
    return (
      error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      // Firefox
      error.code === 22 || // Legacy code
      error.code === 1014 // Legacy Firefox code
    );
  }
  return false;
}

/**
 * Gets a user-friendly error message for storage errors.
 */
export function getStorageErrorMessage(error: unknown): string {
  if (isQuotaExceededError(error)) {
    return "Storage quota exceeded. Please free up space by removing old data or exporting and clearing your transactions.";
  }

  if (error instanceof Error) {
    return `Storage error: ${error.message}`;
  }

  return "An unexpected storage error occurred.";
}

/**
 * Lists all keys for a given prefix, sorted by size (largest first).
 * Useful for identifying what to clean up when approaching quota.
 */
export function listStorageKeysBySize(
  prefix: string,
  storage: StorageLike | null = getStorage()
): Array<{ key: string; size: number }> {
  if (!storage) return [];

  const keys: Array<{ key: string; size: number }> = [];
  try {
    for (let i = 0; i < (storage as Storage).length; i++) {
      const key = (storage as Storage).key(i);
      if (key && key.startsWith(prefix)) {
        const value = storage.getItem(key);
        if (value) {
          const size = (key.length + value.length) * 2;
          keys.push({ key, size });
        }
      }
    }
  } catch {
    return [];
  }

  return keys.sort((a, b) => b.size - a.size);
}

/**
 * Monitors storage and returns warnings if approaching limits.
 */
export async function checkStorageHealth(): Promise<{
  healthy: boolean;
  warnings: string[];
  info: StorageQuotaInfo;
}> {
  const info = await getStorageQuota();
  const warnings: string[] = [];

  if (info.isAtLimit) {
    warnings.push(
      `Storage is at capacity (${info.percentage?.toFixed(
        1
      )}%). Application may fail to save data.`
    );
  } else if (info.isNearLimit) {
    warnings.push(
      `Storage is nearly full (${info.percentage?.toFixed(
        1
      )}%). Consider exporting and cleaning up old data.`
    );
  }

  if (info.available !== null && info.available < 100 * 1024) {
    // Less than 100KB available
    warnings.push(
      `Only ${formatBytes(info.available)} of storage space remaining.`
    );
  }

  return {
    healthy: warnings.length === 0,
    warnings,
    info,
  };
}
