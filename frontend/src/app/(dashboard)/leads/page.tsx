"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Search,
  Filter,
  Download,
  CheckCircle2,
  Clock,
  ExternalLink,
  MoreVertical,
  Mail,
  Trash2,
  Loader2,
  Link,
  Heart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";

interface Lead {
  id: string;
  instagram_username: string;
  full_name: string | null;
  bio: string | null;
  followers_count: number | null;
  is_verified: boolean;
  source_post_url: string | null;
  dm_sent: boolean;
  dm_sent_at: string | null;
  campaign_name?: string;
  created_at: string;
}

interface Campaign {
  id: string;
  name: string;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dmFilter, setDmFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [likesDialogOpen, setLikesDialogOpen] = useState(false);
  const [likesUrl, setLikesUrl] = useState("");
  const [scrapingLikes, setScrapingLikes] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [leadsRes, campaignsRes] = await Promise.all([
        fetch("/api/leads"),
        fetch("/api/campaigns"),
      ]);

      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setLeads(data.leads);
      }

      if (campaignsRes.ok) {
        const data = await campaignsRes.json();
        setCampaigns(data.campaigns);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const csvContent = [
      ["Username", "Full Name", "Bio", "Followers", "DM Sent", "Source"],
      ...leads.map((lead) => [
        lead.instagram_username,
        lead.full_name || "",
        lead.bio || "",
        lead.followers_count?.toString() || "",
        lead.dm_sent ? "Yes" : "No",
        lead.source_post_url || "",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: `Exported ${leads.length} leads to CSV.`,
    });
  };

  const handleScrapeLikes = async () => {
    if (!likesUrl) return;

    setScrapingLikes(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

      const response = await fetch("/api/leads/scrape-likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postUrl: likesUrl,
          maxLikers: 100,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Instagram Likes Scrape complete!",
          description: `Found ${data.leadsScraped || 0} new leads from post likes.`,
        });
        setLikesDialogOpen(false);
        setLikesUrl("");
        fetchData();
      } else {
        toast({
          title: "Likes scrape failed",
          description: data.error || "Failed to scrape likes",
          variant: "destructive",
        });
        fetchData();
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast({
          title: "Scraping timed out",
          description: "The scrape took too long. Refreshing to check for leads...",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Connection error. Refreshing to check for leads...",
          variant: "destructive",
        });
      }
      fetchData();
    } finally {
      setScrapingLikes(false);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setLeads(leads.filter((l) => l.id !== leadId));
        toast({
          title: "Lead deleted",
          description: "Lead has been removed.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete lead.",
        variant: "destructive",
      });
    }
  };

  const toggleLeadSelection = (leadId: string) => {
    const newSelection = new Set(selectedLeads);
    if (newSelection.has(leadId)) {
      newSelection.delete(leadId);
    } else {
      newSelection.add(leadId);
    }
    setSelectedLeads(newSelection);
  };

  const toggleAllLeads = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.instagram_username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDm =
      dmFilter === "all" ||
      (dmFilter === "sent" && lead.dm_sent) ||
      (dmFilter === "pending" && !lead.dm_sent);
    const matchesCampaign =
      campaignFilter === "all" || lead.campaign_name === campaignFilter;
    return matchesSearch && matchesDm && matchesCampaign;
  });

  const stats = {
    total: leads.length,
    messaged: leads.filter((l) => l.dm_sent).length,
    pending: leads.filter((l) => !l.dm_sent).length,
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
          <p className="text-muted-foreground mt-4 animate-pulse">Loading leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground">
            Manage and track your scraped Instagram leads
          </p>
        </div>
        <div className="flex gap-2">
          {/* Instagram Likes Scrape Dialog (Apify) */}
          <Dialog open={likesDialogOpen} onOpenChange={setLikesDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient">
                <Heart className="h-4 w-4 mr-2" />
                Instagram Likes Scrape
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Instagram Likes Scrape</DialogTitle>
                <DialogDescription>
                  Extract users who liked any Instagram post. Works with public posts - no cookies required!
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Instagram Post URL</label>
                  <div className="relative">
                    <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="https://instagram.com/p/ABC123..."
                      className="pl-10"
                      value={likesUrl}
                      onChange={(e) => setLikesUrl(e.target.value)}
                      disabled={scrapingLikes}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Uses your connected Instagram account to scrape up to 100 users who liked this post.
                  </p>
                </div>
                {scrapingLikes && (
                  <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div>
                      <p className="font-medium">Scraping likes...</p>
                      <p className="text-sm text-muted-foreground">
                        This may take 2-4 minutes. Please wait...
                      </p>
                    </div>
                  </div>
                )}
                <Button
                  variant="gradient"
                  className="w-full"
                  onClick={handleScrapeLikes}
                  disabled={!likesUrl || scrapingLikes}
                >
                  {scrapingLikes ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Scraping Likes...
                    </>
                  ) : (
                    <>
                      <Heart className="h-4 w-4 mr-2" />
                      Start Likes Scrape
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Leads</p>
                <p className="text-3xl font-bold">{stats.total.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Messaged</p>
                <p className="text-3xl font-bold">{stats.messaged.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-3xl font-bold">{stats.pending.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={dmFilter} onValueChange={setDmFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="DM Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="sent">Messaged</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Campaign" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campaigns</SelectItem>
            {campaigns.map((campaign) => (
              <SelectItem key={campaign.id} value={campaign.name}>
                {campaign.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Leads Table */}
      <Card>
        <CardContent className="p-0">
          {filteredLeads.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No leads found</h3>
              <p className="text-muted-foreground mb-6">
                {leads.length === 0
                  ? "Start a campaign to scrape leads from Instagram posts."
                  : "No leads match your search criteria."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-medium">
                      <input
                        type="checkbox"
                        checked={selectedLeads.size === filteredLeads.length}
                        onChange={toggleAllLeads}
                        className="rounded border-input"
                      />
                    </th>
                    <th className="text-left p-4 font-medium">User</th>
                    <th className="text-left p-4 font-medium hidden md:table-cell">
                      Followers
                    </th>
                    <th className="text-left p-4 font-medium hidden lg:table-cell">
                      Campaign
                    </th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-right p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead, i) => (
                    <motion.tr
                      key={lead.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-b hover:bg-muted/30"
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedLeads.has(lead.id)}
                          onChange={() => toggleLeadSelection(lead.id)}
                          className="rounded border-input"
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full instagram-gradient-bg flex items-center justify-center shrink-0">
                            <span className="text-black font-semibold text-sm">
                              {lead.instagram_username[0].toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                @{lead.instagram_username}
                              </p>
                              {lead.is_verified && (
                                <Badge variant="secondary" className="text-xs">
                                  Verified
                                </Badge>
                              )}
                            </div>
                            {lead.full_name && (
                              <p className="text-sm text-muted-foreground">
                                {lead.full_name}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        {lead.followers_count?.toLocaleString() || "-"}
                      </td>
                      <td className="p-4 hidden lg:table-cell">
                        <Badge variant="outline">{lead.campaign_name || "N/A"}</Badge>
                      </td>
                      <td className="p-4">
                        {lead.dm_sent ? (
                          <Badge variant="success">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Sent
                          </Badge>
                        ) : (
                          <Badge variant="warning">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                window.open(
                                  `https://instagram.com/${lead.instagram_username}`,
                                  "_blank"
                                )
                              }
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="h-4 w-4 mr-2" />
                              Send DM
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeleteLead(lead.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



