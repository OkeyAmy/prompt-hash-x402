/**
 * Stacks blockchain utilities
 */

export const LISTING_FEE_MICRO_STX = "1000"; // 0.001 STX

/**
 * Extract transaction hash from Stacks wallet response
 */
export function extractTransactionHash(payload: unknown): string | null {
  const value = payload as Record<string, any>;
  if (!value) return null;

  // Try multiple paths for transaction hash
  const paths = [
    value.txId,
    value.txid,
    value.transaction,
    value.result?.txId,
    value.result?.txid,
    value.result?.transaction,
  ];

  for (const path of paths) {
    if (typeof path === "string" && path.startsWith("0x")) {
      return path;
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
