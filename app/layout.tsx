import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PWARegister from "../components/PWARegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Lock the screen so it doesn't scatter or zoom on mobile
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#2563EB', // The blue branding color for the status bar
};

// THE PWA META TAGS
export const metadata: Metadata = {
  title: "CampusCheck",
  description: "Geofenced campus verification system",
  manifest: "/manifest.json", 
  appleWebApp: {
    capable: true, // Tells iOS "Treat this as a real app, hide Safari UI"
    title: "CampusCheck",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Boot the PWA Engine in the background */}
        <PWARegister />
        {children}
      </body>
    </html>
  );
}