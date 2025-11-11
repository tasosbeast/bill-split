import { z } from "zod";
import { roundToCents } from "../lib/money";
import type { SettlementStatus } from "../types/transaction";

/**
 * Zod schemas for validating and coercing persisted transaction state.
 * These schemas replace the ad-hoc sanitization logic in persistence.ts
 * while maintaining backward compatibility with existing stored data.
 */

const SETTLEMENT_STATUSES: SettlementStatus[] = [
  "initiated",
  "pending",
  "confirmed",
  "cancelled",
];

/**
 * Schema for persisted participant data.
 * Coerces string IDs and numeric amounts.
 * Filters out participants with empty IDs after trimming.
 */
export const PersistedParticipantSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform((val) => String(val).trim()),
    amount: z
      .union([z.number(), z.string()])
      .transform((val) => {
        const num = Number(val);
        return Number.isFinite(num) ? roundToCents(num) : 0;
      }),
  })
  .passthrough()
  .refine((data) => data.id.length > 0, {
    message: "Participant ID cannot be empty",
  });

/**
 * Schema for transaction payment metadata.
 * Validates that payment is an object (not array) or returns null.
 */
const TransactionPaymentMetadataSchema = z
  .record(z.unknown())
  .nullable()
  .catch(null);

/**
 * Schema for persisted transaction data.
 * Handles coercion, normalization, and settlement-specific fields.
 */
export const PersistedTransactionSchema = z
  .object({
    id: z.unknown().optional(),
    type: z.unknown().optional(),
    category: z.unknown().optional(),
    total: z.unknown().optional(),
    participants: z
      .array(z.unknown())
      .optional()
      .transform((arr) => {
        if (!arr) return [];
        return arr
          .map((item) => {
            const result = PersistedParticipantSchema.safeParse(item);
            return result.success ? result.data : null;
          })
          .filter((p): p is z.infer<typeof PersistedParticipantSchema> => p !== null);
      }),
    settlementStatus: z
      .unknown()
      .optional()
      .transform((val): SettlementStatus | undefined => {
        if (typeof val !== "string") return undefined;
        const lowered = val.trim().toLowerCase();
        // Normalize "canceled" to "cancelled"
        if (lowered === "canceled") return "cancelled";
        if (SETTLEMENT_STATUSES.includes(lowered as SettlementStatus)) {
          return lowered as SettlementStatus;
        }
        return undefined;
      }),
    settlementInitiatedAt: z.unknown().optional(),
    settlementConfirmedAt: z.unknown().optional(),
    settlementCancelledAt: z.unknown().optional(),
    payment: z
      .unknown()
      .optional()
      .transform((val) => {
        if (val === undefined) return undefined;
        if (!val || typeof val !== "object" || Array.isArray(val)) {
          return null;
        }
        const result = TransactionPaymentMetadataSchema.safeParse(val);
        return result.success ? result.data : null;
      }),
    createdAt: z.unknown().optional(),
    updatedAt: z.unknown().optional(),
  })
  .passthrough();

/**
 * Schema for the budgets record.
 * Validates and rounds budget values.
 */
const BudgetsSchema = z
  .record(z.unknown())
  .transform((input) => {
    const result: Record<string, number> = {};
    for (const [rawKey, rawValue] of Object.entries(input)) {
      if (typeof rawKey !== "string") continue;
      const value = Number(rawValue);
      if (!Number.isFinite(value) || value < 0) continue;
      result[rawKey] = roundToCents(value);
    }
    return result;
  })
  .catch({});

/**
 * Schema for the persisted transactions state payload.
 */
export const PersistedTransactionsStateSchema = z.object({
  transactions: z
    .array(z.unknown())
    .transform((arr) => {
      return arr
        .map((item) => {
          const result = PersistedTransactionSchema.safeParse(item);
          return result.success ? result.data : null;
        })
        .filter((t): t is z.infer<typeof PersistedTransactionSchema> => t !== null);
    })
    .catch([]),
  budgets: BudgetsSchema,
});

/**
 * Schema for the versioned envelope wrapper.
 * The version field helps handle future migrations.
 */
export const PersistedEnvelopeSchema = z.object({
  version: z.number().int().min(1),
  payload: PersistedTransactionsStateSchema,
});

/**
 * Type inference helpers
 */
export type PersistedParticipant = z.infer<typeof PersistedParticipantSchema>;
export type PersistedTransaction = z.infer<typeof PersistedTransactionSchema>;
export type PersistedTransactionsState = z.infer<typeof PersistedTransactionsStateSchema>;
export type PersistedEnvelope = z.infer<typeof PersistedEnvelopeSchema>;

/**
 * Parse a raw value as a persisted envelope.
 * Supports both legacy bare payloads (no version) and new envelope format.
 * 
 * @param raw - The raw value from storage (typically JSON.parse result)
 * @returns Parsed envelope with version and payload, or null if parsing fails
 */
export function parsePersistedEnvelope(
  raw: unknown
): { version: number; payload: PersistedTransactionsState } | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  // Try parsing as versioned envelope first
  const envelopeResult = PersistedEnvelopeSchema.safeParse(raw);
  if (envelopeResult.success) {
    return envelopeResult.data;
  }

  // Fall back to legacy bare payload format (no version field)
  const stateResult = PersistedTransactionsStateSchema.safeParse(raw);
  if (stateResult.success) {
    return {
      version: 1,
      payload: stateResult.data,
    };
  }

  return null;
}
