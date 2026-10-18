import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Montserrat } from "next/font/google";
import { Toaster } from "react-hot-toast";
import ClientLayout from "@/components/ClientLayout";
import DynamicFavicon from "@/components/DynamicFavicon";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DOLLAR & Co — POS",
  description: "Point of sale and stock admin panel for the DOLLAR & Co shop.",
  applicationName: "DOLLAR & Co POS",
  // Default icons; DynamicFavicon swaps in the favicon uploaded in Settings.
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={montserrat.variable} suppressHydrationWarning>
      <body className="font-sans antialiased bg-white text-gray-900 min-h-screen" suppressHydrationWarning>
        <Suspense>
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3000,
              style: {
                borderRadius: "10px",
                padding: "12px 20px",
                fontSize: "14px",
                fontWeight: 500,
                boxShadow: "0 8px 30px rgba(0, 0, 0, 0.12)",
              },
              success: { iconTheme: { primary: "#10b981", secondary: "#fff" } },
              error: { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
            }}
          />
          <DynamicFavicon />
          <ClientLayout>{children}</ClientLayout>
        </Suspense>
      </body>
    </html>
  );
}
