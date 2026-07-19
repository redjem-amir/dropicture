// dropicture/apps/website/src/app/u/page.tsx
import type { Metadata } from 'next';
import { Suspense } from 'react';
import PublicProfile from '../../components/PublicProfile';

export const metadata: Metadata = {
  title: 'Profil',
  description:
    'Découvrez les photos et galeries publiques partagées sur Dropicture. Chacun garde sa bibliothèque privée et expose ce qu’il choisit.',
  robots: { index: false, follow: true },
};

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-16 sm:px-6" />}>
      <PublicProfile />
    </Suspense>
  );
}
