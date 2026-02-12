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

    // Allow seller to read without paying.
    if (
      buyerWallet &&
      buyerWallet.toLowerCase() === prompt.seller_wallet.toLowerCase()
    ) {
      return NextResponse.json({
        content: prompt.paid_content,
        payment: { bypass: "seller" },
      });
    }

    if (!prompt.is_listed) {
      return NextResponse.json(
        { error: "Prompt is not listed for sale" },
        { status: 404 },
      );
    }

    if (buyerWallet) {
      const { data: existingPurchase } = await supabase
        .from("purchases")
        .select("id")
        .eq("prompt_id", prompt.id)
        .eq("buyer_wallet", buyerWallet)
        .limit(1)
        .maybeSingle();

      if (existingPurchase) {
        return NextResponse.json({
          content: prompt.paid_content,
          payment: { bypass: "existing_purchase" },
        });
      }
    }

    const paymentRequired = buildPaymentRequiredResponse({
      resourceUrl: request.url,
      description: `Unlock premium content for "${prompt.title}"`,
      amountBaseUnits: prompt.price_base_units,
      currency: normalizeCurrency(prompt.currency),
      payTo: prompt.seller_wallet,
    });

    const paymentSignatureHeader = request.headers.get(
      X402_HEADERS.PAYMENT_SIGNATURE,
    );
    if (!paymentSignatureHeader) {
      const response = NextResponse.json(paymentRequired, { status: 402 });
      response.headers.set(
        X402_HEADERS.PAYMENT_REQUIRED,
        encodeX402Header(paymentRequired),
      );
      return response;
    }

    const paymentPayload = decodePaymentSignatureHeader(paymentSignatureHeader);
    if (!paymentPayload) {
      return NextResponse.json(
        { error: "Invalid payment-signature header" },
        { status: 400 },
      );
    }

    const paymentRequirements = buildPaymentRequirements({
      amountBaseUnits: prompt.price_base_units,
      currency: normalizeCurrency(prompt.currency),
      payTo: prompt.seller_wallet,
    });

    const settlement = await settlePayment(paymentPayload, paymentRequirements);
    if (!settlement.success) {
      const response = NextResponse.json(
        {
          error: settlement.errorReason || "Payment settlement failed",
          transaction: settlement.transaction,
          payer: settlement.payer,
        },
        { status: 402 },
      );
      response.headers.set(
        X402_HEADERS.PAYMENT_REQUIRED,
        encodeX402Header(paymentRequired),
      );
      return response;
    }

    await supabase.from("purchases").insert({
      prompt_id: prompt.id,
      buyer_wallet: settlement.payer || buyerWallet || "unknown",
      currency: normalizeCurrency(prompt.currency),
      amount_base_units: prompt.price_base_units,
      payment_tx: settlement.transaction || null,
    });

    const response = NextResponse.json({
      content: prompt.paid_content,
      payment: {
        success: settlement.success,
        payer: settlement.payer,
        transaction: settlement.transaction,
        network: settlement.network,
      },
    });

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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch content",
      },
      { status: 500 },
    );
  }
}
