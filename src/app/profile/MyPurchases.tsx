"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { Eye, Loader2, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  formatBaseUnits,
  type PromptMetadata,
  type Currency,
} from "@/lib/marketplace";
import { useStacksWallet } from "@/components/stacks-wallet-provider";

type Purchase = {
  id: string;
  prompt_id: string;
  buyer_wallet: string;
  currency: Currency;
  amount_base_units: string;
  payment_tx: string | null;
  purchased_at: string;
  prompt: PromptMetadata;
};

type MyPurchasesProps = {
  onViewContent?: (prompt: PromptMetadata) => void;
};

export default function MyPurchases({ onViewContent }: MyPurchasesProps) {
  const { address, connected, connectWallet } = useStacksWallet();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingContent, setViewingContent] = useState<{
    promptId: string;
    content: string | null;
    loading: boolean;
  } | null>(null);

  const loadPurchases = useMemo(
    () => async () => {
      if (!address) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/purchases?buyer_wallet=${encodeURIComponent(address)}`,
          {
            cache: "no-store",
          },
        );
        if (!response.ok) {
          throw new Error("Failed to load purchases");
        }
        const data = (await response.json()) as { purchases: Purchase[] };
        setPurchases(data.purchases || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load purchases",
        );
      } finally {
        setLoading(false);
      }
    },
    [address],
  );

  useEffect(() => {
    void loadPurchases();
  }, [loadPurchases]);

  const fetchContent = async (promptId: string) => {
    if (!address) return;

    setViewingContent({ promptId, content: null, loading: true });
    try {
      const response = await fetch(`/api/prompts/${promptId}/content`, {
        method: "GET",
        headers: {
          "x-buyer-wallet": address,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch content");
      }

      const data = (await response.json()) as { content: string };
      setViewingContent({ promptId, content: data.content, loading: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch content");
      setViewingContent(null);
    }
  };

  const closeContentModal = () => {
    setViewingContent(null);
  };

  if (!connected || !address) {
    return (
      <div className="text-center py-8 space-y-3">
        <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground" />
        <p className="text-muted-foreground">
          Connect your Stacks wallet to view your purchases.
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

  if (error && !purchases.length) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!purchases.length) {
    return (
      <div className="text-center py-12 space-y-3">
        <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground" />
        <p className="text-xl font-semibold">No purchases yet</p>
        <p className="text-muted-foreground">
          Browse the marketplace to discover and purchase prompts.
        </p>
        <Button onClick={() => (window.location.href = "/browse")}>
          Browse Prompts
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">My Purchases</h2>
          <Badge variant="secondary">{purchases.length} prompt(s)</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {purchases.map((purchase) => (
            <Card
              key={purchase.id}
              className="group relative overflow-hidden transition-all hover:shadow-lg"
            >
              <div className="aspect-video relative overflow-hidden">
                <Image
                  src={purchase.prompt.image_url || "/images/codeguru.png"}
                  alt={purchase.prompt.title}
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                />
                <Badge className="absolute top-2 right-2 z-10">
                  {purchase.prompt.category}
                </Badge>
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold">{purchase.prompt.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {purchase.prompt.description}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Purchased:{" "}
                    {new Date(purchase.purchased_at).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="p-4 pt-0 flex justify-between items-center">
                <span className="text-sm font-semibold">
                  {formatBaseUnits(
                    purchase.amount_base_units,
                    purchase.currency,
                  )}{" "}
                  {purchase.currency}
                </span>
                <Button
                  size="sm"
                  onClick={() => {
                    if (onViewContent) {
                      onViewContent(purchase.prompt);
                    } else {
                      void fetchContent(purchase.prompt.id);
                    }
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Content
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>

      {/* Content Modal */}
      {viewingContent && !onViewContent ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <h2 className="text-2xl font-bold">Prompt Content</h2>
                <button
                  onClick={closeContentModal}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <span className="sr-only">Close</span>✕
                </button>
              </div>

              {viewingContent.loading ? (
                <div className="flex justify-center items-center min-h-[200px]">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                </div>
              ) : viewingContent.content ? (
                <div className="rounded-md border p-4 whitespace-pre-wrap text-sm">
                  {viewingContent.content}
                </div>
              ) : (
                <p className="text-red-500">Failed to load content</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
