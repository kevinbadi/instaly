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

export const PRICING_TIERS = {
  starter: {
    name: "Starter",
    price: 99,
    dmsPerMonth: 6000,
    dmsPerDay: 200,
    accounts: 1,
    features: [
      "1 Instagram Account",
      "6,000 DMs/month",
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
    dmsPerMonth: 15000,
    dmsPerDay: 500,
    accounts: 3,
    features: [
      "3 Instagram Accounts",
      "15,000 DMs/month",
      "500 DMs/day",
      "AI-Powered Messages",
      "Advanced Lead Scraping",
      "Priority Support",
      "Custom Templates",
      "Detailed Analytics",
    ],
  },
  scale: {
    name: "Scale",
    price: 399,
    dmsPerMonth: 30000,
    dmsPerDay: 1000,
    accounts: 5,
    features: [
      "5 Instagram Accounts",
      "30,000 DMs/month",
      "1,000 DMs/day",
      "AI-Powered Messages",
      "Unlimited Lead Scraping",
      "Dedicated Support",
      "Custom Templates",
      "API Access",
      "White-Label Options",
    ],
  },
} as const;



