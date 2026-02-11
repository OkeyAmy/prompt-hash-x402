import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { PROMPT_METADATA_SELECT } from "@/lib/marketplace";

function sanitizeWallet(value: string | null | undefined): string {
  return (value || "").trim();
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const buyerWallet = sanitizeWallet(searchParams.get("buyer_wallet"));

    if (!buyerWallet) {
      return NextResponse.json(
        { error: "buyer_wallet parameter is required" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServiceClient();

    // Query purchases joined with prompts to get full prompt metadata
    const { data, error } = await supabase
      .from("purchases")
      .select(
        `
        id,
        prompt_id,
        buyer_wallet,
        currency,
        amount_base_units,
        payment_tx,
        created_at,
        prompts (${PROMPT_METADATA_SELECT})
      `,
      )
      .eq("buyer_wallet", buyerWallet)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    // Transform the data to flatten the prompt metadata
    const purchases = (data ?? []).map((purchase) => ({
      id: purchase.id,
      prompt_id: purchase.prompt_id,
      buyer_wallet: purchase.buyer_wallet,
      currency: purchase.currency,
      amount_base_units: purchase.amount_base_units,
      payment_tx: purchase.payment_tx,
      purchased_at: purchase.created_at,
      prompt: purchase.prompts,
    }));

    return NextResponse.json({ purchases });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch purchases",
      },
      { status: 500 },
    );
  }
}
