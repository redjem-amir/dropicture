// dropicture/app/frontend/src/app/signup/layout.tsx
import type { Metadata } from "next";

const TITLE = "Create your account — Dropicture";
const DESCRIPTION =
  "Create a free Dropicture account in a few steps. Open source photo storage hosted in Europe — your photos, on your terms.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://dropicture.com/signup" },
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://dropicture.com/signup",
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

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}