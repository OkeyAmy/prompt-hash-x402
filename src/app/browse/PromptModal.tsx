"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ShoppingCart, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { shortenAddress } from "@/lib/utils";
import { formatBaseUnits, type PromptMetadata } from "@/lib/marketplace";
import { useStacksWallet } from "@/components/stacks-wallet-provider";
import { X402PaymentVerifier, getNetworkInstance } from "x402-stacks";
import {
  makeUnsignedSTXTokenTransfer,
  AnchorMode,
} from "@stacks/transactions";
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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
    maxTimeoutSeconds?: number;
  }>;
};

type PromptModalProps = {
  selectedPrompt: PromptMetadata;
  closeModal: () => void;
};

function extractSignedTransaction(payload: unknown): string | null {
  const value = payload as Record<string, unknown>;
  if (!value) return null;
  const tx =
    value.transaction ??
    (value as { result?: { transaction?: string } }).result?.transaction;
  if (typeof tx === "string" && tx.length > 0) {
    return tx.replace(/^0x/i, "");
  }
  return null;
}

async function getPublicKeyForAddress(
  requestWallet: (method: string, params?: Record<string, unknown>) => Promise<unknown>,
  walletAddress: string,
  network: string,
): Promise<string | null> {
  for (const method of ["stx_getAccounts", "getAddresses", "stx_getAddresses"]) {
    try {
      const result = (await requestWallet(method, { network })) as
        | { accounts?: Array<{ address: string; publicKey?: string }> }
        | { addresses?: Array<{ address: string; publicKey?: string }> };
      const entries =
        (result as { accounts?: Array<{ address: string; publicKey?: string }> }).accounts ??
        (result as { addresses?: Array<{ address: string; publicKey?: string }> }).addresses ??
        [];
      const match = entries.find(
        (e) =>
          e.address?.toLowerCase() === walletAddress.toLowerCase() &&
          typeof e.publicKey === "string",
      );
      if (match?.publicKey) return match.publicKey;
    } catch {
      // Try next method
    }
  }
  return null;
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

  const network =
    process.env.NEXT_PUBLIC_STACKS_NETWORK === "mainnet" ? "mainnet" : "testnet";
  const networkInstance = getNetworkInstance(network);

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

      const contentUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/prompts/${selectedPrompt.id}/content`;
      const firstAttempt = await fetch(contentUrl, {
        method: "GET",
        headers: { "x-buyer-wallet": walletAddress },
      });

      if (firstAttempt.ok) {
        const data = (await firstAttempt.json()) as { content: string };
        setUnlockedContent(data.content);
        return;
      }

      if (firstAttempt.status !== 402) {
        const errData = await firstAttempt.json().catch(() => ({}));
        throw new Error(
          (errData as { error?: string }).error ||
            "Failed to unlock prompt",
        );
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

      const accepted = paymentRequired.accepts[0];
      if (!accepted) {
        throw new Error("No acceptable payment option");
      }

      // Only STX transfers supported for now
      if (accepted.asset !== "STX") {
        throw new Error(
          `Payments in ${accepted.asset} are not yet supported in this flow.`,
        );
      }

      const publicKey = await getPublicKeyForAddress(
        requestWallet,
        walletAddress,
        network,
      );
      if (!publicKey) {
        throw new Error(
          "Could not get public key from wallet. Your wallet may not support x402 signing.",
        );
      }

      const amount = BigInt(accepted.amount);
      const memo = `x402:${Date.now().toString(36)}`.substring(0, 34);

      const unsignedTx = await makeUnsignedSTXTokenTransfer({
        recipient: accepted.payTo,
        amount,
        publicKey,
        network: networkInstance,
        memo,
        anchorMode: AnchorMode.Any,
      });

      const txHex = bytesToHex(unsignedTx.serialize());

      const signResult = await requestWallet("stx_signTransaction", {
        transaction: txHex,
        broadcast: false,
      });

      const signedTxHex = extractSignedTransaction(signResult);
      if (!signedTxHex) {
        throw new Error(
          "Wallet did not return a signed transaction. Please try again.",
        );
      }

      const paymentPayload = X402PaymentVerifier.createPaymentPayload(
        signedTxHex,
        {
          scheme: accepted.scheme,
          network: accepted.network as `stacks:${string}`,
          amount: accepted.amount,
          asset: accepted.asset,
          payTo: accepted.payTo,
          maxTimeoutSeconds: accepted.maxTimeoutSeconds ?? 300,
        },
      );

      const encodedPayload = Buffer.from(
        JSON.stringify(paymentPayload),
      ).toString("base64");

      const secondAttempt = await fetch(contentUrl, {
        method: "GET",
        headers: {
          "x-buyer-wallet": walletAddress,
          "payment-signature": encodedPayload,
        },
      });

      if (!secondAttempt.ok) {
        const errData = await secondAttempt.json().catch(() => ({}));
        throw new Error(
          (errData as { error?: string }).error || "Payment not accepted",
        );
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
