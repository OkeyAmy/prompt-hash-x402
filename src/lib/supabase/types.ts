import type { Currency } from "@/lib/marketplace";

export type Database = {
  public: {
    Tables: {
      prompts: {
        Row: {
          id: string;
          title: string;
          description: string;
          paid_content: string;
          category: string;
          image_url: string | null;
          price_base_units: string;
          currency: Currency;
          seller_wallet: string;
          is_listed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          paid_content: string;
          category: string;
          image_url?: string | null;
          price_base_units: string;
          currency: Currency;
          seller_wallet: string;
          is_listed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          title: string;
          description: string;
          paid_content: string;
          category: string;
          image_url: string | null;
          price_base_units: string;
          currency: Currency;
          seller_wallet: string;
          is_listed: boolean;
          updated_at: string;
        }>;
        Relationships: [];
      };
      purchases: {
        Row: {
          id: string;
          prompt_id: string;
          buyer_wallet: string;
          currency: Currency;
          amount_base_units: string;
          payment_tx: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          prompt_id: string;
          buyer_wallet: string;
          currency: Currency;
          amount_base_units: string;
          payment_tx?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          buyer_wallet: string;
          currency: Currency;
          amount_base_units: string;
          payment_tx: string | null;
        }>;
        Relationships: [
          {
            foreignKeyName: "purchases_prompt_id_fkey";
            columns: ["prompt_id"];
            isOneToOne: false;
            referencedRelation: "prompts";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
