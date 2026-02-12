import {
  X402PaymentVerifier,
  X402_HEADERS,
  isValidStacksAddress,
  networkToCAIP2,
  type PaymentPayloadV2,
  type PaymentRequiredV2,
  type PaymentRequirementsV2,
} from "x402-stacks";
import {
  parseDisplayAmountToBaseUnits,
  type Currency,
} from "@/lib/marketplace";

export { X402_HEADERS };

export function getStacksNetwork(): "mainnet" | "testnet" {
  return process.env.NETWORK === "mainnet" ? "mainnet" : "testnet";
}

export function getStacksNetworkCAIP2() {
  return networkToCAIP2(getStacksNetwork());
}

export function resolveX402Asset(currency: Currency): string {
  if (currency === "STX") return "STX";
  return (
    process.env.SBTC_CONTRACT_TESTNET ||
    "ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token"
  );
}

const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;
const DECIMAL_PATTERN = /^\d+\.\d+$/;
const STACKS_CAIP2_PATTERN = /^stacks:\d+$/;

function normalizePositiveIntegerString(value: string): string {
  const normalized = value.replace(/^0+(?=\d)/, "");
  if (!POSITIVE_INTEGER_PATTERN.test(normalized)) {
    throw new Error("x402 amount must be a positive integer string in base units");
  }
  return normalized;
}

function normalizeAmountBaseUnits(rawAmount: string, currency: Currency): string {
  const value = String(rawAmount ?? "").trim();
  if (!value) {
    throw new Error("x402 amount is required");
  }

  if (DECIMAL_PATTERN.test(value)) {
    return normalizePositiveIntegerString(
      parseDisplayAmountToBaseUnits(value, currency),
    );
  }

  return normalizePositiveIntegerString(value);
}

export function buildPaymentRequirements(params: {
  amountBaseUnits: string;
  currency: Currency;
  payTo: string;
}): PaymentRequirementsV2 {
  const network = getStacksNetworkCAIP2();
  if (!STACKS_CAIP2_PATTERN.test(network)) {
    throw new Error(`Invalid Stacks CAIP-2 network: ${network}`);
  }

  const payTo = params.payTo.trim();
  if (!isValidStacksAddress(payTo)) {
    throw new Error(`Invalid payTo Stacks address: ${payTo}`);
  }

  return {
    scheme: "exact",
    network,
    amount: normalizeAmountBaseUnits(params.amountBaseUnits, params.currency),
    asset: resolveX402Asset(params.currency),
    payTo,
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
  const resourceUrl = params.resourceUrl.trim();
  if (!resourceUrl) {
    throw new Error("x402 resource URL is required");
  }

  return {
    x402Version: 2,
    error: "Payment required",
    resource: {
      url: resourceUrl,
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
