"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { DollarSign, Send, Loader2, Check, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";

export default function AffiliatePage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    phone: "",
    instagram: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.instagram) {
      toast({
        title: "Missing Information",
        description: "Please fill in at least your email and Instagram handle.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    // Simulate submission - in production, you'd send this to your backend
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    setLoading(false);
    setSubmitted(true);
    
    toast({
      title: "Application Submitted! 🎉",
      description: "We'll review your application and get back to you within 24-48 hours.",
    });
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 mb-6 shadow-lg shadow-emerald-500/25">
          <DollarSign className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold mb-3">
          Become an <span className="neon-gradient">Affiliate</span>
        </h1>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
          <Sparkles className="h-5 w-5 text-emerald-400" />
          <span className="text-xl font-bold text-emerald-400">50% Commission</span>
          <Sparkles className="h-5 w-5 text-emerald-400" />
        </div>
        <p className="text-muted-foreground max-w-md mx-auto">
          Earn 50% recurring commission for every customer you refer. 
          Share your unique link and get paid every month they stay subscribed.
        </p>
      </motion.div>

      {/* Application Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-white/10 bg-black/40 backdrop-blur-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">Apply to Join</CardTitle>
            <CardDescription>
              Fill out the form below and we&apos;ll get back to you shortly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 mb-4">
                  <Check className="h-8 w-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Application Received!</h3>
                <p className="text-muted-foreground">
                  We&apos;ll review your application and reach out to you within 24-48 hours via email or Instagram DM.
                </p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-white/5 border-white/10 focus:border-emerald-500/50"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="bg-white/5 border-white/10 focus:border-emerald-500/50"
                  />
                  <p className="text-xs text-muted-foreground">Optional - for faster communication</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instagram">Instagram Handle *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                    <Input
                      id="instagram"
                      type="text"
                      placeholder="yourhandle"
                      value={formData.instagram}
                      onChange={(e) => setFormData({ ...formData, instagram: e.target.value.replace("@", "") })}
                      className="pl-8 bg-white/5 border-white/10 focus:border-emerald-500/50"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit Application
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Benefits */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {[
          { title: "50% Commission", desc: "On every payment, recurring" },
          { title: "30-Day Cookie", desc: "Referrals tracked for 30 days" },
          { title: "Monthly Payouts", desc: "Paid via PayPal or Stripe" },
        ].map((item, i) => (
          <div
            key={i}
            className="text-center p-4 rounded-xl bg-white/5 border border-white/10"
          >
            <p className="font-semibold text-emerald-400">{item.title}</p>
            <p className="text-sm text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

