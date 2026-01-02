"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Send,
  Users,
  Megaphone,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface DashboardStats {
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
  status: string;
  instagram_username: string;
  total_dms_sent: number;
  leads_count: number;
}

interface RecentDm {
  id: string;
  lead_username: string;
  message_preview: string;
  sent_at: string;
  status: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recentDms, setRecentDms] = useState<RecentDm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch("/api/dashboard");
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setCampaigns(data.campaigns || []);
        setRecentDms(data.recentDms || []);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

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

  const dmProgress = stats ? (stats.dmsSentToday / stats.dailyLimit) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s your Instagram automation overview.
          </p>
        </div>
        <Link href="/campaigns">
          <Button variant="gradient">
            <Zap className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Send className="h-6 w-6 text-primary" />
                </div>
                <Badge variant="secondary">{stats?.dailyLimit || 0} limit</Badge>
              </div>
              <p className="text-sm text-muted-foreground">DMs Sent Today</p>
              <p className="text-3xl font-bold">{stats?.dmsSentToday || 0}</p>
              <Progress value={dmProgress} className="mt-3 h-2" />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-slate-400/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-slate-400" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Total Leads</p>
              <p className="text-3xl font-bold">{stats?.totalLeads?.toLocaleString() || 0}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {stats?.messagedLeads || 0} messaged
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Megaphone className="h-6 w-6 text-green-500" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Active Campaigns</p>
              <p className="text-3xl font-bold">{stats?.activeCampaigns || 0}</p>
              <Link href="/campaigns" className="text-sm text-primary hover:underline mt-1 inline-flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        </motion.div>

      </div>

      {/* Campaigns and Recent DMs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Campaigns */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Active Campaigns</CardTitle>
            <Link href="/campaigns">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {campaigns.length === 0 ? (
              <div className="text-center py-8">
                <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-4">No campaigns yet</p>
                <Link href="/campaigns">
                  <Button variant="outline" size="sm">Create Campaign</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full instagram-gradient-bg flex items-center justify-center">
                        <span className="text-black font-semibold text-sm">
                          {campaign.name[0].toUpperCase()}
                        </span>
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
                        variant={campaign.status === "active" ? "success" : "secondary"}
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
          <CardHeader>
            <CardTitle>Recent Messages</CardTitle>
          </CardHeader>
          <CardContent>
            {recentDms.length === 0 ? (
              <div className="text-center py-8">
                <Send className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No messages sent yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentDms.map((dm) => (
                  <div
                    key={dm.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      {dm.status === "sent" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : dm.status === "failed" ? (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <Clock className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium truncate">@{dm.lead_username}</p>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(dm.sent_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {dm.message_preview}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
