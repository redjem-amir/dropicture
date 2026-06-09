// dropicture/app/frontend/src/app/terms/layout.tsx
import type { Metadata } from "next";

const TITLE = "Terms of Service · Dropicture";
const DESCRIPTION =
    "The terms that govern dropicture.com: a free, open source photo service. Your content stays yours — plain words, fair terms.";

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "https://dropicture.com/terms" },
    robots: { index: true, follow: true },
    openGraph: {
        type: "website",
        locale: "en_US",
        url: "https://dropicture.com/terms",
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