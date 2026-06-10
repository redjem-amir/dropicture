// dropicture/app/frontend/src/app/auth/trash/layout.tsx
import type { Metadata } from "next";

const TITLE = "Trash · Dropicture";
const DESCRIPTION = "Deleted photos, kept for 30 days before they are removed for good.";

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "https://dropicture.com/auth/trash" },
    robots: { index: false, follow: false },
    openGraph: {
        type: "website",
        locale: "en_US",
        url: "https://dropicture.com/auth/trash",
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