/**
 * React hook for monitoring localStorage health and providing user notifications.
 */

import { useEffect, useState } from "react";
import { checkStorageHealth } from "../services/storageMonitor";
import type { StorageQuotaInfo } from "../services/storageMonitor";

export interface StorageHealthStatus {
  healthy: boolean;
  warnings: string[];
  info: StorageQuotaInfo;
  lastChecked: Date;
}

export function useStorageMonitor(
  checkIntervalMs: number = 30000 // Check every 30 seconds
): StorageHealthStatus | null {
  const [status, setStatus] = useState<StorageHealthStatus | null>(null);

  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function check() {
      try {
        const health = await checkStorageHealth();
        if (mounted) {
          setStatus({
            healthy: health.healthy,
            warnings: health.warnings,
            info: health.info,
            lastChecked: new Date(),
          });

          // Schedule next check (wrap async in void to satisfy lint rule)
          timeoutId = setTimeout(() => {
            void check();
          }, checkIntervalMs);
        }
      } catch (error) {
        console.warn("Failed to check storage health:", error);
        // Retry after interval even on error
        if (mounted) {
          timeoutId = setTimeout(() => {
            void check();
          }, checkIntervalMs);
        }
      }
    }

    // Initial check
    void check();

    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [checkIntervalMs]);

  return status;
}
