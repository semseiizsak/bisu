import type { Metadata, Viewport } from "next";
import { inter, reading } from "@/lib/fonts";
import { SplashScreen } from "@/components/SplashScreen";
import { MotionProvider } from "@/components/MotionProvider";
import { AppUpdateWatcher } from "@/components/AppUpdateWatcher";
import "./globals.css";

export const metadata: Metadata = {
  title: "Biblia Mastery",
  description: "A teljes Biblia tényanyaga egy év alatt, spaced repetition segítségével.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Biblia Mastery",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#14130f" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hu" className={`${inter.variable} ${reading.variable} h-full antialiased`}>
      <body className="min-h-dvh flex flex-col bg-paper text-ink">
        <MotionProvider>
          <AppUpdateWatcher />
          <SplashScreen />
          {children}
        </MotionProvider>
      </body>
    </html>
  );
}
