"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  CheckCircle2,
  Instagram,
  MessageCircle,
  Sparkles,
  Target,
  Users,
  Zap,
  BarChart3,
  Shield,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PRICING_TIERS } from "@/lib/utils";
import { ActivityHeatmap } from "@/components/ui/activity-heatmap";

// Generate demo data for the landing page activity heatmap
// Simulates a power user's full year of DM automation
function generateDemoActivityData() {
  const data: { date: string; count: number }[] = [];
  const today = new Date();
  
  for (let i = 364; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Create realistic patterns:
    // - Weekdays have more activity than weekends
    // - Some random variation
    // - Occasional "burst" days
    // - Some low activity periods
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Base activity: weekdays 150-200, weekends 50-100
    let baseCount = isWeekend 
      ? Math.floor(Math.random() * 50) + 50 
      : Math.floor(Math.random() * 50) + 150;
    
    // Add some burst days (10% chance for weekdays)
    if (!isWeekend && Math.random() < 0.1) {
      baseCount = Math.floor(Math.random() * 50) + 200;
    }
    
    // Add some low activity days (5% chance)
    if (Math.random() < 0.05) {
      baseCount = Math.floor(Math.random() * 30) + 10;
    }
    
    data.push({ date: dateStr, count: baseCount });
  }
  
  return data;
}

const demoActivityData = generateDemoActivityData();

