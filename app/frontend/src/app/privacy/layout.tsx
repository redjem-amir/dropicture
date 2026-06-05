// dropicture/app/frontend/src/app/privacy/layout.tsx
import type { Metadata } from "next";

const TITLE = "Privacy Policy — Dropicture";
const DESCRIPTION =
    "How Dropicture handles your data: EU hosting, no ads, no trackers, a single essential cookie, and your GDPR rights explained.";

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "https://dropicture.com/privacy" },
    robots: { index: true, follow: true },
    openGraph: {
        type: "website",
        locale: "en_US",
        url: "https://dropicture.com/privacy",
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