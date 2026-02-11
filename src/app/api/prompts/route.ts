import { NextRequest, NextResponse } from "next/server";
import {
  normalizeCurrency,
  PROMPT_METADATA_SELECT,
  type Currency,
} from "@/lib/marketplace";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type CreatePromptPayload = {
  title?: string;
  description?: string;
  paid_content?: string;
  category?: string;
  image_url?: string | null;
  price_base_units?: string;
  currency?: string;
  seller_wallet?: string;
  is_listed?: boolean;
};

function sanitizeWallet(value: string | null | undefined): string {
  return (value || "").trim();
}

function parseCurrency(value: string | undefined): Currency {
  return normalizeCurrency(value);
}

function validateBaseUnits(value: string | undefined) {
  if (!value || !/^\d+$/.test(value) || value === "0") {
    throw new Error("price_base_units must be a positive integer string");
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();
    const searchParams = request.nextUrl.searchParams;
    const sellerWallet = sanitizeWallet(searchParams.get("seller_wallet"));
    const includeUnlisted = searchParams.get("include_unlisted") === "true";

    let query = supabase
      .from("prompts")
      .select(PROMPT_METADATA_SELECT)
      .order("created_at", { ascending: false });

    if (sellerWallet) {
      query = query.eq("seller_wallet", sellerWallet);
      if (!includeUnlisted) {
        query = query.eq("is_listed", true);
      }
    } else {
      query = query.eq("is_listed", true);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return NextResponse.json({ prompts: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch prompts" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as CreatePromptPayload;

    const walletFromHeader = sanitizeWallet(
      request.headers.get("x-wallet-address"),
    );
    const sellerWallet = sanitizeWallet(payload.seller_wallet);
    if (!walletFromHeader || !sellerWallet) {
      return NextResponse.json(
        { error: "Missing seller wallet context" },
        { status: 401 },
      );
    }

    if (walletFromHeader.toLowerCase() !== sellerWallet.toLowerCase()) {
      return NextResponse.json(
        { error: "Connected wallet does not match seller wallet" },
        { status: 403 },
      );
    }

    if (!payload.title?.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!payload.description?.trim()) {
      return NextResponse.json(
        { error: "description is required" },
        { status: 400 },
      );
    }
    if (!payload.paid_content?.trim()) {
      return NextResponse.json(
        { error: "paid_content is required" },
        { status: 400 },
      );
    }
    if (!payload.category?.trim()) {
      return NextResponse.json(
        { error: "category is required" },
        { status: 400 },
      );
    }
    validateBaseUnits(payload.price_base_units);

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("prompts")
      .insert({
        title: payload.title.trim(),
        description: payload.description.trim(),
        paid_content: payload.paid_content.trim(),
        category: payload.category.trim(),
        image_url: payload.image_url?.trim() || null,
        price_base_units: payload.price_base_units!,
        currency: parseCurrency(payload.currency),
        seller_wallet: sellerWallet,
        is_listed: payload.is_listed ?? true,
      })
      .select(PROMPT_METADATA_SELECT)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ prompt: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create prompt" },
      { status: 500 },
    );
  }
}
