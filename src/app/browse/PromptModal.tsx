"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ShoppingCart, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { shortenAddress } from "@/lib/utils";
import { formatBaseUnits, type PromptMetadata } from "@/lib/marketplace";
import { useStacksWallet } from "@/components/stacks-wallet-provider";

type PaymentRequiredV2 = {
  x402Version: 2;
  resource?: {
    url?: string;
    description?: string;
    mimeType?: string;
  };
  accepts: Array<{
    scheme: string;
    network: string;
    amount: string;
    asset: string;
    payTo: string;
    maxTimeoutSeconds: number;
  }>;
};

type PromptModalProps = {
  selectedPrompt: PromptMetadata;
  closeModal: () => void;
};

function extractSignedTransaction(payload: unknown): string | null {
  const value = payload as Record<string, any>;
  if (!value) return null;
  return (
    value.transaction ||
    value.txHex ||
    value.tx ||
    value.signedTx ||
    value.signedTransaction ||
    value.result?.transaction ||
    value.result?.txHex ||
    null
  );
}

async function createWalletPaymentPayload(
  paymentRequired: PaymentRequiredV2,
  requestWallet: (
    method: string,
    params?: Record<string, unknown>,
  ) => Promise<unknown>,
) {
  const accepted = paymentRequired.accepts[0];
  if (!accepted) throw new Error("No acceptable payment option provided");

  const attempts: Array<{ method: string; params: Record<string, unknown> }> = [
    {
      method: "x402_signTransaction",
      params: {
        paymentRequirement: accepted,
        resource: paymentRequired.resource,
      },
    },
    {
      method: "stx_signTransaction",
      params: {
        paymentRequirement: accepted,
        resource: paymentRequired.resource,
      },
    },
    {
      method: "signTransaction",
      params: {
        paymentRequirement: accepted,
        resource: paymentRequired.resource,
      },
    },
  ];

  for (const attempt of attempts) {
    try {
      const response = await requestWallet(attempt.method, attempt.params);
      const transaction = extractSignedTransaction(response);
      if (transaction) {
        return {
          x402Version: 2 as const,
          resource: paymentRequired.resource,
          accepted,
          payload: { transaction },
        };
      }
    } catch {
      // Try next method.
    }
  }

  throw new Error(
    "Your wallet did not return a signed x402 transaction. Try a wallet/provider that supports x402 signing.",
  );
}

export function PromptModal({ selectedPrompt, closeModal }: PromptModalProps) {
  const { address, connected, connectWallet, requestWallet } = useStacksWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlockedContent, setUnlockedContent] = useState<string | null>(null);

  const displayPrice = useMemo(
    () =>
      `${formatBaseUnits(selectedPrompt.price_base_units, selectedPrompt.currency)} ${
        selectedPrompt.currency
      }`,
    [selectedPrompt.currency, selectedPrompt.price_base_units],
  );

  const fetchPaidContent = async () => {
    setLoading(true);
    setError(null);

    try {
      let walletAddress = address;
      if (!connected || !walletAddress) {
        walletAddress = await connectWallet();
      }

      if (!walletAddress) {
        throw new Error("Connect a Stacks wallet to continue.");
      }

      const firstAttempt = await fetch(
        `/api/prompts/${selectedPrompt.id}/content`,
        {
          method: "GET",
          headers: { "x-buyer-wallet": walletAddress },
        },
      );

      if (firstAttempt.ok) {
        const data = (await firstAttempt.json()) as { content: string };
        setUnlockedContent(data.content);
        return;
      }

      if (firstAttempt.status !== 402) {
        const message = await firstAttempt.text();
        throw new Error(message || "Failed to unlock prompt");
      }

      const header = firstAttempt.headers.get("payment-required");
      const body = (await firstAttempt.json()) as PaymentRequiredV2;
      let paymentRequired: PaymentRequiredV2 | null = body;

      if (header) {
        try {
          paymentRequired = JSON.parse(atob(header)) as PaymentRequiredV2;
        } catch {
          paymentRequired = body;
        }
      }

      if (!paymentRequired?.accepts?.length) {
        throw new Error("Invalid payment requirement payload");
      }

      const paymentPayload = await createWalletPaymentPayload(
        paymentRequired,
        requestWallet,
      );

      const secondAttempt = await fetch(
        `/api/prompts/${selectedPrompt.id}/content`,
        {
          method: "GET",
          headers: {
            "x-buyer-wallet": walletAddress,
            "payment-signature": btoa(JSON.stringify(paymentPayload)),
          },
        },
      );

      if (!secondAttempt.ok) {
        const message = await secondAttempt.text();
        throw new Error(message || "Payment not accepted");
      }

      const data = (await secondAttempt.json()) as { content: string };
      setUnlockedContent(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to unlock content");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-lg max-w-xl w-full max-h-[90vh] overflow-auto">
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-start">
            <h2 className="text-2xl font-bold">{selectedPrompt.title}</h2>
            <button
              onClick={closeModal}
              className="text-muted-foreground hover:text-foreground"
            >
              <span className="sr-only">Close</span>✕
            </button>
          </div>

          <div className="aspect-video rounded-lg overflow-hidden relative">
            <Image
              src={selectedPrompt.image_url || "/images/codeguru.png"}
              alt={selectedPrompt.title}
              fill
              className="object-cover"
            />
          </div>

          <div className="flex items-center justify-between">
            <Badge>{selectedPrompt.category}</Badge>
            <span className="text-sm text-muted-foreground">
              Seller: {shortenAddress(selectedPrompt.seller_wallet)}
            </span>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Description</h3>
            <p className="text-muted-foreground">{selectedPrompt.description}</p>
          </div>

          {unlockedContent ? (
            <div>
              <h3 className="text-lg font-semibold mb-2">Premium Content</h3>
              <div className="rounded-md border p-3 whitespace-pre-wrap text-sm">
                {unlockedContent}
              </div>
            </div>
          ) : null}

          <div className="flex justify-between items-center">
            <span className="text-2xl font-bold">{displayPrice}</span>
            <Button onClick={() => void fetchPaidContent()} disabled={loading}>
              {loading ? (
                <>
                  <Wallet className="mr-2 h-4 w-4 animate-pulse" />
                  Processing...
                </>
              ) : (
                <>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Unlock with x402
                </>
              )}
            </Button>
          </div>

          {error ? <p className="text-sm text-red-500">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
