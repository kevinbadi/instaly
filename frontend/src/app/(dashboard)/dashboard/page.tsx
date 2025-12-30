"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import {
  MessageCircle,
  Users,
  Target,
  ArrowUpRight,
  Calendar,
  Clock,
  Play,
  Pause,
  PartyPopper,
  Sparkles,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

interface Stats {
  dmsSentToday: number;
  dailyLimit: number;
  totalLeads: number;
  messagedLeads: number;
  activeCampaigns: number;
  responseRate: number;
}

interface Campaign {
  id: string;
  name: string;
  status: "active" | "paused" | "completed";
  instagram_username: string;
  total_dms_sent: number;
  leads_count: number;
}

interface RecentDm {
  id: string;
  lead_username: string;
  message_preview: string;
  sent_at: string;
  status: "sent" | "failed";
}

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({
    dmsSentToday: 0,
    dailyLimit: 200,
    totalLeads: 0,
    messagedLeads: 0,
    activeCampaigns: 0,
    responseRate: 0,
  });

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recentDms, setRecentDms] = useState<RecentDm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);

  // Check for successful checkout and trigger celebration
  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      setShowCelebration(true);
      
      // Fire confetti
      const duration = 3000;
      const end = Date.now() + duration;

      const colors = ["#39FF14", "#00ff88", "#ffffff", "#c0c0c0"];

      (function frame() {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors,
        });
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();

      // Clear the URL parameter after showing celebration
      setTimeout(() => {
        router.replace("/dashboard", { scroll: false });
      }, 500);
    }
  }, [searchParams, router]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch("/api/dashboard");
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setCampaigns(data.campaigns);
        setRecentDms(data.recentDms);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "DMs Sent Today",
      value: stats.dmsSentToday,
      subtitle: `${stats.dailyLimit - stats.dmsSentToday} remaining`,
      icon: MessageCircle,
      progress: (stats.dmsSentToday / stats.dailyLimit) * 100,
    },
    {
      title: "Total Leads",
      value: stats.totalLeads.toLocaleString(),
      subtitle: `${stats.messagedLeads} messaged`,
      icon: Users,
    },
    {
      title: "Active Campaigns",
      value: stats.activeCampaigns,
      subtitle: "Running now",
      icon: Target,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-white/10 border-t-emerald-500 animate-spin mx-auto" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 rounded-full bg-emerald-500/20" />
            </div>
          </div>
          <p className="text-muted-foreground mt-4 animate-pulse">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className="space-y-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Celebration Banner */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ type: "spring", damping: 15, stiffness: 300 }}
            className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 via-emerald-400/10 to-emerald-500/20 p-6 shadow-2xl shadow-emerald-500/20"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(57,255,20,0.1),transparent_70%)]" />
            <button
              onClick={() => setShowCelebration(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="relative flex items-center gap-6">
              <div className="flex-shrink-0">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <PartyPopper className="h-8 w-8 text-black" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-bold text-white">Welcome to the family!</h2>
                  <Sparkles className="h-6 w-6 text-yellow-400 animate-pulse" />
                </div>
                <p className="text-emerald-100/80">
                  Your subscription is now active. You&apos;re all set to start automating your Instagram outreach and growing your business!
                </p>
              </div>
              <div className="hidden md:block">
                <Link href="/connect">
                  <Button variant="gradient" className="shadow-lg shadow-emerald-500/30">
                    Connect Instagram
                    <ArrowUpRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s your Instagram automation overview.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/connect">
            <Button variant="outline">Connect Account</Button>
          </Link>
          <Link href="/campaigns">
            <Button variant="gradient">New Campaign</Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="h-full"
          >
            <Card className="relative overflow-hidden h-full">
              <CardContent className="p-6 h-full flex flex-col">
                {/* Top section - always same height */}
                <div className="flex items-start justify-between mb-3">
                  <p className="text-sm text-muted-foreground">
                    {stat.title}
                  </p>
                  <div className="h-10 w-10 rounded-xl instagram-gradient-bg flex items-center justify-center shrink-0">
                    <stat.icon className="h-5 w-5 text-black" />
                  </div>
                </div>
                
                {/* Value - prominent */}
                <p className="text-3xl font-bold mb-1">{stat.value}</p>
                
                {/* Subtitle */}
                <p className="text-sm text-muted-foreground mb-3">
                  {stat.subtitle}
                </p>
                
                {/* Progress bar - only for first card */}
                {stat.progress !== undefined && (
                  <div className="h-2 mt-auto">
                    <Progress value={stat.progress} className="h-2" />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Campaigns & Recent DMs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Campaigns */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Active Campaigns</CardTitle>
            <Link href="/campaigns">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {campaigns.length === 0 ? (
              <div className="text-center py-8">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No campaigns yet</p>
                <Link href="/campaigns">
                  <Button variant="outline" size="sm">
                    Create Your First Campaign
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {campaigns.slice(0, 4).map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border/50"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          campaign.status === "active"
                            ? "bg-green-500/20 text-green-500"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {campaign.status === "active" ? (
                          <Play className="h-4 w-4" />
                        ) : (
                          <Pause className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{campaign.name}</p>
                        <p className="text-sm text-muted-foreground">
                          @{campaign.instagram_username}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={
                          campaign.status === "active" ? "success" : "secondary"
                        }
                      >
                        {campaign.status}
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-1">
                        {campaign.total_dms_sent} DMs sent
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent DMs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Messages</CardTitle>
            <Link href="/leads">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentDms.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No messages sent yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentDms.slice(0, 5).map((dm) => (
                  <div
                    key={dm.id}
                    className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border border-border/50"
                  >
                    <div className="h-10 w-10 rounded-full instagram-gradient-bg flex items-center justify-center shrink-0">
                      <span className="text-black font-semibold text-sm">
                        {dm.lead_username[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">@{dm.lead_username}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(dm.sent_at).toLocaleTimeString()}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {dm.message_preview}
                      </p>
                    </div>
                    <Badge
                      variant={dm.status === "sent" ? "success" : "destructive"}
                    >
                      {dm.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/connect">
              <div className="p-6 rounded-lg border border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer text-center">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <p className="font-medium">Connect Instagram</p>
                <p className="text-sm text-muted-foreground">
                  Add a new account
                </p>
              </div>
            </Link>
            <Link href="/campaigns">
              <div className="p-6 rounded-lg border border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer text-center">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <p className="font-medium">Create Campaign</p>
                <p className="text-sm text-muted-foreground">
                  Start automating
                </p>
              </div>
            </Link>
            <Link href="/leads">
              <div className="p-6 rounded-lg border border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer text-center">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <p className="font-medium">Import Leads</p>
                <p className="text-sm text-muted-foreground">
                  Upload CSV file
                </p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}



