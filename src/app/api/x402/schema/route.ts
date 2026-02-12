import { NextResponse } from "next/server";
import { getStacksNetworkForRegistration } from "@/lib/x402";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { PROMPT_METADATA_SELECT } from "@/lib/marketplace";

/**
 * x402scan registration endpoint
 * This endpoint provides machine-readable documentation for AI agents
 * to discover and use the PromptHash marketplace programmatically.
 *
 * Register at: https://scan.stacksx402.com
 *
 * IMPORTANT: x402scan "Try Request" uses the resource URL literally.
 * We dynamically fetch prompts from the database and create one resource
 * per prompt with CONCRETE URLs (no {id} placeholder) so Try Request works.
 */
const DEFAULT_OUTPUT_SCHEMA = {
  input: {
    type: "request" as const,
    method: "GET" as const,
    headers: {
      "x-buyer-wallet": {
        type: "string",
        description:
          "Buyer's Stacks wallet address (optional - enables free access for prior purchases)",
        required: false,
        example: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      },
      "payment-signature": {
        type: "string",
        format: "base64",
        description:
          "Base64-encoded signed x402 payment transaction (automatically added by x402 client libraries)",
        required: true,
      },
    },
  },
  output: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "The actual prompt text content unlocked after payment",
      },
      payment: {
        type: "object",
        description: "Payment confirmation details",
        properties: {
          success: { type: "boolean", description: "Whether payment was successful" },
          transaction: {
            type: "string",
            description: "Stacks blockchain transaction hash (0x-prefixed)",
            example: "0xabcdef1234567890...",
          },
          payer: {
            type: "string",
            description: "Buyer's Stacks wallet address",
            example: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
          },
          network: {
            type: "string",
            description: "CAIP-2 network identifier",
            example: "stacks:2147483648",
          },
          bypass: {
            type: "string",
            description: "Reason for bypassing payment (if applicable)",
            enum: ["seller", "existing_purchase"],
          },
        },
      },
    },
    required: ["content", "payment"],
  },
};

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const network = getStacksNetworkForRegistration(); // x402scan requires "stacks" not CAIP-2

  let accepts: Array<{
    scheme: "exact";
    network: string;
    maxAmountRequired: string;
    resource: string;
    description: string;
    mimeType: string;
    payTo: string;
    maxTimeoutSeconds: number;
    asset: string;
    outputSchema: typeof DEFAULT_OUTPUT_SCHEMA;
  }> = [];

  try {
    const supabase = getSupabaseServiceClient();
    const { data: prompts, error } = await supabase
      .from("prompts")
      .select(PROMPT_METADATA_SELECT)
      .eq("is_listed", true)
      .order("created_at", { ascending: false });

    if (!error && prompts && prompts.length > 0) {
      accepts = prompts.map((prompt) => ({
        scheme: "exact" as const,
        network,
        maxAmountRequired: String(prompt.price_base_units),
        resource: `${appUrl}/api/prompts/${prompt.id}/content`,
        description: `Purchase "${prompt.title}" - ${prompt.description?.slice(0, 80) ?? "Premium prompt content"}...`,
        mimeType: "application/json",
        payTo: prompt.seller_wallet,
        maxTimeoutSeconds: 300,
        asset: prompt.currency === "SBTC" ? "sBTC" : "STX",
        outputSchema: DEFAULT_OUTPUT_SCHEMA,
      }));
    }
  } catch {
    // Fall through to fallback
  }

  if (accepts.length === 0) {
    accepts = [
      {
        scheme: "exact" as const,
        network,
        maxAmountRequired: "100000",
        resource: `${appUrl}/api/prompts/7de680e1-6cea-4967-903b-7b28c3387885/content`,
        description:
          "Purchase prompt content. Browse GET /api/prompts for all available prompts. First-time purchase required; subsequent access is free.",
        mimeType: "application/json",
        payTo: "ST16K4ZYM14WPG9GZQ5BPXNQAEVTJPRMA4VWJCXYY",
        maxTimeoutSeconds: 300,
        asset: "STX",
        outputSchema: DEFAULT_OUTPUT_SCHEMA,
      },
    ];
  }

  const schema = {
    x402Version: 2,
    name: "PromptHash - AI-Native Prompt Marketplace",
    image: `${appUrl}/images/logo.png`,
    description:
      "Discover and purchase high-quality prompts for AI models. Pay per prompt in STX via x402 payment protocol. Browse prompts, purchase content, and access premium AI prompt templates.",
    accepts: [
      {
        scheme: "exact",
        network,
        resource: `${appUrl}/api/prompts/{id}/content`,
        description:
          "Purchase and access prompt content. Price varies per prompt (typically 0.0001-10 STX). First-time purchase required; subsequent access is free for buyers and sellers.",
        mimeType: "application/json",
        asset: "STX",
        maxTimeoutSeconds: 300,
        outputSchema: {
          input: {
            type: "request",
            method: "GET",
            pathParams: {
              id: {
                type: "string",
                format: "uuid",
                description:
                  "Prompt UUID obtained from GET /api/prompts (browse endpoint)",
                required: true,
                example: "550e8400-e29b-41d4-a716-446655440000",
              },
            },
            headers: {
              "x-buyer-wallet": {
                type: "string",
                description:
                  "Buyer's Stacks wallet address (optional metadata for purchase attribution)",
                required: false,
                example: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
              },
              "x-prompthash-bypass": {
                type: "string",
                description:
                  "Optional first-party bypass hint. Use value 'allow' only in PromptHash UI flows for seller or prior-purchase fast-paths.",
                required: false,
                example: "allow",
              },
              "payment-signature": {
                type: "string",
                format: "base64",
                description:
                  "Base64-encoded signed x402 payment transaction (include after receiving HTTP 402 challenge)",
                required: false,
              },
            },
          },
          output: {
            type: "object",
            properties: {
              content: {
                type: "string",
                description:
                  "The actual prompt text content unlocked after payment",
              },
              payment: {
                type: "object",
                description: "Payment confirmation details",
                properties: {
                  success: {
                    type: "boolean",
                    description: "Whether payment was successful",
                  },
                  transaction: {
                    type: "string",
                    description:
                      "Stacks blockchain transaction hash (0x-prefixed)",
                    example: "0xabcdef1234567890...",
                  },
                  payer: {
                    type: "string",
                    description: "Buyer's Stacks wallet address",
                    example: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
                  },
                  network: {
                    type: "string",
                    description: "CAIP-2 network identifier",
                    example: "stacks:2147483648",
                  },
                  bypass: {
                    type: "string",
                    description:
                      "Reason for bypassing payment (if applicable)",
                    enum: ["seller", "existing_purchase"],
                  },
                },
              },
            },
            required: ["content", "payment"],
          },
        },
      },
    ],
    additionalEndpoints: [
      {
        path: "/api/prompts",
        method: "GET",
        description: "Browse all listed prompts (no payment required)",
        authentication: "none",
        returns: {
          type: "array",
          items: {
            id: "string (uuid)",
            title: "string",
            description: "string",
            category: "string",
            image_url: "string | null",
            price_base_units: "string",
            currency: "STX | SBTC",
            seller_wallet: "string",
            is_listed: "boolean",
          },
        },
      },
      {
        path: "/api/purchases",
        method: "GET",
        description: "View your purchased prompts",
        authentication: "wallet",
        parameters: {
          buyer_wallet: "string (Stacks address)",
        },
        returns: {
          type: "array",
          items: {
            id: "string (uuid)",
            prompt_id: "string (uuid)",
            buyer_wallet: "string",
            currency: "STX | SBTC",
            amount_base_units: "string",
            payment_tx: "string | null",
            purchased_at: "string (ISO 8601)",
            prompt: "PromptMetadata",
          },
        },
      },
    ],
  };

  return NextResponse.json(schema, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60", // 1 min - schema is dynamic (fetches prompts from DB)
    },
  });
}
