// dropicture/app/frontend/src/app/auth/layout.tsx
import LayoutPrivate from "@/components/LayoutPrivate";
import { UserProvider } from "@/components/UserProvider";
import { getSession } from "@/lib/session";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "My photos",
    description:
        "Your private Dropicture space: upload, organize and share your photos.",
    robots: {
        index: false,
        follow: false,
        nocache: true,
    },
};

export default async function AuthLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    const session = await getSession();
    return (
        <UserProvider
            initialSessionUser={session?.user ?? null}
            initialAccessTokenExpiresAt={session?.accessExpiresAt}
        >
            <LayoutPrivate>{children}</LayoutPrivate>
        </UserProvider>
    );
}