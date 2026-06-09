// dropicture/app/frontend/src/app/about/layout.tsx
import type { Metadata } from "next";

const TITLE = "About";
const OG_TITLE = "About · Dropicture";
const DESCRIPTION =
    "Why Dropicture exists: an independent, open source alternative for storing photos without giving up privacy or ownership.";

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "https://dropicture.com/about" },
    robots: { index: true, follow: true },
    openGraph: {
        type: "website",
        locale: "en_US",
        url: "https://dropicture.com/about",
        siteName: "Dropicture",
        title: OG_TITLE,
        description: DESCRIPTION,
    },
    twitter: {
        card: "summary",
        title: OG_TITLE,
        description: DESCRIPTION,
    },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}