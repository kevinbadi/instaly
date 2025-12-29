"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Instagram,
  Plus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Loader2,
  Shield,
  Clock,
  Zap,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";

interface InstagramAccount {
  id: string;
  instagram_username: string;
  status: "active" | "needs_reauth" | "disabled";
  daily_dm_limit: number;
  dms_sent_today: number;
  created_at: string;
  session_status?: "active" | "expired" | "flagged";
}

export default function ConnectPage() {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [steelSessionUrl, setSteelSessionUrl] = useState<string | null>(null);
  const [steelSessionId, setSteelSessionId] = useState<string | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editedUsername, setEditedUsername] = useState("");

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleStartEdit = (account: InstagramAccount) => {
    setEditingAccountId(account.id);
    setEditedUsername(account.instagram_username);
  };

  const handleCancelEdit = () => {
    setEditingAccountId(null);
    setEditedUsername("");
  };

  const handleSaveUsername = async (accountId: string) => {
    if (!editedUsername.trim()) {
      toast({
        title: "Error",
        description: "Username cannot be empty",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/instagram/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagram_username: editedUsername.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to update username");
      }

      // Update local state
      setAccounts(accounts.map(acc => 
        acc.id === accountId 
          ? { ...acc, instagram_username: editedUsername.trim() }
          : acc
      ));

      toast({
        title: "Username updated",
        description: `Account renamed to "${editedUsername.trim()}"`,
      });

      setEditingAccountId(null);
      setEditedUsername("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update username",
        variant: "destructive",
      });
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await fetch("/api/instagram-accounts");
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts);
      }
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartConnection = async () => {
    console.log("Starting connection...");
    setConnecting(true);
    try {
      const response = await fetch("/api/steel/session", {
        method: "POST",
      });

      console.log("Response status:", response.status);
      const data = await response.json();
      console.log("Response data:", data);

      if (response.ok) {
        setSteelSessionId(data.sessionId);
        // Prefer debugUrl for better control, fallback to liveViewUrl
        const browserUrl = data.debugUrl || data.liveViewUrl;
        setSteelSessionUrl(browserUrl);
        
        console.log("Opening Steel browser:", browserUrl);
        
        // Open in new window - bypasses iframe restrictions
        const steelWindow = window.open(browserUrl, "_blank", "width=1200,height=800");
        
        if (!steelWindow) {
          toast({
            title: "Pop-up blocked",
            description: "Please allow pop-ups and try again.",
            variant: "destructive",
          });
          return;
        }
        
        toast({
          title: "Browser opened!",
          description: "Log in to Instagram in the new window, then come back here and click 'Capture Session'.",
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to start connection. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Connection error:", error);
      toast({
        title: "Error",
        description: "Failed to start connection. Please try again.",
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleCaptureSession = useCallback(async () => {
    if (!steelSessionId) return;

    try {
      const response = await fetch("/api/steel/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: steelSessionId }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Account connected!",
          description: `@${data.username} has been connected successfully.`,
        });
        setConnectDialogOpen(false);
        setSteelSessionUrl(null);
        setSteelSessionId(null);
        fetchAccounts();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to capture session.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to capture session. Please try again.",
        variant: "destructive",
      });
    }
  }, [steelSessionId]);

  const handleDisconnectAccount = async (accountId: string) => {
    try {
      const response = await fetch(`/api/instagram-accounts/${accountId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setAccounts(accounts.filter((a) => a.id !== accountId));
        toast({
          title: "Account disconnected",
          description: "Instagram account has been disconnected.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to disconnect account.",
        variant: "destructive",
      });
    }
  };

  const handleRefreshSession = async (accountId: string) => {
    toast({
      title: "Refreshing session...",
      description: "Please wait while we refresh your Instagram session.",
    });
    // TODO: Implement session refresh with Steel.dev
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Connect Instagram</h1>
          <p className="text-muted-foreground">
            Link your Instagram accounts for DM automation
          </p>
        </div>
        <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient" onClick={() => setConnectDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Connect Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Connect Instagram Account</DialogTitle>
              <DialogDescription>
                {steelSessionUrl
                  ? "Log in to your Instagram account in the browser below. We'll securely capture your session."
                  : "Start the secure browser connection to link your Instagram account."}
              </DialogDescription>
            </DialogHeader>

            {!steelSessionUrl ? (
              <div className="py-8 text-center">
                <div className="h-20 w-20 rounded-full instagram-gradient-bg flex items-center justify-center mx-auto mb-6">
                  <Instagram className="h-10 w-10 text-black" />
                </div>
                <h3 className="text-xl font-semibold mb-4">
                  Ready to Connect Your Account
                </h3>
                <div className="space-y-4 mb-8 text-left max-w-md mx-auto">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Secure Connection</p>
                      <p className="text-sm text-muted-foreground">
                        Your credentials are never stored. We only capture session
                        cookies.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Long-Lasting Session</p>
                      <p className="text-sm text-muted-foreground">
                        Sessions typically last 90+ days before needing refresh.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Instant Automation</p>
                      <p className="text-sm text-muted-foreground">
                        Start sending DMs immediately after connecting.
                      </p>
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="gradient"
                  size="lg"
                  onClick={handleStartConnection}
                  disabled={connecting}
                >
                  {connecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Starting Browser...
                    </>
                  ) : (
                    <>
                      <Instagram className="h-4 w-4 mr-2" />
                      Start Secure Connection
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-6 py-4">
                <div className="text-center">
                  <div className="h-16 w-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="h-8 w-8 text-yellow-500" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Browser Opened - Action Required</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    A browser window opened. Follow the steps below to connect your account.
                  </p>
                </div>
                
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-yellow-500 text-black flex items-center justify-center text-sm font-bold shrink-0">1</div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">In the browser window, click the URL bar and paste this:</p>
                      <div className="flex items-center gap-2 mt-2">
                        <code className="bg-black/50 px-3 py-2 rounded text-sm flex-1 text-emerald-400">
                          instagram.com/accounts/login
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText("https://www.instagram.com/accounts/login/");
                            toast({ title: "Copied!", description: "URL copied to clipboard" });
                          }}
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-yellow-500 text-black flex items-center justify-center text-sm font-bold shrink-0">2</div>
                    <p className="text-sm">Press Enter, then log in to your Instagram account</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-yellow-500 text-black flex items-center justify-center text-sm font-bold shrink-0">3</div>
                    <p className="text-sm">Once you see your Instagram feed, come back here</p>
                  </div>
                </div>
                
                <div className="flex flex-col gap-3">
                  <Button variant="gradient" size="lg" className="w-full" onClick={handleCaptureSession}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    I&apos;m Logged In - Capture Session
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => window.open(steelSessionUrl, "_blank")}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Re-open Browser Window
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl instagram-gradient-bg flex items-center justify-center shrink-0">
              <Shield className="h-6 w-6 text-black" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">How It Works</h3>
              <p className="text-sm text-muted-foreground">
                We use a secure browser session to authenticate with Instagram.
                Your password is never stored - we only save the session cookies
                needed for automation. Sessions typically last 90+ days before
                requiring re-authentication.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accounts List */}
      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Instagram className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No accounts connected</h3>
            <p className="text-muted-foreground mb-6">
              Connect your first Instagram account to start automating DMs.
            </p>
            <Button variant="gradient" onClick={() => setConnectDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Connect Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {accounts.map((account, i) => (
            <motion.div
              key={account.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="hover:border-primary/30 transition-colors">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-full instagram-gradient-bg flex items-center justify-center">
                        <Instagram className="h-7 w-7 text-black" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          {editingAccountId === account.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={editedUsername}
                                onChange={(e) => setEditedUsername(e.target.value)}
                                className="h-8 w-48 bg-white/5 border-white/20"
                                placeholder="Account name"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveUsername(account.id);
                                  if (e.key === "Escape") handleCancelEdit();
                                }}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                                onClick={() => handleSaveUsername(account.id)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-white"
                                onClick={handleCancelEdit}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <h3 className="text-lg font-semibold">
                                @{account.instagram_username}
                              </h3>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-white"
                                onClick={() => handleStartEdit(account)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          <Badge
                            variant={
                              account.status === "active"
                                ? "success"
                                : account.status === "needs_reauth"
                                ? "warning"
                                : "destructive"
                            }
                          >
                            {account.status === "active" && (
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                            )}
                            {account.status === "needs_reauth" && (
                              <AlertCircle className="h-3 w-3 mr-1" />
                            )}
                            {account.status === "active"
                              ? "Connected"
                              : account.status === "needs_reauth"
                              ? "Needs Re-auth"
                              : "Disabled"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span>
                            DMs today: {account.dms_sent_today} /{" "}
                            {account.daily_dm_limit}
                          </span>
                          <span>
                            Connected:{" "}
                            {new Date(account.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {account.status === "needs_reauth" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRefreshSession(account.id)}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh Session
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDisconnectAccount(account.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}