// Dynamic import to avoid SSR issues with THREE.js
const AnimatedShaderBackground = dynamic(
  () => import("@/components/ui/animated-shader-background"),
  { ssr: false }
);

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black relative">
      {/* Animated shader background */}
      <AnimatedShaderBackground />
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="relative h-8 w-8 instagram-gradient-bg rounded-lg flex items-center justify-center">
              <Instagram className="h-5 w-5 text-black" />
            </div>
            <span className="text-xl font-bold instagram-gradient">Instaly</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link
              href="#features"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </Link>
            <Link
              href="#pricing"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              How It Works
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/sign-in">
              <Button variant="ghost" size="sm">
                Log In
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button variant="gradient" size="sm">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container">
          <motion.div
            initial="initial"
            animate="animate"
            variants={stagger}
            className="max-w-4xl mx-auto text-center"
          >
            <motion.div variants={fadeIn}>
              <Badge
                variant="outline"
                className="mb-6 px-4 py-2 text-sm border-primary/30"
              >
                <Sparkles className="h-3.5 w-3.5 mr-2 text-primary" />
                AI-Powered Instagram Outreach
              </Badge>
            </motion.div>

            <motion.h1
              variants={fadeIn}
              className="text-5xl md:text-7xl font-bold tracking-tight mb-6"
            >
              Automate Your{" "}
              <span className="instagram-gradient">Instagram DMs</span>
              <br />
              At Scale
            </motion.h1>

            <motion.p
              variants={fadeIn}
              className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto"
            >
              Connect your account, scrape leads from any post, and let our AI send
              personalized DMs that convert. Send up to 6,000 messages per month on
              autopilot.
            </motion.p>

            <motion.div
              variants={fadeIn}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link href="/sign-up">
                <Button variant="gradient" size="xl" className="group">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button variant="outline" size="xl">
                  See How It Works
                </Button>
              </Link>
            </motion.div>

            <motion.div
              variants={fadeIn}
              className="mt-12 flex items-center justify-center gap-8 text-sm text-muted-foreground"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Cancel anytime
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                24/7 Support
              </div>
            </motion.div>
          </motion.div>

          {/* Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-20 relative"
          >
            <div className="absolute inset-0 instagram-gradient-bg opacity-20 blur-3xl rounded-3xl" />
            <div className="relative glass rounded-2xl p-2 glow">
              <div className="bg-card rounded-xl overflow-hidden border">
                <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/50">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="ml-4 text-sm text-muted-foreground">
                    dashboard.instaly.io
                  </span>
                </div>
                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    {[
                      { label: "DMs Sent Today", value: "187", icon: MessageCircle },
                      { label: "Total Leads", value: "12,453", icon: Users },
                      { label: "Response Rate", value: "23%", icon: BarChart3 },
                      { label: "Active Campaigns", value: "4", icon: Target },
                    ].map((stat, i) => (
                      <div
                        key={i}
                        className="bg-muted/50 rounded-lg p-4 border border-border/50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">
                            {stat.label}
                          </span>
                          <stat.icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="text-2xl font-bold">{stat.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-muted/30 rounded-lg border border-border/50 p-4">
                    <ActivityHeatmap data={demoActivityData} />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="container">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              <Zap className="h-3.5 w-3.5 mr-2" />
              Powerful Features
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              Everything You Need to{" "}
              <span className="instagram-gradient">Scale Your Outreach</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              From lead scraping to AI-powered messaging, we&apos;ve got you covered
              with a complete automation suite.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Target,
                title: "Smart Lead Scraping",
                description:
                  "Automatically scrape users who liked, commented, or followed from any Instagram post.",
              },
              {
                icon: Sparkles,
                title: "AI-Powered Messages",
                description:
                  "Our AI crafts personalized DMs based on each lead's profile, bio, and content.",
              },
              {
                icon: Clock,
                title: "24/7 Automation",
                description:
                  "Set it and forget it. Our worker runs continuously to send messages at optimal times.",
              },
              {
                icon: Shield,
                title: "Safe & Undetectable",
                description:
                  "Human-like delays and patterns keep your account safe from Instagram's detection.",
              },
              {
                icon: BarChart3,
                title: "Detailed Analytics",
                description:
                  "Track opens, responses, and conversions with our comprehensive dashboard.",
              },
              {
                icon: Users,
                title: "Multi-Account Support",
                description:
                  "Manage multiple Instagram accounts from a single dashboard with ease.",
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="h-full bg-card/50 border-border/50 hover:border-primary/30 transition-colors">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl instagram-gradient-bg flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-black" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              Simple Process
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              Get Started in{" "}
              <span className="instagram-gradient">3 Easy Steps</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: "01",
                title: "Connect Your Account",
                description:
                  "Securely link your Instagram account through our safe browser-based login.",
              },
              {
                step: "02",
                title: "Set Up Your Campaign",
                description:
                  "Paste post URLs to scrape leads from, customize your message template or enable AI.",
              },
              {
                step: "03",
                title: "Watch It Work",
                description:
                  "Sit back while our automation sends personalized DMs to your leads 24/7.",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="text-8xl font-bold text-primary/10 absolute -top-8 left-0">
                  {item.step}
                </div>
                <div className="relative pt-12">
                  <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4">
        <div className="container">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              Simple Pricing
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              Choose Your{" "}
              <span className="instagram-gradient">Growth Plan</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Transparent pricing with no hidden fees. Cancel anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {Object.entries(PRICING_TIERS).map(([key, tier], i) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
              >
                <Card
                  className={`h-full relative ${
                    key === "growth"
                      ? "border-primary glow-sm"
                      : "border-border/50"
                  }`}
                >
                  {key === "growth" && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge variant="default" className="instagram-gradient-bg">
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
                      {tier.dmsPerMonth.toLocaleString()} DMs/month
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {tier.features.map((feature, j) => (
                        <li key={j} className="flex items-start gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href="/sign-up" className="block mt-6">
                      <Button
                        variant={key === "growth" ? "gradient" : "outline"}
                        className="w-full"
                        size="lg"
                      >
                        Get Started
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative max-w-4xl mx-auto"
          >
            <div className="absolute inset-0 instagram-gradient-bg opacity-20 blur-3xl rounded-3xl" />
            <div className="relative glass rounded-2xl p-12 text-center glow">
              <h2 className="text-4xl font-bold mb-4">
                Ready to Scale Your Instagram Outreach?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                Join thousands of marketers who are growing their business with
                automated, AI-powered Instagram DMs.
              </p>
              <Link href="/sign-up">
                <Button variant="gradient" size="xl" className="group">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 px-4">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 instagram-gradient-bg rounded-lg flex items-center justify-center">
                <Instagram className="h-5 w-5 text-black" />
              </div>
              <span className="text-xl font-bold instagram-gradient">Instaly</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 Instaly. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link
                href="/privacy"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Terms
              </Link>
              <Link
                href="/support"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Support
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}



