# localStorage Error Handling & Monitoring

## Overview

This document describes the enhanced localStorage error handling and quota monitoring implemented for production readiness.

## Components

### 1. Storage Monitor (`src/services/storageMonitor.ts`)

Core utilities for monitoring and managing localStorage health:

#### Functions

**`estimateStorageSize(prefix: string): number`**

- Estimates the size of data stored under a specific key prefix
- Returns size in bytes
- Useful for identifying how much space specific features are using

**`getStorageQuota(): Promise<StorageQuotaInfo>`**

- Uses modern StorageManager API when available
- Falls back to conservative 5MB estimate for older browsers
- Returns detailed quota information including usage percentage

**`formatBytes(bytes: number): string`**

- Converts byte counts to human-readable format (KB, MB, GB)
- Example: `5242880` → `"5.00 MB"`

**`isQuotaExceededError(error: unknown): boolean`**

- Detects quota exceeded errors across different browsers
- Handles various error names and legacy error codes
- Used in catch blocks to identify storage limit issues

**`getStorageErrorMessage(error: unknown): string`**

- Provides user-friendly error messages
- Gives specific guidance for quota issues
- Defaults to generic message for unknown errors

**`listStorageKeysBySize(prefix: string): Array<{ key: string; size: number }>`**

- Lists all storage keys sorted by size (largest first)
- Helps identify what to clean up when approaching quota
- Useful for debugging and data management

**`checkStorageHealth(): Promise<{ healthy: boolean; warnings: string[]; info: StorageQuotaInfo }>`**

- Comprehensive health check
- Returns warnings when:
  - Storage is at capacity (≥95%)
  - Storage is nearly full (≥80%)
  - Less than 100KB available
- Provides actionable feedback for users

### 2. React Hook (`src/hooks/useStorageMonitor.ts`)

**`useStorageMonitor(checkIntervalMs?: number): StorageHealthStatus | null`**

React hook for monitoring storage health in components:

```typescript
interface StorageHealthStatus {
  healthy: boolean;
  warnings: string[];
  info: StorageQuotaInfo;
  lastChecked: Date;
}
```

**Usage:**

```typescript
const storageStatus = useStorageMonitor(30000); // Check every 30s

if (storageStatus && !storageStatus.healthy) {
  // Display warnings to user
  storageStatus.warnings.forEach((warning) => {
    console.warn(warning);
  });
}
```

**Features:**

- Automatic periodic health checks
- Cleanup on unmount
- Error recovery with retry
- No blocking - runs asynchronously

### 3. Enhanced Error Handling

#### In `src/state/transactionsStore.ts`

The `applyState()` function now:

1. Detects quota exceeded errors specifically
2. Provides detailed error messages in console
3. Suggests remediation actions (export/cleanup)
4. Falls back to in-memory storage gracefully
5. Continues operation even when persistence fails

**Example Error Flow:**

```
User adds transaction
  ↓
Transaction store attempts to persist
  ↓
Quota exceeded detected
  ↓
Error logged with guidance: "Consider exporting and removing old data"
  ↓
Fallback to in-memory storage
  ↓
User notified (via console)
  ↓
App continues functioning
```

#### In `src/lib/storage.ts`

The `saveState()` function now:

1. Checks for quota errors when saving UI snapshot
2. Provides specific guidance for different error types
3. Logs warnings appropriately
4. Gracefully handles unavailable storage

### 4. Storage Quota Information

**Thresholds:**

- **Healthy:** < 80% capacity
- **Warning:** 80-94% capacity
- **Critical:** ≥ 95% capacity

**Typical localStorage limits:**

- Desktop browsers: 5-10 MB
- Mobile browsers: 2-5 MB
- Private/Incognito mode: Often more restrictive

## Browser Compatibility

### Modern API Support (navigator.storage.estimate)

- ✅ Chrome 52+
- ✅ Firefox 51+
- ✅ Safari 15.2+
- ✅ Edge 79+

### Fallback Mode

- Works in all browsers
- Uses conservative 5MB estimate
- Still provides useful warnings

## Error Types Handled

1. **QuotaExceededError (DOMException)**

   - Most common storage error
   - Occurs when attempting to write beyond quota
   - Detected across all major browsers

