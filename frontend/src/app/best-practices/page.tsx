"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Instagram,
  Shield,
  Clock,
  MessageCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  Users,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

export default function BestPracticesPage() {
  return (
    <div className="min-h-screen bg-black">
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
              href="/#features"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </Link>
            <Link
              href="/#pricing"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/best-practices"
              className="text-sm text-foreground font-medium transition-colors"
            >
              Best Practices
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
      <section className="pt-32 pb-16 px-4">
        <div className="container">
          <motion.div
            initial="initial"
            animate="animate"
            variants={stagger}
            className="max-w-4xl mx-auto"
          >
            <motion.div variants={fadeIn}>
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Link>
            </motion.div>

            <motion.div variants={fadeIn} className="text-center">
              <Badge
                variant="outline"
                className="mb-6 px-4 py-2 text-sm border-primary/30"
              >
                <Shield className="h-3.5 w-3.5 mr-2 text-primary" />
                Keep Your Account Safe
              </Badge>
            </motion.div>

            <motion.h1
              variants={fadeIn}
              className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-center"
            >
              Instaly{" "}
              <span className="instagram-gradient">Best Practices</span>
            </motion.h1>

            <motion.p
              variants={fadeIn}
              className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto text-center"
            >
              Follow these guidelines to maximize your results while keeping your
              Instagram account safe and in good standing.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Warning Banner */}
      <section className="px-4 pb-12">
        <div className="container max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6"
          >
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-yellow-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-500 mb-2">
                  Important Notice
                </h3>
                <p className="text-muted-foreground">
                  Instagram has strict policies against automated behavior. While
                  Instaly is designed to mimic human behavior, aggressive usage can
                  still trigger account restrictions. Always start slow and follow
                  the guidelines below to protect your account.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Guidelines */}
      <section className="py-12 px-4">
        <div className="container max-w-4xl">
          <div className="space-y-8">
            {/* Guideline 1 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl instagram-gradient-bg flex items-center justify-center">
                      <Clock className="h-6 w-6 text-black" />
                    </div>
                    <CardTitle className="text-2xl">
                      Start Slow &amp; Warm Up Your Account
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    New accounts or accounts that haven&apos;t used automation before
                    need to be &quot;warmed up&quot; gradually. Jumping straight to high
                    volume will raise red flags.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span className="font-semibold text-green-500">Do</span>
                      </div>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li>Week 1: Send 20-30 DMs per day</li>
                        <li>Week 2: Increase to 50-70 DMs per day</li>
                        <li>Week 3: Gradually reach 100-150 DMs</li>
                        <li>Week 4+: Scale to your plan limit slowly</li>
                      </ul>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <XCircle className="h-5 w-5 text-red-500" />
                        <span className="font-semibold text-red-500">Don&apos;t</span>
                      </div>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li>Send 200+ DMs on day one</li>
                        <li>Run campaigns 24/7 without breaks</li>
                        <li>Ignore warning signs from Instagram</li>
                        <li>Use a brand new account for automation</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Guideline 2 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl instagram-gradient-bg flex items-center justify-center">
                      <MessageCircle className="h-6 w-6 text-black" />
                    </div>
                    <CardTitle className="text-2xl">
                      Write Natural, Personalized Messages
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Generic, spammy messages get reported and hurt your account.
                    Take time to craft messages that feel genuine and provide value.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span className="font-semibold text-green-500">
                          Good Message Example
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground italic">
                        &quot;Hey {"{{name}}"}, I saw you engaged with {"{{source}}"}&apos;s
                        post about fitness tips. I run a community for fitness
                        enthusiasts and thought you might be interested. No
                        pressure, just wanted to share!&quot;
                      </p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <XCircle className="h-5 w-5 text-red-500" />
                        <span className="font-semibold text-red-500">
                          Bad Message Example
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground italic">
                        &quot;BUY NOW!!! 50% OFF LIMITED TIME OFFER!!! Click this link
                        immediately!!! Don&apos;t miss out on this AMAZING deal!!!&quot;
                      </p>
                    </div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Message Tips:</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>
                        • Use the recipient&apos;s name with the {"{{name}}"} variable
                      </li>
                      <li>• Reference where you found them for context</li>
                      <li>• Avoid ALL CAPS and excessive punctuation</li>
                      <li>• Don&apos;t include suspicious links in first message</li>
                      <li>• Create multiple message variations to avoid repetition</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Guideline 3 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl instagram-gradient-bg flex items-center justify-center">
                      <Target className="h-6 w-6 text-black" />
                    </div>
                    <CardTitle className="text-2xl">
                      Target the Right Audience
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Quality over quantity. Targeting relevant users leads to better
                    engagement and fewer spam reports.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span className="font-semibold text-green-500">Do</span>
                      </div>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li>Scrape from posts related to your niche</li>
                        <li>Target engaged users (commenters &gt; likers)</li>
                        <li>Focus on accounts with genuine activity</li>
                        <li>Research your competitors&apos; engaged audience</li>
                      </ul>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <XCircle className="h-5 w-5 text-red-500" />
                        <span className="font-semibold text-red-500">Don&apos;t</span>
                      </div>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li>Message random users with no context</li>
                        <li>Target celebrity accounts with millions of followers</li>
                        <li>Scrape from unrelated viral posts</li>
                        <li>Message the same users repeatedly</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Guideline 4 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl instagram-gradient-bg flex items-center justify-center">
                      <Users className="h-6 w-6 text-black" />
                    </div>
                    <CardTitle className="text-2xl">
                      Maintain Organic Account Activity
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Accounts that only send DMs look suspicious. Keep your account
                    active with regular organic behavior.
                  </p>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <h4 className="font-semibold mb-3">Daily Recommendations:</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-primary" />
                          Post stories regularly (2-3 per day)
                        </li>
                        <li className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-primary" />
                          Like and comment on posts genuinely
                        </li>
                        <li className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-primary" />
                          Reply to comments on your posts
                        </li>
                      </ul>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-primary" />
                          Post content 3-5 times per week
                        </li>
                        <li className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-primary" />
                          Respond to DM replies personally
                        </li>
                        <li className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-primary" />
                          Use Instagram normally between campaigns
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Guideline 5 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl instagram-gradient-bg flex items-center justify-center">
                      <Shield className="h-6 w-6 text-black" />
                    </div>
                    <CardTitle className="text-2xl">
                      Recognize Warning Signs
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Instagram sends signals before taking major action. Pay attention
                    and adjust accordingly.
                  </p>
                  <div className="space-y-4">
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                      <h4 className="font-semibold text-yellow-500 mb-2">
                        Yellow Flags - Slow Down
                      </h4>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        <li>• &quot;Action Blocked&quot; messages appearing</li>
                        <li>• Temporary restrictions on DMs or follows</li>
                        <li>• Unusual captcha challenges</li>
                        <li>• Slower than normal app performance</li>
                      </ul>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                      <h4 className="font-semibold text-red-500 mb-2">
                        Red Flags - Stop Immediately
                      </h4>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        <li>• Account temporarily disabled warnings</li>
                        <li>• Multiple action blocks in one day</li>
                        <li>• Phone verification requests</li>
                        <li>• Email warnings from Instagram</li>
                      </ul>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4">
                      <h4 className="font-semibold mb-2">
                        If You Get Restricted:
                      </h4>
                      <ol className="space-y-1 text-sm text-muted-foreground list-decimal list-inside">
                        <li>Stop all automation immediately</li>
                        <li>Wait 24-48 hours before any activity</li>
                        <li>Use the app normally for a few days</li>
                        <li>When resuming, start at 25% of previous volume</li>
                        <li>Gradually increase over 2-3 weeks</li>
                      </ol>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Quick Reference */}
      <section className="py-12 px-4 bg-muted/30">
        <div className="container max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <h2 className="text-3xl font-bold mb-4">
              Quick <span className="instagram-gradient">Reference Guide</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full bg-card/50 border-border/50">
                <CardHeader className="text-center">
                  <CardTitle className="text-lg">Daily Limits</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>New accounts: 20-50 DMs</li>
                    <li>Warmed accounts: 100-150 DMs</li>
                    <li>Established: Up to 200 DMs</li>
                    <li>Take breaks every 2-3 hours</li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              viewport={{ once: true }}
            >
              <Card className="h-full bg-card/50 border-border/50">
                <CardHeader className="text-center">
                  <CardTitle className="text-lg">Account Age</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>Minimum: 30 days old</li>
                    <li>Ideal: 3+ months old</li>
                    <li>Best: 6+ months with history</li>
                    <li>Must have profile picture &amp; bio</li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              viewport={{ once: true }}
            >
              <Card className="h-full bg-card/50 border-border/50">
                <CardHeader className="text-center">
                  <CardTitle className="text-lg">Best Times</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>Morning: 7-9 AM</li>
                    <li>Lunch: 12-2 PM</li>
                    <li>Evening: 7-9 PM</li>
                    <li>Match your target&apos;s timezone</li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container max-w-4xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="absolute inset-0 instagram-gradient-bg opacity-20 blur-3xl rounded-3xl" />
            <div className="relative glass rounded-2xl p-12 text-center glow">
              <h2 className="text-3xl font-bold mb-4">
                Ready to Get Started Safely?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                Follow these best practices and you&apos;ll be on your way to growing
                your Instagram presence without putting your account at risk.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/sign-up">
                  <Button variant="gradient" size="lg">
                    Get Started
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline" size="lg">
                    Back to Home
                  </Button>
                </Link>
              </div>
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
