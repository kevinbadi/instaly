import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

// Price IDs are loaded from environment variables (NEXT_PUBLIC_ for client-side access)
export const PRICING_TIERS = {
  starter: {
    name: "Starter",
    price: 99,
    dmsPerMonth: 6000,
    dmsPerDay: 200,
    accounts: 1,
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || "",
    features: [
      "1 Instagram Account",
      "200 DMs/day",
      "AI-Powered Messages",
      "Lead Scraping",
      "Campaign Analytics",
      "Email Support",
    ],
  },
  growth: {
    name: "Growth",
    price: 199,
    dmsPerMonth: 18000,
    dmsPerDay: 600,
    accounts: 3,
    priceId: process.env.NEXT_PUBLIC_STRIPE_GROWTH_PRICE_ID || "",
    popular: true,
    features: [
      "3 Instagram Accounts",
      "600 DMs/day (200 per account)",
      "AI-Powered Messages",
      "Advanced Lead Scraping",
      "Priority Support",
      "Campaign Analytics",
    ],
  },
  scale: {
    name: "Scale",
    price: 499,
    dmsPerMonth: 60000,
    dmsPerDay: 2000,
    accounts: 10,
    priceId: "", // Coming soon
    comingSoon: true,
    features: [
      "10 Instagram Accounts",
      "2,000 DMs/day (200 per account)",
      "AI-Powered Messages",
      "Unlimited Lead Scraping",
      "Dedicated Support",
      "API Access",
      "Custom Integrations",
    ],
  },
};



