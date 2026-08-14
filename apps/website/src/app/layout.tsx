// dropicture/apps/website/src/app/layout.tsx
import type { Metadata } from "next";
import { Roboto_Flex } from "next/font/google";
import "../globals.css";
import LayoutPublic from "../components/LayoutPublic";

const font = Roboto_Flex({
  subsets: ["latin"],
  display: "swap",
});

const SITE = process.env.NEXT_PUBLIC_WEBSITE_URL ?? "https://dropicture.com";

const HEADLINE = "Dropicture · Galeries photo et vidéo";

const PITCH =
  "Découvre les galeries publiées par la communauté Dropicture. Photographes, illustrateurs, curieux : chacun garde sa bibliothèque privée et expose ce qu’il choisit.";

const PITCH_SHORT =
  "Découvre les galeries publiées par la communauté. Garde ta bibliothèque privée, montre ce que tu choisis.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  applicationName: "Dropicture",
  title: {
    default: HEADLINE,
    template: "%s · Dropicture",
  },
  description: PITCH,
  authors: [{ name: "Dropicture", url: SITE }],
  creator: "Dropicture",
  publisher: "Dropicture",
  category: "photography",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName: "Dropicture",
    title: HEADLINE,
    description: PITCH_SHORT,
  },
  twitter: {
    card: "summary_large_image",
    title: HEADLINE,
    description: PITCH_SHORT,
  },
  icons: {
    icon: "/favicon.ico",
  },
  formatDetection: { telephone: false, address: false, email: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" style={{ overscrollBehavior: "none", height: "100%" }}>
      <body className={`${font.className} scroll-smooth overscroll-none`}>
        <LayoutPublic>{children}</LayoutPublic>
      </body>
    </html>
  );
}