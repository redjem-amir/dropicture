// dropicture/app/frontend/src/app/layout.tsx
import type { Metadata } from "next";
import { Roboto_Flex } from "next/font/google";
import "../globals.css";

const font = Roboto_Flex({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "",
  description: "",
  alternates: { canonical: "https://dropicture.com" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://dropicture.com",
    siteName: "Dropicture",
    title: "",
    description: "",
  },
  twitter: {
    card: "summary",
    title: "",
    description: "",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ overscrollBehavior: 'none', height: '100%' }}>
      <body className={`${font.className} scroll-smooth overscroll-none`} style={{ overscrollBehavior: 'none' }}>
        {children}
      </body>
    </html>
  );
}
