// dropicture/app/frontend/src/app/layout.tsx
import type { Metadata } from "next";
import { Roboto_Flex } from "next/font/google";
import "../globals.css";

const font = Roboto_Flex({
  subsets: ["latin"],
});

const TITLE = "Dropicture — Your photos, on your terms";
const DESCRIPTION =
  "Free, open source photo storage and sharing, hosted in Europe. No ads, no trackers, one essential cookie — or self-host it anywhere. Your photos stay yours.";

export const metadata: Metadata = {
  metadataBase: new URL("https://dropicture.com"),
  title: {
    default: TITLE,
    template: "%s — Dropicture",
  },
  description: DESCRIPTION,
  alternates: { canonical: "https://dropicture.com" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://dropicture.com",
    siteName: "Dropicture",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" style={{ overscrollBehavior: 'none', height: '100%' }}>
      <body
        className={`${font.className} scroll-smooth overscroll-none`}
        style={{ overscrollBehavior: 'none' }}
      >
        {children}
      </body>
    </html>
  );
}