// dropicture/app/frontend/src/app/auth/favorites/layout.tsx
import type { Metadata } from "next";

const TITLE = "Favorites · Dropicture";
const DESCRIPTION = "The photos you marked with a heart.";

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "https://dropicture.com/auth/favorites" },
    robots: { index: false, follow: false },
    openGraph: {
        type: "website",
        locale: "en_US",
        url: "https://dropicture.com/auth/favorites",
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