2. **SecurityError**

   - Private browsing mode restrictions
   - Cross-origin issues
   - Handled as "unavailable" storage

3. **Write/Read Failures**
   - I/O errors
   - Corruption issues
   - Logged with specific error codes

## User Experience

### When Storage is Healthy

- No warnings displayed
- Silent background monitoring
- Optimal performance

### When Approaching Limit (80-94%)

- Console warning: "Storage is nearly full (XX.X%)"
- Suggestion: "Consider exporting and cleaning up old data"
- App continues functioning normally

### When At Limit (≥95%)

- Console error: "Storage is at capacity"
- Warning: "Application may fail to save data"
- Immediate action recommended
- In-memory fallback activated

### When Storage Unavailable

- Console warning: "localStorage is not available"
- In-memory storage used automatically
- Data persists during session only
- App remains functional

## Testing

### Manual Testing

**Test Quota Exceeded:**

```javascript
// In browser console
const testData = "x".repeat(1024 * 1024); // 1MB string
for (let i = 0; i < 10; i++) {
  localStorage.setItem(`test-${i}`, testData);
}
// Should trigger quota warnings/errors
```

**Check Current Usage:**

```javascript
// In browser console
import { checkStorageHealth } from "./services/storageMonitor";
const health = await checkStorageHealth();
console.log(health);
```

### Automated Testing

Tests cover:

- ✅ Error detection and handling
- ✅ Quota calculation
- ✅ Fallback mechanisms
- ✅ State persistence

Run tests:

```bash
npm test
```

## Production Deployment

### Recommended Configuration

1. **Enable Console Logging:**

   - Storage warnings appear in console
   - Users can see detailed error information
   - Helps with support/debugging

2. **Monitor Error Rates:**

   - Track quota exceeded errors in analytics
   - Set alerts for high error rates
   - Consider data retention policies

3. **User Education:**
   - Explain export/backup feature
   - Document data cleanup procedures
   - Provide storage usage dashboard (future)

### Future Enhancements

1. **Visual Warnings:**

   - Add UI component to display storage warnings
   - Show storage usage percentage in settings
   - Prompt user action when critical

2. **Automatic Cleanup:**

   - Offer to archive old transactions
   - Compress data before storing
   - Implement data retention policies

3. **Alternative Storage:**

   - IndexedDB fallback for larger datasets
   - Cloud sync option
   - Export to file system API

4. **Storage Dashboard:**
   - Visual breakdown of storage by feature
   - One-click cleanup options
   - Export/import utilities

## Troubleshooting

### "Storage quota exceeded" errors

**Causes:**

- Too many transactions stored
- Large template library
- Browser quota restrictions
- Private browsing mode

**Solutions:**

1. Export and backup data
2. Delete old/unnecessary transactions
3. Remove unused templates
4. Use regular browsing mode
5. Try different browser

### Storage not persisting between sessions

**Causes:**

- Private/Incognito mode
- Browser settings blocking storage
- Storage quota reached

**Solutions:**

1. Check browser privacy settings
2. Disable "Clear cookies on exit"
3. Use regular browsing mode
4. Free up storage space

### Performance degradation

**Causes:**

- Large dataset in localStorage
- Frequent read/write operations
- Quota warnings overhead

**Solutions:**

1. Export and archive old data
2. Reduce check interval in useStorageMonitor
3. Optimize transaction count
4. Consider pagination

## API Reference

See inline JSDoc comments in:

- `src/services/storageMonitor.ts`
- `src/hooks/useStorageMonitor.ts`
- `src/state/transactionsStore.ts`
- `src/lib/storage.ts`

## Related Files

- `src/services/storage.ts` - Low-level storage abstraction
- `src/state/persistence.ts` - Transaction state persistence
- `src/types/domain.ts` - Domain type definitions
- `AGENTS.md` - Architecture documentation

## Maintenance

When modifying storage logic:

1. Update error handling to use `isQuotaExceededError()`
2. Add appropriate logging
3. Test with quota exceeded scenarios
4. Update this documentation
5. Consider impact on existing users

## Resources

- [MDN: StorageManager API](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager)
- [MDN: Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
- [Storage Quota Management](https://web.dev/storage-for-the-web/)
