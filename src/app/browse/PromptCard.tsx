import Image from "next/image";
import { ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { shortenAddress } from "@/lib/utils";
import { formatBaseUnits, type PromptMetadata } from "@/lib/marketplace";

type PromptCardProps = {
  prompt: PromptMetadata;
  index: number;
  onOpen: () => void;
};

export function PromptCard({ prompt, index, onOpen }: PromptCardProps) {
  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-lg">
      <div className="aspect-video relative overflow-hidden">
        <Image
          src={prompt.image_url || "/images/codeguru.png"}
          alt={prompt.title || `Prompt ${index + 1}`}
          fill
          className="object-cover transition-transform group-hover:scale-105"
        />
        <Badge className="absolute top-2 right-2 z-10">{prompt.category}</Badge>
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold">{prompt.title}</h3>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
          {prompt.description}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Seller: {shortenAddress(prompt.seller_wallet)}
        </p>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex justify-between items-center">
        <span className="text-lg font-bold">
          {formatBaseUnits(prompt.price_base_units, prompt.currency)}{" "}
          {prompt.currency}
        </span>
        <Button onClick={onOpen}>
          <ShoppingCart className="mr-2 h-4 w-4" />
          Buy
        </Button>
      </CardFooter>
    </Card>
  );
}
