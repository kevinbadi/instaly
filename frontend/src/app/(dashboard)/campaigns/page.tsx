"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Target,
  Play,
  Pause,
  Trash2,
  Edit,
  MoreVertical,
  Search,
  Filter,
  MessageCircle,
  Users,
  Clock,
  Loader2,
  UserPlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";

interface Campaign {
  id: string;
  name: string;
  status: "active" | "paused" | "completed";
  instagram_account_id: string;
  instagram_username: string;
  message_template: string | null;
  scrape_urls: string[];
  total_dms_sent: number;
  dms_per_session: number;
  sessions_per_day: number;
  created_at: string;
  last_run_at: string | null;
  leads_count?: number;
}

interface InstagramAccount {
  id: string;
  instagram_username: string;
  status: string;
}

interface LeadStats {
  total: number;
  unassigned: number;
  pending: number;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    instagram_account_id: "",
    message_template: "",
    scrape_urls: "",
    use_ai: true,
    assign_all_leads: true,
    dms_per_session: 10,
    sessions_per_day: 15,
  });
  const [leadStats, setLeadStats] = useState<LeadStats>({ total: 0, unassigned: 0, pending: 0 });
  const [assigningLeads, setAssigningLeads] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [campaignsRes, accountsRes, leadsRes] = await Promise.all([
        fetch("/api/campaigns"),
        fetch("/api/instagram-accounts"),
        fetch("/api/leads/stats"),
      ]);

      if (campaignsRes.ok) {
        const data = await campaignsRes.json();
        setCampaigns(data.campaigns);
      }

      if (accountsRes.ok) {
        const data = await accountsRes.json();
        setAccounts(data.accounts);
      }

      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setLeadStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async () => {
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCampaign.name,
          instagram_account_id: newCampaign.instagram_account_id,
          message_template: newCampaign.use_ai ? "ai" : newCampaign.message_template,
          scrape_urls: newCampaign.scrape_urls
            .split("\n")
            .map((url) => url.trim())
            .filter(Boolean),
          dms_per_session: newCampaign.dms_per_session,
          sessions_per_day: newCampaign.sessions_per_day,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Assign leads if option is checked
        if (newCampaign.assign_all_leads && leadStats.unassigned > 0) {
          await fetch(`/api/campaigns/${data.campaign.id}/assign-leads`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assignAll: true }),
          });
        }
        
        // Refresh data to get updated counts
        await fetchData();
        
        setCreateDialogOpen(false);
        setNewCampaign({
          name: "",
          instagram_account_id: "",
          message_template: "",
          scrape_urls: "",
          use_ai: true,
          assign_all_leads: true,
          dms_per_session: 10,
          sessions_per_day: 15,
        });
        toast({
          title: "Campaign created",
          description: newCampaign.assign_all_leads 
            ? `Campaign created with ${leadStats.unassigned} leads assigned.`
            : "Your campaign has been created successfully.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create campaign. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleToggleStatus = async (campaign: Campaign) => {
    const newStatus = campaign.status === "active" ? "paused" : "active";

    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setCampaigns(
          campaigns.map((c) =>
            c.id === campaign.id ? { ...c, status: newStatus } : c
          )
        );
        toast({
          title: `Campaign ${newStatus}`,
          description: `Campaign "${campaign.name}" has been ${newStatus}.`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update campaign status.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setCampaigns(campaigns.filter((c) => c.id !== campaignId));
        toast({
          title: "Campaign deleted",
          description: "Campaign has been deleted successfully.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete campaign.",
        variant: "destructive",
      });
    }
  };

  const handleAssignLeads = async (campaignId: string) => {
    if (leadStats.unassigned === 0) {
      toast({
        title: "No leads available",
        description: "Scrape some leads first, then assign them to a campaign.",
        variant: "destructive",
      });
      return;
    }

    setAssigningLeads(campaignId);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/assign-leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignAll: true }),
      });

      if (response.ok) {
        const data = await response.json();
        await fetchData();
        toast({
          title: "Leads assigned",
          description: `${data.leadsAssigned} leads have been assigned to this campaign.`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to assign leads.",
        variant: "destructive",
      });
    } finally {
      setAssigningLeads(null);
    }
  };

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch = campaign.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-24 bg-muted rounded" />
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
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground">
            Manage your Instagram DM automation campaigns
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient">
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Campaign</DialogTitle>
              <DialogDescription>
                Set up a new Instagram DM automation campaign.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name</Label>
                <Input
                  id="name"
                  placeholder="My Campaign"
                  value={newCampaign.name}
                  onChange={(e) =>
                    setNewCampaign({ ...newCampaign, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Instagram Account</Label>
                <Select
                  value={newCampaign.instagram_account_id}
                  onValueChange={(value) =>
                    setNewCampaign({
                      ...newCampaign,
                      instagram_account_id: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        @{account.instagram_username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Post URLs to Scrape</Label>
                <Textarea
                  placeholder="https://instagram.com/p/xxxxx&#10;https://instagram.com/p/yyyyy"
                  rows={4}
                  value={newCampaign.scrape_urls}
                  onChange={(e) =>
                    setNewCampaign({
                      ...newCampaign,
                      scrape_urls: e.target.value,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Paste Instagram post URLs, one per line
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Use AI Messages</Label>
                  <p className="text-xs text-muted-foreground">
                    Generate personalized messages with AI
                  </p>
                </div>
                <Switch
                  checked={newCampaign.use_ai}
                  onCheckedChange={(checked) =>
                    setNewCampaign({ ...newCampaign, use_ai: checked })
                  }
                />
              </div>
              {!newCampaign.use_ai && (
                <div className="space-y-2">
                  <Label>Message Template</Label>
                  <Textarea
                    placeholder="Hey {{name}}! I saw you liked..."
                    rows={3}
                    value={newCampaign.message_template}
                    onChange={(e) =>
                      setNewCampaign({
                        ...newCampaign,
                        message_template: e.target.value,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Use {"{{name}}"} to personalize with their name
                  </p>
                </div>
              )}
              
              {/* Schedule Section */}
              <div className="border-t pt-4 space-y-4">
                <div>
                  <Label className="text-base font-semibold">Sending Schedule</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Configure how many DMs to send per session
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>DMs per Session</Label>
                    <Select
                      value={String(newCampaign.dms_per_session)}
                      onValueChange={(value) =>
                        setNewCampaign({ ...newCampaign, dms_per_session: parseInt(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 DMs</SelectItem>
                        <SelectItem value="10">10 DMs</SelectItem>
                        <SelectItem value="15">15 DMs</SelectItem>
                        <SelectItem value="20">20 DMs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Sessions per Day</Label>
                    <Select
                      value={String(newCampaign.sessions_per_day)}
                      onValueChange={(value) =>
                        setNewCampaign({ ...newCampaign, sessions_per_day: parseInt(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 sessions</SelectItem>
                        <SelectItem value="10">10 sessions</SelectItem>
                        <SelectItem value="15">15 sessions</SelectItem>
                        <SelectItem value="20">20 sessions</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Schedule Summary */}
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 border border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {newCampaign.dms_per_session * newCampaign.sessions_per_day} DMs per day
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {newCampaign.dms_per_session} messages × {newCampaign.sessions_per_day} sessions/day
                      </p>
                    </div>
                  </div>
                  {leadStats.unassigned > 0 && newCampaign.assign_all_leads && (
                    <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-primary/10">
                      📊 At this rate, {leadStats.unassigned} leads will take ~{Math.ceil(leadStats.unassigned / (newCampaign.dms_per_session * newCampaign.sessions_per_day))} days to complete
                    </p>
                  )}
                </div>
              </div>

              {/* Assign Leads Section */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Assign All Available Leads</Label>
                    <p className="text-xs text-muted-foreground">
                      {leadStats.unassigned > 0 
                        ? `${leadStats.unassigned} unassigned leads will be added to this campaign`
                        : "No unassigned leads available"}
                    </p>
                  </div>
                  <Switch
                    checked={newCampaign.assign_all_leads}
                    onCheckedChange={(checked) =>
                      setNewCampaign({ ...newCampaign, assign_all_leads: checked })
                    }
                    disabled={leadStats.unassigned === 0}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="gradient"
                onClick={handleCreateCampaign}
                disabled={!newCampaign.name || !newCampaign.instagram_account_id}
              >
                Create Campaign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campaigns</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Campaign List */}
      {filteredCampaigns.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Target className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No campaigns found</h3>
            <p className="text-muted-foreground mb-6">
              {campaigns.length === 0
                ? "Create your first campaign to start automating Instagram DMs."
                : "No campaigns match your search criteria."}
            </p>
            {campaigns.length === 0 && (
              <Button
                variant="gradient"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredCampaigns.map((campaign, i) => (
            <motion.div
              key={campaign.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="hover:border-primary/30 transition-colors">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div
                        className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
                          campaign.status === "active"
                            ? "bg-green-500/20"
                            : "bg-muted"
                        }`}
                      >
                        {campaign.status === "active" ? (
                          <Play className="h-5 w-5 text-green-500" />
                        ) : (
                          <Pause className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold">
                            {campaign.name}
                          </h3>
                          <Badge
                            variant={
                              campaign.status === "active"
                                ? "success"
                                : campaign.status === "completed"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {campaign.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          @{campaign.instagram_username}
                        </p>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MessageCircle className="h-4 w-4" />
                            {campaign.total_dms_sent} DMs sent
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {campaign.leads_count || 0} leads
                          </div>
                          {campaign.last_run_at && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              Last run:{" "}
                              {new Date(campaign.last_run_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleStatus(campaign)}
                      >
                        {campaign.status === "active" ? (
                          <>
                            <Pause className="h-4 w-4 mr-2" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Start
                          </>
                        )}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleAssignLeads(campaign.id)}
                            disabled={assigningLeads === campaign.id || leadStats.unassigned === 0}
                          >
                            {assigningLeads === campaign.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <UserPlus className="h-4 w-4 mr-2" />
                            )}
                            Assign {leadStats.unassigned} Leads
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Campaign
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteCampaign(campaign.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Campaign
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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



