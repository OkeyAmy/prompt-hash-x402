"use client";

import { useState, type ChangeEvent } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  normalizeCurrency,
  parseDisplayAmountToBaseUnits,
  type Currency,
} from "@/lib/marketplace";
import { useStacksWallet } from "@/components/stacks-wallet-provider";
import { LISTING_FEE_MICRO_STX, extractTransactionHash } from "@/lib/stacks";

type FormData = {
  imageUrl: string;
  title: string;
  description: string;
  paidContent: string;
  category: string;
  price: string;
  currency: Currency;
};

const initialData: FormData = {
  imageUrl: "",
  title: "",
  description: "",
  paidContent: "",
  category: "",
  price: "0.1",
  currency: "STX",
};

export function CreatePromptForm() {
  const { address, connected, connectWallet, requestWallet } = useStacksWallet();
  const [formData, setFormData] = useState<FormData>(initialData);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onInput = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const submit = async () => {
    setError(null);
    setSuccess(null);

    let walletAddress = address;
    if (!connected || !walletAddress) {
      walletAddress = await connectWallet();
    }

    if (!walletAddress) {
      setError("Connect a Stacks wallet to list a prompt.");
      return;
    }

    try {
      if (!formData.title.trim() || !formData.description.trim()) {
        throw new Error("Title and description are required.");
      }
      if (!formData.paidContent.trim()) {
        throw new Error("Paid content is required.");
      }
      if (!formData.category.trim()) {
        throw new Error("Category is required.");
      }

      const baseUnits = parseDisplayAmountToBaseUnits(
        formData.price,
        formData.currency,
      );

      setSubmitting(true);

      let listingFeeTx: string | null = null;

      // Check if listing fee is enabled
      const enableListingFee = process.env.NEXT_PUBLIC_ENABLE_LISTING_FEE === "true";
      if (enableListingFee) {
        const platformWallet = process.env.NEXT_PUBLIC_PLATFORM_WALLET;
        if (!platformWallet) {
          throw new Error("Platform wallet not configured");
        }

        // Request listing fee payment (0.001 STX = 1000 microSTX)
        try {
          const { openSTXTransfer } = await import("@stacks/connect");
          
          const feePaymentResponse = await new Promise((resolve, reject) => {
            openSTXTransfer({
              recipient: platformWallet,
              amount: "1000", // microSTX
              memo: `Listing: ${formData.title.slice(0, 30)}`,
              network: process.env.NEXT_PUBLIC_STACKS_NETWORK === "mainnet" ? "mainnet" : "testnet",
              onFinish: (data) => resolve(data),
              onCancel: () => reject(new Error("Listing fee payment cancelled")),
            });
          });

          listingFeeTx = extractTransactionHash(feePaymentResponse);
          if (!listingFeeTx) {
            throw new Error("Failed to get listing fee transaction hash");
          }
        } catch (feeError) {
          throw new Error(
            `Listing fee payment failed: ${feeError instanceof Error ? feeError.message : "Unknown error"}`,
          );
        }
      }

      const response = await fetch("/api/prompts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": walletAddress,
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          paid_content: formData.paidContent,
          category: formData.category,
          image_url: formData.imageUrl || null,
          price_base_units: baseUnits,
          currency: normalizeCurrency(formData.currency),
          seller_wallet: walletAddress,
          is_listed: true,
          listing_fee_tx: listingFeeTx,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create prompt");
      }

      setSuccess(
        enableListingFee
          ? "Listing fee paid! Prompt listed successfully."
          : "Prompt listed successfully.",
      );
      setFormData(initialData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create prompt");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">Image URL</label>
          <Input
            placeholder="https://..."
            name="imageUrl"
            value={formData.imageUrl}
            onChange={onInput}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Title</label>
          <Input
            placeholder="Prompt title"
            name="title"
            value={formData.title}
            onChange={onInput}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <Textarea
          name="description"
          value={formData.description}
          onChange={onInput}
          rows={3}
          placeholder="Public metadata shown before purchase"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Paid Content</label>
        <Textarea
          name="paidContent"
          value={formData.paidContent}
          onChange={onInput}
          rows={6}
          placeholder="Premium content unlocked after x402 payment"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">Category</label>
          <Select
            value={formData.category}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, category: value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Marketing">Marketing</SelectItem>
              <SelectItem value="Creative Writing">Creative Writing</SelectItem>
              <SelectItem value="Programming">Programming</SelectItem>
              <SelectItem value="Business">Business</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Price</label>
          <Input
            type="number"
            step={formData.currency === "SBTC" ? "0.00000001" : "0.000001"}
            min="0"
            name="price"
            value={formData.price}
            onChange={onInput}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Currency</label>
          <Select
            value={formData.currency}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                currency: normalizeCurrency(value),
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STX">STX</SelectItem>
              <SelectItem value="SBTC">sBTC</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button className="w-full" disabled={submitting} onClick={() => void submit()}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Listing...
          </>
        ) : (
          "List Prompt"
        )}
      </Button>

      {error ? (
        <p className="text-sm text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      ) : null}
      {success ? <p className="text-sm text-green-500">{success}</p> : null}
    </div>
  );
}
