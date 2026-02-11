"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Eye, Loader2 } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  formatBaseUnits,
  normalizeCurrency,
  parseDisplayAmountToBaseUnits,
  type PromptMetadata,
} from "@/lib/marketplace";
import { useStacksWallet } from "@/components/stacks-wallet-provider";
import CustomAlert from "./CustomAlerts";

type EditablePrompt = PromptMetadata & {
  price_display: string;
};

export default function MyPrompts() {
  const { address, connected, connectWallet } = useStacksWallet();
  const [prompts, setPrompts] = useState<PromptMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<EditablePrompt | null>(null);
  const [alert, setAlert] = useState<{
    isOpen: boolean;
    message: string;
    type: "success" | "error";
  }>({ isOpen: false, message: "", type: "success" });

  const showAlert = (message: string, type: "success" | "error") => {
    setAlert({ isOpen: true, message, type });
  };

  const loadPrompts = useMemo(
    () => async () => {
      if (!address) return;
      setLoading(true);
      try {
        const response = await fetch(
          `/api/prompts?seller_wallet=${encodeURIComponent(
            address,
          )}&include_unlisted=true`,
          {
            cache: "no-store",
          },
        );
        if (!response.ok) {
          throw new Error("Failed to load your prompts");
        }
        const data = (await response.json()) as { prompts: PromptMetadata[] };
        setPrompts(data.prompts || []);
      } catch (error) {
        showAlert(
          error instanceof Error ? error.message : "Failed to load prompts",
          "error",
        );
      } finally {
        setLoading(false);
      }
    },
    [address],
  );

  useEffect(() => {
    void loadPrompts();
  }, [loadPrompts]);

  const openEditor = (prompt: PromptMetadata) => {
    setSelected({
      ...prompt,
      price_display: formatBaseUnits(prompt.price_base_units, prompt.currency),
    });
  };

  const closeEditor = () => setSelected(null);

  const savePrompt = async () => {
    if (!selected || !address) return;

    try {
      const priceBaseUnits = parseDisplayAmountToBaseUnits(
        selected.price_display,
        selected.currency,
      );
      const response = await fetch(`/api/prompts/${selected.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": address,
        },
        body: JSON.stringify({
          title: selected.title,
          description: selected.description,
          category: selected.category,
          image_url: selected.image_url,
          is_listed: selected.is_listed,
          currency: normalizeCurrency(selected.currency),
          price_base_units: priceBaseUnits,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update listing");
      }
      showAlert("Listing updated successfully", "success");
      closeEditor();
      await loadPrompts();
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : "Failed to update listing",
        "error",
      );
    }
  };

  if (!connected || !address) {
    return (
      <div className="text-center py-8 space-y-3">
        <p className="text-muted-foreground">
          Connect your Stacks wallet to manage listings.
        </p>
        <Button onClick={() => void connectWallet()}>Connect Wallet</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[280px]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!prompts.length ? (
        <p className="text-muted-foreground">No prompts listed yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {prompts.map((prompt) => (
            <Card
              key={prompt.id}
              className="group relative overflow-hidden transition-all hover:shadow-lg"
            >
              <div className="aspect-video relative overflow-hidden">
                <Image
                  src={prompt.image_url || "/images/codeguru.png"}
                  alt={prompt.title}
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                />
                <Badge className="absolute top-2 right-2 z-10">
                  {prompt.category}
                </Badge>
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold">{prompt.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {prompt.description}
                </p>
                <Badge className="mt-2" variant={prompt.is_listed ? "default" : "secondary"}>
                  {prompt.is_listed ? "Listed" : "Unlisted"}
                </Badge>
              </CardContent>
              <CardFooter className="p-4 pt-0 flex justify-between items-center">
                <span className="text-lg font-bold">
                  {formatBaseUnits(prompt.price_base_units, prompt.currency)}{" "}
                  {prompt.currency}
                </span>
                <Button onClick={() => openEditor(prompt)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {selected ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-lg max-w-xl w-full max-h-[90vh] overflow-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Edit Listing</h2>
              <button onClick={closeEditor}>✕</button>
            </div>
            <InputField
              label="Title"
              value={selected.title}
              onChange={(value) =>
                setSelected((prev) => (prev ? { ...prev, title: value } : prev))
              }
            />
            <TextAreaField
              label="Description"
              value={selected.description}
              onChange={(value) =>
                setSelected((prev) =>
                  prev ? { ...prev, description: value } : prev,
                )
              }
            />
            <InputField
              label="Image URL"
              value={selected.image_url || ""}
              onChange={(value) =>
                setSelected((prev) =>
                  prev ? { ...prev, image_url: value || null } : prev,
                )
              }
            />
            <InputField
              label={`Price (${selected.currency})`}
              value={selected.price_display}
              onChange={(value) =>
                setSelected((prev) =>
                  prev ? { ...prev, price_display: value } : prev,
                )
              }
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.is_listed}
                onChange={(event) =>
                  setSelected((prev) =>
                    prev ? { ...prev, is_listed: event.target.checked } : prev,
                  )
                }
              />
              Listed for sale
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeEditor}>
                Cancel
              </Button>
              <Button onClick={() => void savePrompt()}>Save</Button>
            </div>
          </div>
        </div>
      ) : null}

      <CustomAlert
        message={alert.message}
        type={alert.type}
        isOpen={alert.isOpen}
        onClose={() => setAlert((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm">{label}</label>
      <input
        className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm">{label}</label>
      <textarea
        className="w-full rounded-md border bg-transparent px-3 py-2 text-sm min-h-[100px]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
