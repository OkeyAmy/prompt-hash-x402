"use client";

import { useState } from "react";
import { Filter } from "lucide-react";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FetchAllPrompts from "./FetchAllPrompts";

export default function BrowsePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  return (
    <div className="min-h-screen bg-gray-950 bg-gradient-to-r from-purple-400 to-blue-500 flex flex-col">
      <Navigation />
      <main className="flex-1 container py-8">
        <div className="flex flex-col md:flex-row gap-8">
          <aside className="w-full md:w-64 space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </h2>
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Creative Writing">Creative Writing</SelectItem>
                  <SelectItem value="Programming">Programming</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Business">Business</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </aside>

          <section className="flex-1 space-y-6">
            <Input
              placeholder="Search prompts..."
              className="max-w-md"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <FetchAllPrompts
              selectedCategory={selectedCategory}
              searchQuery={searchQuery}
            />
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
