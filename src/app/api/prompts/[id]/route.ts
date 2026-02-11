import { NextRequest, NextResponse } from "next/server";
import {
  normalizeCurrency,
  PROMPT_METADATA_SELECT,
  type Currency,
} from "@/lib/marketplace";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type UpdatePromptPayload = Partial<{
  title: string;
  description: string;
  paid_content: string;
  category: string;
  image_url: string | null;
  price_base_units: string;
  currency: Currency | string;
  is_listed: boolean;
}>;

function sanitizeWallet(value: string | null | undefined) {
  return (value || "").trim();
}

function normalizeUpdate(payload: UpdatePromptPayload) {
  const update: Record<string, unknown> = {};

  if (typeof payload.title === "string") {
    if (!payload.title.trim()) throw new Error("title cannot be empty");
    update.title = payload.title.trim();
  }
  if (typeof payload.description === "string") {
    if (!payload.description.trim()) throw new Error("description cannot be empty");
    update.description = payload.description.trim();
  }
  if (typeof payload.paid_content === "string") {
    if (!payload.paid_content.trim()) {
      throw new Error("paid_content cannot be empty");
    }
    update.paid_content = payload.paid_content.trim();
  }
  if (typeof payload.category === "string") {
    if (!payload.category.trim()) throw new Error("category cannot be empty");
    update.category = payload.category.trim();
  }
  if (typeof payload.image_url === "string") {
    update.image_url = payload.image_url.trim() || null;
  } else if (payload.image_url === null) {
    update.image_url = null;
  }
  if (typeof payload.price_base_units === "string") {
    if (!/^\d+$/.test(payload.price_base_units) || payload.price_base_units === "0") {
      throw new Error("price_base_units must be a positive integer string");
    }
    update.price_base_units = payload.price_base_units;
  }
  if (payload.currency) {
    update.currency = normalizeCurrency(payload.currency);
  }
  if (typeof payload.is_listed === "boolean") {
    update.is_listed = payload.is_listed;
  }

  return update;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const wallet = sanitizeWallet(request.headers.get("x-wallet-address"));
    if (!wallet) {
      return NextResponse.json(
        { error: "Missing connected wallet context" },
        { status: 401 },
      );
    }

    const supabase = getSupabaseServiceClient();

    const { data: existing, error: existingError } = await supabase
      .from("prompts")
      .select("id,seller_wallet")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
    }

    if (existing.seller_wallet.toLowerCase() !== wallet.toLowerCase()) {
      return NextResponse.json(
        { error: "Only the seller can update this listing" },
        { status: 403 },
      );
    }

    const payload = (await request.json()) as UpdatePromptPayload;
    const update = normalizeUpdate(payload);
    if (!Object.keys(update).length) {
      return NextResponse.json(
        { error: "No valid fields provided for update" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("prompts")
      .update(update)
      .eq("id", id)
      .eq("seller_wallet", existing.seller_wallet)
      .select(PROMPT_METADATA_SELECT)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ prompt: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update prompt" },
      { status: 500 },
    );
  }
}
