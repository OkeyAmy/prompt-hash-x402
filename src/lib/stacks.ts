/**
 * Stacks blockchain utilities
 */

export const LISTING_FEE_MICRO_STX = "1000"; // 0.001 STX

/**
 * Normalize a transaction hash to 0x-prefixed format.
 * Stacks tx IDs may be 64 hex chars with or without 0x prefix.
 */
function normalizeTxHash(raw: string): string {
  const hex = raw.replace(/^0x/i, "").toLowerCase();
  if (/^[a-f0-9]{64}$/.test(hex)) {
    return `0x${hex}`;
  }
  return raw.startsWith("0x") ? raw : `0x${raw}`;
}

/**
 * Extract transaction hash from Stacks wallet response.
 * Handles openSTXTransfer (FinishedTxData), request('stx_transferStx') (TransactionResult),
 * and various wallet-specific response shapes.
 */
export function extractTransactionHash(payload: unknown): string | null {
  const value = payload as Record<string, unknown>;
  if (!value || typeof value !== "object") return null;

  // Try multiple paths for transaction hash (wallet responses vary)
  const paths = [
    value.txId,
    value.txid,
    value.tx_id,
    value.txHash,
    value.transaction,
    (value as { result?: Record<string, unknown> }).result?.txId,
    (value as { result?: Record<string, unknown> }).result?.txid,
    (value as { result?: Record<string, unknown> }).result?.transaction,
    (value as { data?: Record<string, unknown> }).data?.txId,
    (value as { data?: Record<string, unknown> }).data?.txid,
    (value as { data?: Record<string, unknown> }).data?.transaction,
    (value as { stacksTransaction?: { txid?: string } }).stacksTransaction?.txid,
  ];

  for (const path of paths) {
    if (typeof path === "string" && path.trim().length > 0) {
      return normalizeTxHash(path);
    }
  }

  return null;
}

/**
 * Verify a Stacks transaction (placeholder - would need Stacks API integration)
 * For MVP, we trust the client-provided tx hash
 */
export async function verifyStacksTransaction(
  txHash: string,
  expectedRecipient: string,
  expectedAmount: string,
): Promise<boolean> {
  // TODO: In production, verify via Stacks API
  // For now, just validate format
  if (!txHash || !txHash.startsWith("0x")) {
    return false;
  }

  // Basic validation - tx hash should be 66 characters (0x + 64 hex chars)
  if (txHash.length !== 66) {
    return false;
  }

  return true;
}
