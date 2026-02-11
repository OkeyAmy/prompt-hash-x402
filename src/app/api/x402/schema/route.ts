import { NextResponse } from "next/server";
import { getStacksNetworkCAIP2 } from "@/lib/x402";

/**
 * x402scan registration endpoint
 * This endpoint provides machine-readable documentation for AI agents
 * to discover and use the PromptHash marketplace programmatically.
 * 
 * Register at: https://scan.stacksx402.com
 */
export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const network = getStacksNetworkCAIP2();

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
      "Cache-Control": "public, max-age=3600", // Cache for 1 hour
    },
  });
}
