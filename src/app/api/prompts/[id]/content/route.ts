import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import {
  buildPaymentRequiredResponse,
  buildPaymentRequirements,
  decodePaymentSignatureHeader,
  encodeX402Header,
  settlePayment,
  X402_HEADERS,
} from "@/lib/x402";
import { normalizeCurrency } from "@/lib/marketplace";

function sanitizeWallet(value: string | null | undefined): string {
  return (value || "").trim();
}

const BYPASS_HEADER = "x-prompthash-bypass";
const BYPASS_HEADER_VALUE = "allow";

function allowFreeBypass(request: NextRequest): boolean {
  return (
    sanitizeWallet(request.headers.get(BYPASS_HEADER)).toLowerCase() ===
    BYPASS_HEADER_VALUE
  );
}

function setX402ResponseHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set(
    "Vary",
    `${X402_HEADERS.PAYMENT_SIGNATURE}, x-buyer-wallet, ${BYPASS_HEADER}`,
  );
}

function paymentRequiredResponse(params: {
  paymentRequired: ReturnType<typeof buildPaymentRequiredResponse>;
  body?: unknown;
}) {
  const response = NextResponse.json(params.body ?? params.paymentRequired, {
    status: 402,
  });
  response.headers.set(
    X402_HEADERS.PAYMENT_REQUIRED,
    encodeX402Header(params.paymentRequired),
  );
  setX402ResponseHeaders(response);
  return response;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseServiceClient();

    const { data: prompt, error: promptError } = await supabase
      .from("prompts")
      .select(
        "id,title,paid_content,price_base_units,currency,seller_wallet,is_listed",
      )
      .eq("id", id)
      .single();

    if (promptError || !prompt) {
      return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
    }

    const buyerWallet = sanitizeWallet(request.headers.get("x-buyer-wallet"));
    const bypassEnabled = allowFreeBypass(request);
    const currency = normalizeCurrency(prompt.currency);

    const paymentRequired = buildPaymentRequiredResponse({
      resourceUrl: request.url,
      description: `Unlock premium content for "${prompt.title}"`,
      amountBaseUnits: prompt.price_base_units,
      currency,
      payTo: prompt.seller_wallet,
    });

    // Optional first-party bypass path. This keeps marketplace UX for sellers
    // and prior buyers while preserving strict 402 behavior for external callers.
    if (
      bypassEnabled &&
      buyerWallet &&
      buyerWallet.toLowerCase() === prompt.seller_wallet.toLowerCase()
    ) {
      const response = NextResponse.json({
        content: prompt.paid_content,
        payment: { bypass: "seller" },
      });
      setX402ResponseHeaders(response);
      return response;
    }

    if (!prompt.is_listed) {
      return NextResponse.json(
        { error: "Prompt is not listed for sale" },
        { status: 404 },
      );
    }

    if (bypassEnabled && buyerWallet) {
      const { data: existingPurchase } = await supabase
        .from("purchases")
        .select("id")
        .eq("prompt_id", prompt.id)
        .eq("buyer_wallet", buyerWallet)
        .limit(1)
        .maybeSingle();

      if (existingPurchase) {
        const response = NextResponse.json({
          content: prompt.paid_content,
          payment: { bypass: "existing_purchase" },
        });
        setX402ResponseHeaders(response);
        return response;
      }
    }

    const paymentSignatureHeader = request.headers.get(
      X402_HEADERS.PAYMENT_SIGNATURE,
    );
    if (!paymentSignatureHeader) {
      console.info("[x402] payment challenge generated", {
        promptId: prompt.id,
        network: paymentRequired.accepts[0]?.network,
        asset: paymentRequired.accepts[0]?.asset,
        amount: paymentRequired.accepts[0]?.amount,
        payTo: paymentRequired.accepts[0]?.payTo,
        buyerWallet: buyerWallet || null,
        bypassEnabled,
      });

      return paymentRequiredResponse({ paymentRequired });
    }

    console.log("🔍 [Content API] Payment signature header received, length:", paymentSignatureHeader.length);

    const paymentPayload = decodePaymentSignatureHeader(paymentSignatureHeader);
    if (!paymentPayload) {
      console.warn("[x402] invalid payment-signature header", {
        promptId: prompt.id,
        buyerWallet: buyerWallet || null,
      });
      return NextResponse.json(
        { error: "Invalid payment-signature header" },
        { status: 400 },
      );
    }

    console.log("🔍 [Content API] Header payload check:", {
      x402Version: paymentPayload.x402Version,
      hasAccepted: !!paymentPayload.accepted,
      hasPayload: !!paymentPayload.payload,
      txLength: paymentPayload.payload?.transaction?.length,
    });

    const paymentRequirements = buildPaymentRequirements({
      amountBaseUnits: prompt.price_base_units,
      currency,
      payTo: prompt.seller_wallet,
    });

    console.log("🔍 [Content API] Calling facilitator settle...");
    const settlement = await settlePayment(paymentPayload, paymentRequirements);
    console.log("📊 [Content API] Settlement response:", {
      success: settlement.success,
      errorReason: settlement.errorReason,
      payer: settlement.payer,
      transaction: settlement.transaction,
    });

    if (!settlement.success) {
      console.warn("[x402] payment settlement failed", {
        promptId: prompt.id,
        payer: settlement.payer,
        transaction: settlement.transaction,
        reason: settlement.errorReason || "Payment settlement failed",
      });

      return paymentRequiredResponse({
        paymentRequired,
        body: {
          error: settlement.errorReason || "Payment settlement failed",
          transaction: settlement.transaction,
          payer: settlement.payer,
        },
      });
    }

    const { error: purchaseError } = await supabase.from("purchases").insert({
      prompt_id: prompt.id,
      buyer_wallet: settlement.payer || buyerWallet || "unknown",
      currency,
      amount_base_units: prompt.price_base_units,
      payment_tx: settlement.transaction || null,
    });
    if (purchaseError) {
      console.error("[x402] purchase record insert failed", {
        promptId: prompt.id,
        payer: settlement.payer,
        transaction: settlement.transaction,
        error: purchaseError.message,
      });
    }

    const response = NextResponse.json({
      content: prompt.paid_content,
      payment: {
        success: settlement.success,
        payer: settlement.payer,
        transaction: settlement.transaction,
        network: settlement.network,
      },
    });
    setX402ResponseHeaders(response);

    response.headers.set(
      X402_HEADERS.PAYMENT_RESPONSE,
      encodeX402Header({
        success: settlement.success,
        payer: settlement.payer,
        transaction: settlement.transaction,
        network: settlement.network,
      }),
    );

    return response;
  } catch (error) {
    console.error("[x402] unexpected route failure", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch content",
      },
      { status: 500 },
    );
  }
}
