// dropicture/app/frontend/src/app/auth/albums/layout.tsx
import type { Metadata } from "next";

const TITLE = "Albums · Dropicture";
const DESCRIPTION = "Organize your photos into albums.";

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "https://dropicture.com/auth/albums" },
    robots: { index: false, follow: false },
    openGraph: {
        type: "website",
        locale: "en_US",
        url: "https://dropicture.com/auth/albums",
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