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
  const { address, connected, connectWallet } = useStacksWallet();
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
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create prompt");
      }

      setSuccess("Prompt listed successfully.");
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
