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

export function buildPaymentRequirements(params: {
  amountBaseUnits: string;
  currency: Currency;
  payTo: string;
}): PaymentRequirementsV2 {
  // x402scan compatibility: include both V2 standard fields and x402scan-expected fields
  return {
    scheme: "exact",
    network: getStacksNetworkForRegistration(), // "stacks" for x402scan compatibility
    amount: params.amountBaseUnits,
    maxAmountRequired: params.amountBaseUnits, // x402scan expects this field
    asset: resolveX402Asset(params.currency),
    payTo: params.payTo,
    maxTimeoutSeconds: 300,
  } as any; // TypeScript workaround for extra fields
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
  const verifier = new X402PaymentVerifier(
    process.env.FACILITATOR_URL || "https://facilitator.stacksx402.com",
  );
  return verifier.settle(paymentPayload, { paymentRequirements });
}
