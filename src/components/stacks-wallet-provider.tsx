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
import { connect, disconnect, getUserData } from "@stacks/connect";
const LOG_ENDPOINT = "http://127.0.0.1:7244/ingest/40e57abd-55cf-4ea1-bcd5-c8a9d286bacc";

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
) => void;

function extractWalletAddress(payload: unknown, networkType: string): string | null {
  const value = payload as Record<string, any>;
  if (!value) return null;

  // Try multiple paths for address extraction (for @stacks/connect v8)
  const paths = [
    // From userSession in auth response
    value.userSession?.loadUserData?.()?.profile?.stxAddress?.[networkType],
    // From profile directly
    value.profile?.stxAddress?.[networkType],
    // From addresses array
    value.addresses?.stx?.[0]?.address,
    value.result?.addresses?.stx?.[0]?.address,
    // Direct address field
    value.address,
    value.result?.address,
  ];

  for (const path of paths) {
    if (typeof path === "string" && path.startsWith("S")) {
      return path;
    }
  }

  return null;
}

export function StacksWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const refreshWallet = useCallback(async () => {
    // Check for existing authenticated session
    try {
      const userData = await getUserData();
      if (userData?.profile?.stxAddress) {
        const addr = userData.profile.stxAddress[network];
        if (addr) {
          setAddress(addr);
          // #region agent log
          fetch(LOG_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "stacks-wallet-provider.tsx:refreshWallet",
              message: "restored_session",
              data: { hasUserData: true, addr: addr?.slice?.(0, 6) + "..." + addr?.slice?.(-4) },
              timestamp: Date.now(),
              runId: "pre-fix",
              hypothesisId: "H2"
            })
          }).catch(()=>{});
          // #endregion
          return;
        }
      }
    } catch (error) {
      // No existing session or error fetching user data
      console.debug("No existing wallet session found");
      // #region agent log
      fetch(LOG_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "stacks-wallet-provider.tsx:refreshWallet",
          message: "no_existing_session_or_error",
          data: { error: String(error) },
          timestamp: Date.now(),
          runId: "pre-fix",
          hypothesisId: "H2"
        })
      }).catch(()=>{});
      // #endregion
    }
    setAddress(null);
  }, []);

  const connectWallet = useCallback(async () => {
    setConnecting(true);
    try {
      // #region agent log
      fetch(LOG_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "stacks-wallet-provider.tsx:connectWallet",
          message: "connect_initiated",
          data: { network, providers },
          timestamp: Date.now(),
          runId: "pre-fix",
          hypothesisId: "H1"
        })
      }).catch(()=>{});
      // #endregion
      await new Promise<void>((resolve, reject) => {
        connectAny({
          network,
          forceWalletSelect: true,
          approvedProviderIds: providers,
          onFinish: (authResponse: any) => {
            try {
              // Extract address from authentication response
              const addr = extractWalletAddress(authResponse, network);
              
              // #region agent log
              fetch(LOG_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  location: "stacks-wallet-provider.tsx:onFinish",
                  message: "onFinish_received",
                  data: { hasAddr: !!addr, keys: Object.keys(authResponse || {}).slice(0,6) },
                  timestamp: Date.now(),
                  runId: "pre-fix",
                  hypothesisId: "H1"
                })
              }).catch(()=>{});
              // #endregion

              if (addr) {
                setAddress(addr);
                resolve();
              } else {
                // Fallback: try to get from user data
                getUserData()
                  .then((userData) => {
                    const fallbackAddr = userData?.profile?.stxAddress?.[network];
                    if (fallbackAddr) {
                      setAddress(fallbackAddr);
                      resolve();
                    } else {
                      // #region agent log
                      fetch(LOG_ENDPOINT, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          location: "stacks-wallet-provider.tsx:onFinish",
                          message: "no_address_in_auth_and_no_fallback",
                          data: {},
                          timestamp: Date.now(),
                          runId: "pre-fix",
                          hypothesisId: "H1"
                        })
                      }).catch(()=>{});
                      // #endregion
                      reject(new Error("No address found in auth response"));
                    }
                  })
                  .catch(() => {
                    // #region agent log
                    fetch(LOG_ENDPOINT, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        location: "stacks-wallet-provider.tsx:onFinish",
                        message: "getUserData_failed",
                        data: {},
                        timestamp: Date.now(),
                        runId: "pre-fix",
                        hypothesisId: "H1"
                      })
                    }).catch(()=>{});
                    // #endregion
                    reject(new Error("No address found in auth response"));
                  });
              }
            } catch (error) {
              // #region agent log
              fetch(LOG_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  location: "stacks-wallet-provider.tsx:onFinish",
                  message: "onFinish_exception",
                  data: { error: String(error) },
                  timestamp: Date.now(),
                  runId: "pre-fix",
                  hypothesisId: "H1"
                })
              }).catch(()=>{});
              // #endregion
              reject(error);
            }
          },
          onCancel: () => {
            // #region agent log
            fetch(LOG_ENDPOINT, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "stacks-wallet-provider.tsx:connectAny",
                message: "user_cancelled_connect",
                data: {},
                timestamp: Date.now(),
                runId: "pre-fix",
                hypothesisId: "H1"
              })
            }).catch(()=>{});
            // #endregion
            reject(new Error("User cancelled wallet connection"));
          },
        });
      });
    } catch (error) {
      console.error("Wallet connection error:", error);
      // #region agent log
      fetch(LOG_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "stacks-wallet-provider.tsx:connectWallet",
          message: "connect_error",
          data: { error: String(error) },
          timestamp: Date.now(),
          runId: "pre-fix",
          hypothesisId: "H1"
        })
      }).catch(()=>{});
      // #endregion
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnectWallet = useCallback(async () => {
    await disconnect();
    setAddress(null);
  }, []);

  const requestWallet = useCallback(
    async (method: string, params?: Record<string, unknown>) => {
      // For x402 payment signing and other wallet requests
      return new Promise((resolve, reject) => {
        try {
          // Use connect with appropriate method
          connectAny({
            network,
            method,
            params,
            onFinish: (response: any) => resolve(response),
            onCancel: () => reject(new Error("User cancelled request")),
          } as any);
        } catch (error) {
          reject(error);
        }
      });
    },
    [],
  );

  // Check for existing session on mount
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
