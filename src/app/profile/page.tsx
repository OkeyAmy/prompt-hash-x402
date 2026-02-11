"use client";

import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Wallet, ShoppingBag, Settings } from "lucide-react";
import { useStacksWallet } from "@/components/stacks-wallet-provider";
import { shortenAddress } from "@/lib/utils";
import MyPurchases from "./MyPurchases";

export default function ProfilePage() {
  const { address, connected, connectWallet, disconnectWallet } =
    useStacksWallet();

  const displayName = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "Not Connected";

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col bg-gradient-to-r from-purple-400 to-blue-500">
      <Navigation />
      <main className="flex-1 container py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start gap-6 mb-8">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="bg-purple-600 text-white text-2xl">
                {connected ? address?.slice(0, 2).toUpperCase() : "??"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">{displayName}</h1>
              <p className="text-muted-foreground">
                {connected ? "Wallet Connected" : "Not Connected"}
              </p>
              {connected && address && (
                <p className="text-sm text-muted-foreground font-mono mt-1">
                  {shortenAddress(address)}
                </p>
              )}
            </div>
            {connected ? (
              <Button variant="outline" onClick={() => void disconnectWallet()}>
                Disconnect
              </Button>
            ) : (
              <Button onClick={() => void connectWallet()}>
                Connect Wallet
              </Button>
            )}
          </div>

          <Tabs defaultValue="purchases">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="purchases">My Purchases</TabsTrigger>
              <TabsTrigger value="wallet">Wallet</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="purchases" className="mt-6">
              <MyPurchases />
            </TabsContent>

            <TabsContent value="wallet" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Wallet Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {connected && address ? (
                    <div className="space-y-6">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Connected Wallet
                        </p>
                        <p className="font-mono break-all">{address}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Network</p>
                        <p className="text-lg font-semibold">
                          {process.env.NEXT_PUBLIC_STACKS_NETWORK === "mainnet"
                            ? "Stacks Mainnet"
                            : "Stacks Testnet"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        Connect your wallet to view details
                      </p>
                      <Button onClick={() => void connectWallet()}>
                        Connect Wallet
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Account Settings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {connected ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">
                          Wallet Address
                        </label>
                        <p className="text-sm text-muted-foreground mt-1 font-mono">
                          {address}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Your wallet address is your identity on PromptHash
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Network</label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {process.env.NEXT_PUBLIC_STACKS_NETWORK === "mainnet"
                            ? "Stacks Mainnet"
                            : "Stacks Testnet"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        Connect your wallet to access settings
                      </p>
                      <Button onClick={() => void connectWallet()}>
                        Connect Wallet
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}
