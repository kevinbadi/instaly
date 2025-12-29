"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Zap,
  LayoutDashboard,
  Target,
  Users,
  Link2,
  Settings,
  Menu,
  X,
  LogOut,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Dynamic import to avoid SSR issues with THREE.js
const AnimatedShaderBackground = dynamic(
  () => import("@/components/ui/animated-shader-background"),
  { ssr: false }
);

const sidebarLinks = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/campaigns", icon: Target, label: "Campaigns" },
  { href: "/leads", icon: Users, label: "Leads" },
  { href: "/connect", icon: Link2, label: "Connect Instagram" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setIsLoading(false);
    };
    getUser();
  }, [supabase.auth]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "U";

  // Show loading screen while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <AnimatedShaderBackground />
        <div className="text-center relative z-10">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-white/10 border-t-emerald-500 animate-spin mx-auto" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Zap className="h-6 w-6 text-emerald-500" />
            </div>
          </div>
          <p className="text-white/60 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative">
      {/* Animated shader background */}
      <AnimatedShaderBackground />
      
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 neon-gradient-bg rounded-lg flex items-center justify-center shadow-neon-sm">
              <Zap className="h-5 w-5 text-black" />
            </div>
            <span className="text-xl font-bold neon-gradient">Instaly</span>
          </Link>
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8 border border-neon-500/30">
                    <AvatarFallback className="bg-neon-500/10 text-neon-400 text-sm font-semibold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-dark-700 border-dark-200">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-silver-100">{user?.user_metadata?.full_name || "User"}</span>
                    <span className="text-xs text-silver-500 font-normal">
                      {user?.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-dark-200" />
                <DropdownMenuItem asChild className="text-silver-300 hover:text-silver-100 hover:bg-dark-500">
                  <Link href="/settings">
                    <User className="h-4 w-4 mr-2" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="text-red-400 hover:text-red-300 hover:bg-dark-500">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-silver-400 hover:text-silver-100"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-dark-950 pt-16">
          <nav className="p-4 space-y-2">
            {sidebarLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                  pathname === link.href
                    ? "bg-neon-500/10 text-neon-400 border border-neon-500/20"
                    : "text-silver-500 hover:text-silver-100 hover:bg-dark-700"
                )}
              >
                <link.icon className="h-5 w-5" />
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col border-r border-white/10 bg-black/90 backdrop-blur-xl z-40">
        <div className="flex h-16 items-center gap-2 px-6 border-b border-white/10">
          <div className="h-8 w-8 neon-gradient-bg rounded-lg flex items-center justify-center shadow-neon-sm">
            <Zap className="h-5 w-5 text-black" />
          </div>
          <span className="text-xl font-bold neon-gradient">Instaly</span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {sidebarLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                pathname === link.href
                  ? "bg-neon-500/10 text-neon-400 border border-neon-500/20 shadow-neon-sm"
                  : "text-silver-500 hover:text-silver-100 hover:bg-dark-700 border border-transparent"
              )}
            >
              <link.icon className={cn(
                "h-5 w-5",
                pathname === link.href ? "text-neon-400" : ""
              )} />
              <span className="font-medium">{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-dark-200">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 px-4 py-3 w-full rounded-lg hover:bg-dark-700 transition-all duration-200 border border-transparent hover:border-dark-200">
                <Avatar className="h-9 w-9 border border-neon-500/30">
                  <AvatarFallback className="bg-neon-500/10 text-neon-400 text-sm font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium truncate text-silver-100">
                    {user?.user_metadata?.full_name || "User"}
                  </p>
                  <p className="text-xs text-silver-500 truncate">
                    {user?.email}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-dark-700 border-dark-200">
              <DropdownMenuItem asChild className="text-silver-300 hover:text-silver-100 hover:bg-dark-500">
                <Link href="/settings">
                  <User className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-dark-200" />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-400 hover:text-red-300 hover:bg-dark-500">
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64 pt-16 lg:pt-0 min-h-screen relative z-10">
        <div className="container py-8 px-4 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
