"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap, Mail, Lock, User, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues with THREE.js
const AnimatedShaderBackground = dynamic(
  () => import("@/components/ui/animated-shader-background"),
  { ssr: false }
);

export default function SignUpPage() {
  const router = useRouter();
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const supabase = createClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Properly construct the callback URL with redirect to dashboard
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("redirectTo", "/dashboard");
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
          emailRedirectTo: callbackUrl.toString(),
        },
      });

      if (error) {
        toast({
          title: "Sign up failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setEmailSent(true);
      toast({
        title: "Check your email",
        description: "We've sent you a confirmation link to verify your account.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950 px-4 relative overflow-hidden">
        <AnimatedShaderBackground />
        <div className="absolute inset-0 bg-dark-950/60 z-[1]" />
        
        <Card className="w-full max-w-md relative z-10 text-center border-dark-200/50 bg-dark-900/90 backdrop-blur-xl shadow-2xl">
          <CardHeader>
            <div className="mx-auto h-16 w-16 rounded-full bg-neon-500/10 flex items-center justify-center mb-4 border border-neon-500/30 shadow-neon-sm">
              <CheckCircle2 className="h-8 w-8 text-neon-400" />
            </div>
            <CardTitle className="text-2xl text-silver-100">Check your email</CardTitle>
            <CardDescription className="text-silver-500">
              We&apos;ve sent a confirmation link to <strong className="text-neon-400">{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-silver-500 mb-6">
              Click the link in the email to verify your account and get started.
            </p>
            <Button variant="outline" onClick={() => setEmailSent(false)}>
              Use a different email
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 px-4 relative overflow-hidden">
      {/* Animated shader background */}
      <AnimatedShaderBackground />
      
      {/* Dark overlay for better readability */}
      <div className="absolute inset-0 bg-dark-950/60 z-[1]" />
      
      <Card className="w-full max-w-md relative z-10 border-dark-200/50 bg-dark-900/90 backdrop-blur-xl shadow-2xl">
        <CardHeader className="text-center">
          <Link href="/" className="flex items-center justify-center gap-2 mb-4">
            <div className="h-10 w-10 neon-gradient-bg rounded-xl flex items-center justify-center shadow-neon-sm animate-float">
              <Zap className="h-6 w-6 text-black" />
            </div>
            <span className="text-2xl font-bold neon-gradient">Instaly</span>
          </Link>
          <CardTitle className="text-2xl text-silver-100">Create your account</CardTitle>
          <CardDescription className="text-silver-500">
            Start automating your Instagram DMs today
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-silver-300">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-silver-600" />
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10 bg-dark-700/80 border-dark-300 text-silver-100 placeholder:text-silver-600 focus:border-neon-500 focus:ring-neon-500/20"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-silver-300">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-silver-600" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-dark-700/80 border-dark-300 text-silver-100 placeholder:text-silver-600 focus:border-neon-500 focus:ring-neon-500/20"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-silver-300">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-silver-600" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-dark-700/80 border-dark-300 text-silver-100 placeholder:text-silver-600 focus:border-neon-500 focus:ring-neon-500/20"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-silver-600 hover:text-silver-300"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-silver-600">
                Must be at least 8 characters
              </p>
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
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-silver-500 mt-6">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-neon-400 hover:text-neon-300 hover:underline font-medium">
              Sign in
            </Link>
          </p>

          <p className="text-center text-xs text-silver-600 mt-4">
            By signing up, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-silver-400">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-silver-400">
              Privacy Policy
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
