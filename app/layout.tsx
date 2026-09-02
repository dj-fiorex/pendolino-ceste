import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Source_Sans_3 } from "next/font/google";
import type { ReactNode } from "react";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { getToken } from "@/lib/auth-server";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
});

export const metadata: Metadata = {
  title: "Pendolino Ceste",
  description: "Le Ceste del frantoio: chi le ha e dove sono.",
  applicationName: "Pendolino Ceste",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Pendolino",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1f18" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Handing the session token to the client on the first render keeps a
  // signed-in device from flashing the sign-in screen on every reload.
  const initialToken = (await getToken()) ?? null;

  return (
    <html lang="it">
      <body
        className={`${bricolage.variable} ${sourceSans.variable} font-sans antialiased`}
      >
        <ConvexClientProvider initialToken={initialToken}>
          {children}
        </ConvexClientProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
