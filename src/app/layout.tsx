import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers/providers";

import "allotment/dist/style.css";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Polaris - AI-Powered Project Management",
    template: "%s | Polaris",
  },
  description:
    "Modern project management platform with AI-powered code editing, real-time collaboration, and intelligent suggestions. Build, organize, and manage your projects with VS Code-style editing experience.",
  keywords: [
    "project management",
    "AI code editor",
    "real-time collaboration",
    "code suggestions",
    "web IDE",
    "developer tools",
  ],
  authors: [{ name: "Polaris Team" }],
  creator: "Polaris",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Polaris",
    title: "Polaris - AI-Powered Project Management",
    description:
      "Modern project management platform with AI-powered code editing and real-time collaboration.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Polaris - AI-Powered Project Management",
    description:
      "Modern project management platform with AI-powered code editing and real-time collaboration.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${plexMono.variable} antialiased`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
