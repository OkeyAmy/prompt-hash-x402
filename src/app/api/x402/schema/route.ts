import { NextResponse } from "next/server";
import { getStacksNetworkForRegistration } from "@/lib/x402";

/**
 * x402scan registration endpoint
 * This endpoint provides machine-readable documentation for AI agents
 * to discover and use the PromptHash marketplace programmatically.
 * 
 * Register at: https://scan.stacksx402.com
 * 
 * IMPORTANT: 
 * - The {id} placeholder in resource URLs must be replaced with actual UUIDs
 * - Browse /api/prompts first to get valid prompt IDs
 * - Example working ID: 7de680e1-6cea-4967-903b-7b28c3387885
 */
export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const network = getStacksNetworkForRegistration(); // x402scan requires "stacks" not CAIP-2

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
        workflow: {
          step1: "Browse available prompts: GET /api/prompts",
          step2: "Select a prompt and note its 'id' field",
          step3: "Purchase content: GET /api/prompts/{id}/content (replace {id} with actual UUID)",
          step4: "Wallet will prompt for payment in STX",
          step5: "After payment, content is unlocked and accessible anytime"
        },
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
                example: "7de680e1-6cea-4967-903b-7b28c3387885",
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
        examples: {
          browse: {
            request: `GET ${appUrl}/api/prompts`,
            description: "Get list of all available prompts",
            response_sample: {
              prompts: [
                {
                  id: "7de680e1-6cea-4967-903b-7b28c3387885",
                  title: "Example Prompt",
                  price_base_units: "100000",
                  currency: "STX"
                }
              ]
            }
          },
          purchase: {
            request: `GET ${appUrl}/api/prompts/7de680e1-6cea-4967-903b-7b28c3387885/content`,
            headers: {
              "payment-signature": "Base64-encoded signed transaction (added automatically by x402 client)"
            },
            description: "Purchase and unlock prompt content"
          }
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
