"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, Zap, Loader2, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { PRICING_TIERS } from "@/lib/utils";

interface Subscription {
  plan_name: string;
  status: string;
  max_accounts: number;
  max_dms_per_day: number;
  current_period_end?: string;
}

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [fetchingSubscription, setFetchingSubscription] = useState(true);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const response = await fetch("/api/stripe/subscription");
      if (response.ok) {
        const data = await response.json();
        setSubscription(data.subscription);
      }
    } catch (error) {
      console.error("Failed to fetch subscription:", error);
    } finally {
      setFetchingSubscription(false);
    }
  };

  const handleSubscribe = async (priceId: string, tierName: string) => {
    if (!priceId) {
      toast({
        title: "Coming Soon",
        description: "This plan will be available soon!",
      });
      return;
    }

    setLoading(tierName);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to start checkout",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setLoading("manage");
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to open billing portal",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to open billing portal.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const tiers = Object.entries(PRICING_TIERS) as [keyof typeof PRICING_TIERS, typeof PRICING_TIERS[keyof typeof PRICING_TIERS]][];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Scale your Instagram outreach with our flexible pricing plans.
          All plans include AI-powered messages and lead scraping.
        </p>
      </div>

      {/* Current Subscription */}
      {subscription && subscription.status === "active" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-emerald-500/50 bg-emerald-500/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-emerald-500 flex items-center justify-center">
                    <Crown className="h-6 w-6 text-black" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">
                      Current Plan: {subscription.plan_name.charAt(0).toUpperCase() + subscription.plan_name.slice(1)}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {subscription.max_accounts} account(s) · {subscription.max_dms_per_day} DMs/day
                      {subscription.current_period_end && (
                        <> · Renews {new Date(subscription.current_period_end).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleManageSubscription}
                  disabled={loading === "manage"}
                >
                  {loading === "manage" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Manage Subscription"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tiers.map(([key, tier], i) => {
          const isCurrentPlan = subscription?.plan_name === key && subscription?.status === "active";
          const isPopular = "popular" in tier && tier.popular;
          const isComingSoon = "comingSoon" in tier && tier.comingSoon;

          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card
                className={`relative h-full flex flex-col ${
                  isPopular
                    ? "border-emerald-500 shadow-lg shadow-emerald-500/20"
                    : "border-white/10"
                } ${isComingSoon ? "opacity-60" : ""}`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-emerald-500 text-black font-semibold">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl">{tier.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-5xl font-bold">${tier.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {tier.accounts} account{tier.accounts > 1 ? "s" : ""} · {tier.dmsPerDay} DMs/day
                  </p>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-3 flex-1">
                    {tier.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6">
                    {isCurrentPlan ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled
                      >
                        Current Plan
                      </Button>
                    ) : isComingSoon ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled
                      >
                        Coming Soon
                      </Button>
                    ) : (
                      <Button
                        variant={isPopular ? "gradient" : "outline"}
                        className="w-full"
                        onClick={() => handleSubscribe(tier.priceId, key)}
                        disabled={loading === key || fetchingSubscription}
                      >
                        {loading === key ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4 mr-2" />
                            {subscription?.status === "active" ? "Switch Plan" : "Get Started"}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* FAQ / Note */}
      <div className="text-center text-sm text-muted-foreground">
        <p>All plans include a 7-day money-back guarantee. Cancel anytime.</p>
        <p className="mt-1">Need more? Contact us for custom enterprise plans.</p>
      </div>
    </div>
  );
}






