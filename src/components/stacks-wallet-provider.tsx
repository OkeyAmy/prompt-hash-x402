"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { connect, disconnect, isConnected, request } from "@stacks/connect";

type StacksWalletContextValue = {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  requestWallet: (
    method: string,
    params?: Record<string, unknown>,
  ) => Promise<unknown>;
  refreshWallet: () => Promise<void>;
};

const StacksWalletContext = createContext<StacksWalletContextValue | null>(null);

const providers = (
  process.env.NEXT_PUBLIC_STACKS_WALLET_PROVIDERS || "LeatherProvider,xverse"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const network =
  process.env.NEXT_PUBLIC_STACKS_NETWORK === "mainnet" ? "mainnet" : "testnet";

const connectAny = connect as unknown as (
  options?: Record<string, unknown>,
) => Promise<unknown>;
const requestAny = request as unknown as (
  methodOrConfig: unknown,
  params?: Record<string, unknown>,
) => Promise<unknown>;

function extractWalletAddress(payload: unknown): string | null {
  const value = payload as Record<string, any>;
  if (!value) return null;

  if (typeof value.address === "string") return value.address;
  if (typeof value.result?.address === "string") return value.result.address;
  if (typeof value.addresses?.stx?.[0]?.address === "string") {
    return value.addresses.stx[0].address;
  }
  if (typeof value.result?.addresses?.stx?.[0]?.address === "string") {
    return value.result.addresses.stx[0].address;
  }

  return null;
}

async function walletRequest(
  method: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  try {
    return await requestAny(method, params);
  } catch {
    try {
      return await requestAny({ method, params });
    } catch {
      if (!params) return requestAny(method);
      throw new Error(`Wallet request failed for method: ${method}`);
    }
  }
}

export function StacksWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const refreshWallet = useCallback(async () => {
    if (!isConnected()) {
      setAddress(null);
      return;
    }

    const methods = ["getAddresses", "stx_getAddresses"];
    for (const method of methods) {
      try {
        const response = await walletRequest(method);
        const nextAddress = extractWalletAddress(response);
        if (nextAddress) {
          setAddress(nextAddress);
          return;
        }
      } catch {
        // Try next provider method.
      }
    }
  }, []);

  const connectWallet = useCallback(async () => {
    setConnecting(true);
    try {
      await connectAny({
        network,
        forceWalletSelect: true,
        approvedProviderIds: providers,
      });
      await refreshWallet();
    } finally {
      setConnecting(false);
    }
  }, [refreshWallet]);

  const disconnectWallet = useCallback(async () => {
    await disconnect();
    setAddress(null);
  }, []);

  const requestWallet = useCallback(
    async (method: string, params?: Record<string, unknown>) =>
      walletRequest(method, params),
    [],
  );

  useEffect(() => {
    void refreshWallet();
  }, [refreshWallet]);

  const contextValue = useMemo<StacksWalletContextValue>(
    () => ({
      address,
      connected: Boolean(address),
      connecting,
      connectWallet,
      disconnectWallet,
      requestWallet,
      refreshWallet,
    }),
    [
      address,
      connecting,
      connectWallet,
      disconnectWallet,
      requestWallet,
      refreshWallet,
    ],
  );

  return (
    <StacksWalletContext.Provider value={contextValue}>
      {children}
    </StacksWalletContext.Provider>
  );
}

export function useStacksWallet(): StacksWalletContextValue {
  const context = useContext(StacksWalletContext);
  if (!context) {
    throw new Error(
      "useStacksWallet must be used within a StacksWalletProvider",
    );
  }
  return context;
}
