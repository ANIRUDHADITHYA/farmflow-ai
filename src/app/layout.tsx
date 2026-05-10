import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/navigation/BottomNav";
import ClientLayout from "@/components/splash/ClientLayout";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "FarmFlow AI — Smart Farm Management",
  description:
    "AI-powered farm management platform. Track treatments, inventory, invoices, and more with a conversational assistant.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FarmFlow AI",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1B6B4A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col bg-background text-foreground font-sans">
        <ClientLayout>
          <main className="flex-1 overflow-y-auto pb-24">{children}</main>
          <BottomNav />
        </ClientLayout>
      </body>
    </html>
  );
}
