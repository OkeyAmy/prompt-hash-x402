"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { PromptCard } from "./PromptCard";
import { PromptModal } from "./PromptModal";
import type { PromptMetadata } from "@/lib/marketplace";

type FetchAllPromptsProps = {
  selectedCategory?: string;
  searchQuery?: string;
};

export default function FetchAllPrompts({
  selectedCategory = "all",
  searchQuery = "",
}: FetchAllPromptsProps) {
  const [prompts, setPrompts] = useState<PromptMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptMetadata | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    const loadPrompts = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/prompts", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load prompts");
        }
        const data = (await response.json()) as { prompts: PromptMetadata[] };
        if (!cancelled) {
          setPrompts(data.prompts || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unexpected error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPrompts();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPrompts = useMemo(() => {
    return prompts.filter((prompt) => {
      const categoryMatch =
        selectedCategory === "all" ||
        prompt.category.toLowerCase() === selectedCategory.toLowerCase();
      const searchTarget = `${prompt.title} ${prompt.description} ${prompt.category}`
        .toLowerCase()
        .trim();
      const searchMatch = !searchQuery.trim()
        ? true
        : searchTarget.includes(searchQuery.toLowerCase().trim());
      return categoryMatch && searchMatch;
    });
  }, [prompts, searchQuery, selectedCategory]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[320px]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  if (!filteredPrompts.length) {
    return <p className="text-muted-foreground">No prompts found.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPrompts.map((prompt, index) => (
          <PromptCard
            key={prompt.id}
            index={index}
            prompt={prompt}
            onOpen={() => setSelectedPrompt(prompt)}
          />
        ))}
      </div>
      {selectedPrompt ? (
        <PromptModal
          selectedPrompt={selectedPrompt}
          closeModal={() => setSelectedPrompt(null)}
        />
      ) : null}
    </>
  );
}
