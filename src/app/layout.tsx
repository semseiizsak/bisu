import type { Metadata, Viewport } from "next";
import { inter, reading } from "@/lib/fonts";
import { SplashScreen } from "@/components/SplashScreen";
import { MotionProvider } from "@/components/MotionProvider";
import { AppUpdateWatcher } from "@/components/AppUpdateWatcher";
import "./globals.css";

// Keep in sync with STARTUP_DEVICES in scripts/gen-icons.mjs — iOS only
// uses a launch image whose dimensions exactly match the device.
const STARTUP_DEVICES = [
  { w: 440, h: 956, dpr: 3 },
  { w: 430, h: 932, dpr: 3 },
  { w: 428, h: 926, dpr: 3 },
  { w: 414, h: 896, dpr: 3 },
  { w: 414, h: 896, dpr: 2 },
  { w: 402, h: 874, dpr: 3 },
  { w: 393, h: 852, dpr: 3 },
  { w: 390, h: 844, dpr: 3 },
  { w: 375, h: 812, dpr: 3 },
];

const startupMedia = (d: { w: number; h: number; dpr: number }) =>
  `screen and (orientation: portrait) and (device-width: ${d.w}px) and (device-height: ${d.h}px) and (-webkit-device-pixel-ratio: ${d.dpr})`;

// Dark variants first (their media query is stricter); scheme-less light
// entries follow as the fallback for the same device.
const startupImage = [
  ...STARTUP_DEVICES.map((d) => ({
    url: `/splash/${d.w}x${d.h}@${d.dpr}x-dark.png`,
    media: `${startupMedia(d)} and (prefers-color-scheme: dark)`,
  })),
  ...STARTUP_DEVICES.map((d) => ({
    url: `/splash/${d.w}x${d.h}@${d.dpr}x-light.png`,
    media: startupMedia(d),
  })),
];

export const metadata: Metadata = {
  title: "Biblia Mastery",
  description: "A teljes Biblia tényanyaga egy év alatt, spaced repetition segítségével.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Biblia Mastery",
    startupImage,
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
