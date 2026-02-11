export type Currency = "STX" | "SBTC";

export type PromptMetadata = {
  id: string;
  title: string;
  description: string;
  category: string;
  image_url: string | null;
  price_base_units: string;
  currency: Currency;
  seller_wallet: string;
  is_listed: boolean;
};

export type PromptRecord = PromptMetadata & {
  paid_content: string;
  created_at: string;
  updated_at: string;
};

export type PurchaseRecord = {
  id: string;
  prompt_id: string;
  buyer_wallet: string;
  currency: Currency;
  amount_base_units: string;
  payment_tx: string | null;
  created_at: string;
};

export const PROMPT_METADATA_SELECT =
  "id,title,description,image_url,category,price_base_units,currency,seller_wallet,is_listed";

export function getCurrencyDecimals(currency: Currency): number {
  return currency === "SBTC" ? 8 : 6;
}

export function formatBaseUnits(amountBaseUnits: string, currency: Currency): string {
  const decimals = getCurrencyDecimals(currency);
  const raw = amountBaseUnits || "0";
  const padded = raw.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fractional = padded.slice(-decimals).replace(/0+$/, "");
  return fractional ? `${whole}.${fractional}` : whole;
}

export function parseDisplayAmountToBaseUnits(
  amount: string,
  currency: Currency,
): string {
  const decimals = getCurrencyDecimals(currency);
  const normalized = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Invalid amount format");
  }

  const [whole, fraction = ""] = normalized.split(".");
  const fractionDigits = fraction.slice(0, decimals).padEnd(decimals, "0");
  const merged = `${whole}${fractionDigits}`.replace(/^0+/, "");
  return merged.length ? merged : "0";
}

export function normalizeCurrency(value: string | null | undefined): Currency {
  return value?.toUpperCase() === "SBTC" ? "SBTC" : "STX";
}
