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

type ConnectModule = typeof import("@stacks/connect");

type StacksWalletContextValue = {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  connectWallet: () => Promise<string | null>;
  disconnectWallet: () => Promise<void>;
  requestWallet: (
    method: string,
    params?: Record<string, unknown>,
  ) => Promise<unknown>;
  refreshWallet: () => Promise<string | null>;
};

const StacksWalletContext = createContext<StacksWalletContextValue | null>(null);

const providerAliasMap: Record<string, string> = {
  leather: "LeatherProvider",
  leatherprovider: "LeatherProvider",
  xverse: "XverseProviders.BitcoinProvider",
  xverseprovider: "XverseProviders.BitcoinProvider",
  "xverseproviders.bitcoinprovider": "XverseProviders.BitcoinProvider",
  "xverseproviders.stacksprovider": "XverseProviders.BitcoinProvider",
  asigna: "AsignaProvider",
  asignaprovider: "AsignaProvider",
  fordefi: "FordefiProviders.UtxoProvider",
  fordefiprovider: "FordefiProviders.UtxoProvider",
  "fordefiproviders.utxoprovider": "FordefiProviders.UtxoProvider",
  walletconnect: "WalletConnectProvider",
  walletconnectprovider: "WalletConnectProvider",
};

const knownProviderIds = new Set([
  "LeatherProvider",
  "XverseProviders.BitcoinProvider",
  "AsignaProvider",
  "FordefiProviders.UtxoProvider",
  "WalletConnectProvider",
]);

function normalizeProviderId(value: string): string | null {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) return null;
  const normalized = providerAliasMap[trimmed.toLowerCase()] ?? trimmed;
  if (!knownProviderIds.has(normalized)) {
    return null;
  }
  return normalized;
}

const approvedProviders = Array.from(
  new Set(
    (
      process.env.NEXT_PUBLIC_STACKS_WALLET_PROVIDERS ||
      "LeatherProvider,XverseProviders.BitcoinProvider"
    )
      .split(",")
      .map(normalizeProviderId)
      .filter((provider): provider is string => Boolean(provider)),
  ),
);

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();

const network =
  process.env.NEXT_PUBLIC_STACKS_NETWORK === "mainnet" ? "mainnet" : "testnet";

let connectModulePromise: Promise<ConnectModule> | null = null;

async function loadConnectModule(): Promise<ConnectModule> {
  if (!connectModulePromise) {
    connectModulePromise = import("@stacks/connect");
  }
  return connectModulePromise;
}

function pickAddressFromEntries(entries: unknown): string | null {
  if (!Array.isArray(entries)) return null;

  const parsed = entries
    .map((entry) => {
      const value = entry as Record<string, any> | null;
      if (!value || typeof value.address !== "string") return null;

      return {
        address: value.address,
        symbol: typeof value.symbol === "string" ? value.symbol : null,
      };
    })
    .filter(
      (entry): entry is { address: string; symbol: string | null } =>
        Boolean(entry),
    );

  const preferred = parsed.find(
    (entry) =>
      entry.symbol?.toUpperCase() === "STX" || entry.address.startsWith("S"),
  );

  return preferred?.address || parsed[0]?.address || null;
}

function extractWalletAddress(payload: unknown): string | null {
  if (typeof payload === "string") {
    return payload.startsWith("S") ? payload : null;
  }

  const value = payload as Record<string, any>;
  if (!value) return null;

  if (typeof value.address === "string") return value.address;
  if (typeof value.result?.address === "string") return value.result.address;

  const addresses = pickAddressFromEntries(value.addresses);
  if (addresses) return addresses;

  const resultAddresses = pickAddressFromEntries(value.result?.addresses);
  if (resultAddresses) return resultAddresses;

  const accounts = pickAddressFromEntries(value.accounts);
  if (accounts) return accounts;

  const resultAccounts = pickAddressFromEntries(value.result?.accounts);
  if (resultAccounts) return resultAccounts;

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
  const { request } = await loadConnectModule();
  const requestAny = request as unknown as (
    methodOrConfig: unknown,
    params?: Record<string, unknown>,
  ) => Promise<unknown>;

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

function isUserCancellation(error: unknown): boolean {
  const message = String(
    (error as { message?: string } | null)?.message || "",
  ).toLowerCase();
  const code = (error as { code?: number } | null)?.code;
  return (
    code === -32000 ||
    code === -31001 ||
    message.includes("cancel") ||
    message.includes("reject")
  );
}

export function StacksWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const refreshWallet = useCallback(async () => {
    const { getLocalStorage, isConnected } = await loadConnectModule();

    if (!isConnected()) {
      setAddress(null);
      return null;
    }

    const methods = ["getAddresses", "stx_getAddresses", "stx_getAccounts"];
    for (const method of methods) {
      try {
        const response = await walletRequest(method, { network });
        const nextAddress = extractWalletAddress(response);
        if (nextAddress) {
          setAddress(nextAddress);
          return nextAddress;
        }
      } catch {
        // Try next provider method.
      }
    }

    const cachedAddress = getLocalStorage()?.addresses?.stx?.[0]?.address || null;
    setAddress(cachedAddress);
    return cachedAddress;
  }, []);

  const connectWallet = useCallback(async () => {
    setConnecting(true);
    try {
      const { connect } = await loadConnectModule();
      const baseOptions = {
        network,
        forceWalletSelect: true,
        ...(walletConnectProjectId
          ? { walletConnectProjectId }
          : {}),
      };

      let response: unknown;
      try {
        response = await connect({
          ...baseOptions,
          ...(approvedProviders.length > 0
            ? { approvedProviderIds: approvedProviders }
            : {}),
        });
      } catch (error) {
        if (approvedProviders.length === 0 || isUserCancellation(error)) {
          throw error;
        }
        // Fallback for misconfigured provider allowlist in env.
        response = await connect(baseOptions);
      }

      const nextAddress = extractWalletAddress(response) || (await refreshWallet());
      if (nextAddress) {
        setAddress(nextAddress);
      }
      return nextAddress;
    } catch (error) {
      console.error("Wallet connection error:", error);
      return null;
    } finally {
      setConnecting(false);
    }
  }, [refreshWallet]);

  const disconnectWallet = useCallback(async () => {
    const { disconnect } = await loadConnectModule();
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
