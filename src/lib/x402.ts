import {
  X402PaymentVerifier,
  X402_HEADERS,
  networkToCAIP2,
  type PaymentPayloadV2,
  type PaymentRequiredV2,
  type PaymentRequirementsV2,
} from "x402-stacks";
import type { Currency } from "@/lib/marketplace";

export { X402_HEADERS };

export function getStacksNetwork(): "mainnet" | "testnet" {
  return process.env.NETWORK === "mainnet" ? "mainnet" : "testnet";
}

export function getStacksNetworkCAIP2() {
  return networkToCAIP2(getStacksNetwork());
}

export function getStacksNetworkForRegistration(): "stacks" {
  // x402scan requires just "stacks" regardless of mainnet/testnet
  return "stacks";
}

export function resolveX402Asset(currency: Currency): string {
  if (currency === "STX") return "STX";
  return (
    process.env.SBTC_CONTRACT_TESTNET ||
    "ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token"
  );
}

/**
 * Build PaymentRequirementsV2 for facilitator (uses CAIP-2 network).
 * Use getStacksNetworkForRegistration() only for schema/x402scan.
 */
export function buildPaymentRequirements(params: {
  amountBaseUnits: string;
  currency: Currency;
  payTo: string;
}): PaymentRequirementsV2 {
  return {
    scheme: "exact",
    network: getStacksNetworkCAIP2(), // CAIP-2 required for facilitator
    amount: String(params.amountBaseUnits),
    asset: resolveX402Asset(params.currency),
    payTo: params.payTo,
    maxTimeoutSeconds: 300,
  };
}

export function buildPaymentRequiredResponse(params: {
  resourceUrl: string;
  description: string;
  amountBaseUnits: string;
  currency: Currency;
  payTo: string;
}): PaymentRequiredV2 {
  return {
    x402Version: 2,
    resource: {
      url: params.resourceUrl,
      description: params.description,
      mimeType: "application/json",
    },
    accepts: [
      buildPaymentRequirements({
        amountBaseUnits: params.amountBaseUnits,
        currency: params.currency,
        payTo: params.payTo,
      }),
    ],
  };
}

/**
 * Build V1-format 402 Payment Required response for x402scan compatibility.
 * V1 uses a flat structure with payment fields at the root level.
 */
export function buildPaymentRequiredResponseV1(params: {
  resourceUrl: string;
  description: string;
  amountBaseUnits: string;
  currency: Currency;
  payTo: string;
}): Record<string, unknown> {
  const maxTimeoutSeconds = 300;
  const amountNum = Number(params.amountBaseUnits) || 0;

  return {
    x402Version: 1,
    resource: params.resourceUrl, // V1: string URL, not object
    scheme: "exact",
    network: getStacksNetworkForRegistration(), // "stacks"
    maxAmountRequired: amountNum, // x402scan expects number type
    asset: resolveX402Asset(params.currency),
    payTo: params.payTo,
    description: params.description,
    mimeType: "application/json",
    maxTimeoutSeconds,
    nonce: crypto.randomUUID(), // Replay protection
    expiresAt: new Date(Date.now() + maxTimeoutSeconds * 1000).toISOString(),
  };
}

export function encodeX402Header(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64");
}

export function decodePaymentSignatureHeader(
  header: string | null,
): PaymentPayloadV2 | null {
  if (!header) return null;
  try {
    const decoded = Buffer.from(header, "base64").toString("utf-8");
    return JSON.parse(decoded) as PaymentPayloadV2;
  } catch {
    return null;
  }
}

export async function settlePayment(
  paymentPayload: PaymentPayloadV2,
  paymentRequirements: PaymentRequirementsV2,
) {
  console.log("🚀 [settlePayment] Calling facilitator...");
  console.log("📦 [settlePayment] Payment payload:", {
    x402Version: paymentPayload.x402Version,
    accepted: paymentPayload.accepted,
    payload: {
      transaction: paymentPayload.payload?.transaction?.substring(0, 40) + "...",
      transactionLength: paymentPayload.payload?.transaction?.length,
      broadcastOnSettle: (paymentPayload.payload as any)?.broadcastOnSettle,
    },
  });
  console.log("📋 [settlePayment] Payment requirements:", paymentRequirements);

  const facilitatorUrl = process.env.FACILITATOR_URL || "https://facilitator.stacksx402.com";
  console.log("🌐 [settlePayment] Facilitator URL:", facilitatorUrl);

  const verifier = new X402PaymentVerifier(facilitatorUrl);

  console.time("⏱️ [settlePayment] Facilitator duration");
  const result = await verifier.settle(paymentPayload, { paymentRequirements });
  console.timeEnd("⏱️ [settlePayment] Facilitator duration");

  console.log("📊 [settlePayment] Facilitator raw response:", JSON.stringify(result, null, 2));

  return result;
}
