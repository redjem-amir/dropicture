// dropicture/app/frontend/src/app/auth/archive/layout.tsx
import type { Metadata } from "next";

const TITLE = "Archive · Dropicture";
const DESCRIPTION = "Photos hidden from your timeline kept, never deleted.";

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "https://dropicture.com/auth/archive" },
    robots: { index: false, follow: false },
    openGraph: {
        type: "website",
        locale: "en_US",
        url: "https://dropicture.com/auth/archive",
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