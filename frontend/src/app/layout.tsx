import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Instaly - Instagram DM Automation at Scale",
  description:
    "Automate your Instagram outreach with AI-powered personalized DMs. Connect your account, scrape leads, and watch your engagement grow.",
  keywords: ["Instagram", "DM automation", "lead generation", "outreach", "marketing"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sf antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
