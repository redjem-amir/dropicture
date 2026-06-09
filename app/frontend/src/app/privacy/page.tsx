// dropicture/app/frontend/src/app/privacy/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import LayoutPublic from '@/components/LayoutPublic'

const TITLE = 'Privacy Policy'
const DESCRIPTION =
    'How dropicture.com handles your data: what we collect, where it lives, how long we keep it, and your GDPR rights. No ads, no trackers, one cookie.'

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: 'https://dropicture.com/privacy' },
    openGraph: {
        type: 'website',
        locale: 'en_US',
        url: 'https://dropicture.com/privacy',
        siteName: 'Dropicture',
        title: `${TITLE} — Dropicture`,
        description: DESCRIPTION,
    },
    twitter: { card: 'summary', title: `${TITLE} — Dropicture`, description: DESCRIPTION },
}

const CONTROLLER = 'Amir Redjem'
const CONTACT_EMAIL = 'privacy@dropicture.com'
const LAST_UPDATED = 'June 5, 2026'

/** Single source of truth: drives section numbers, headings and the TOC. */
const SECTIONS = {
    controller: 'Who is responsible',
    data: 'Data we collect',
    never: 'What we never do',
    legal: 'Legal bases (GDPR)',
    where: 'Where your data lives',
    retention: 'How long we keep things',
    cookies: 'Cookies',
    rights: 'Your rights',
    security: 'Security',
    children: 'Children',
    changes: 'Changes to this policy',
    contact: 'Contact',
} as const

type SectionId = keyof typeof SECTIONS
const SECTION_IDS = Object.keys(SECTIONS) as SectionId[]
const pad = (n: number) => String(n).padStart(2, '0')

function Section({ id, children }: { id: SectionId; children: React.ReactNode }) {
    const n = SECTION_IDS.indexOf(id) + 1
    return (
        <section
            id={id}
            className="mt-8 scroll-mt-24 border-t border-stone-200/70 pt-8 first:mt-0 first:border-t-0"
        >
            <h2 className="flex items-baseline gap-3 text-lg font-semibold tracking-tight text-stone-900">
                <span aria-hidden className="select-none font-mono text-xs font-normal text-stone-300">
                    {pad(n)}
                </span>
                {SECTIONS[id]}
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-stone-600 [&_strong]:font-semibold [&_strong]:text-stone-900">
                {children}
            </div>
        </section>
    )
}

const LINK = 'font-medium text-stone-900 underline-offset-4 hover:underline'

export default function PrivacyPage() {
    return (
        <LayoutPublic
            flip
            decor={
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-120 bg-[linear-gradient(to_right,rgba(28,25,23,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(28,25,23,0.05)_1px,transparent_1px)] bg-size-[56px_56px] mask-[radial-gradient(ellipse_75%_65%_at_50%_0%,#000_50%,transparent_100%)]"
                />
            }
        >
            <div className="relative mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:grid lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-16">
                <article className="min-w-0 max-w-2xl">
                    <p className="font-mono text-xs font-medium uppercase tracking-widest text-stone-400">
                        Legal
                    </p>
                    <h1 className="mt-3 bg-linear-to-b from-stone-900 to-stone-600 bg-clip-text text-4xl font-semibold tracking-tighter text-transparent sm:text-5xl">
                        Privacy Policy
                    </h1>
                    <p className="mt-5 font-mono text-xs text-stone-400">
                        Last updated · {LAST_UPDATED}
                    </p>
                    <p className="mt-5 text-pretty text-base leading-relaxed text-stone-500">
                        Dropicture exists so that your photos stay yours. This policy explains, in plain
                        words, what data the official instance at dropicture.com collects, why, where it
                        lives, and the rights you have over it.
                    </p>
                    <div className="mt-10 border-t border-stone-200/70">
                        <Section id="controller">
                            <p>
                                The data controller for dropicture.com is {CONTROLLER}. For anything related to
                                your data, write to{' '}
                                <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
                                    {CONTACT_EMAIL}
                                </a>
                                .
                            </p>
                            <p>
                                Dropicture is open source software. This policy covers <strong>only</strong> the
                                official instance at dropicture.com — if you use a self-hosted instance, its
                                operator is the controller of your data, not us.
                            </p>
                        </Section>
                        <Section id="data">
                            <p>We collect the minimum needed to run the service:</p>
                            <p>
                                <strong>Account.</strong> First name, last name, email address, and your
                                password — stored only as a salted Argon2id hash, never in plain text. We cannot
                                read your password.
                            </p>
                            <p>
                                <strong>Your content.</strong> The photos and files you upload, stored on our
                                own servers (see section 5).
                            </p>
                            <p>
                                <strong>Sessions &amp; security.</strong> When you sign in we create a
                                server-side session holding a random identifier, your browser&apos;s user-agent,
                                your IP address and a truncated hash of it, and activity timestamps. Sessions
                                live at most 8 hours (30 minutes of inactivity) and are then deleted
                                automatically. Security events (such as suspicious session activity) are written
                                to server logs.
                            </p>
                            <p>
                                <strong>Anti-abuse counters.</strong> Short-lived counters keyed by IP address
                                and email protect sign-up and sign-in against abuse. They expire on their own
                                within 10 to 60 minutes.
                            </p>
                        </Section>
                        <Section id="never">
                            <p>
                                No advertising, no third-party analytics, no trackers, no fingerprinting, no
                                profiling, and no selling, renting or sharing of your data for commercial
                                purposes. We don&apos;t email you except to answer you or for messages strictly
                                necessary to the service.
                            </p>
                        </Section>
                        <Section id="legal">
                            <p>
                                We process your data to <strong>perform our contract</strong> with you
                                (providing your account and storing your photos — Art. 6(1)(b)), out of{' '}
                                <strong>legitimate interest</strong> (keeping the service secure and preventing
                                abuse — Art. 6(1)(f)), and to meet <strong>legal obligations</strong> where they
                                apply (Art. 6(1)(c)).
                            </p>
                        </Section>
                        <Section id="where">
                            <p>
                                Your account data, sessions and photos are stored on servers we operate at{' '}
                                <strong>Hetzner Online GmbH in Falkenstein, Germany (EU)</strong>. They are not
                                replicated outside the European Union.
                            </p>
                            <p>
                                Traffic to dropicture.com transits through <strong>Cloudflare</strong> (DNS,
                                DDoS protection, TLS at the edge), which processes connection data in transit on
                                our behalf. See{' '}
                                <Link
                                    href="https://www.cloudflare.com/privacypolicy/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={LINK}
                                >
                                    Cloudflare&apos;s privacy policy
                                </Link>{' '}
                                for how they handle that data. We have no other processors and no other
                                recipients, unless the law compels us.
                            </p>
                        </Section>
                        <Section id="retention">
                            <p>
                                Account data and photos: for as long as your account exists, then deleted.
                                Sessions: at most 8 hours. Anti-abuse counters: at most 1 hour. Security logs
                                are rotated and kept only briefly. Backups, where present, follow the same logic
                                and are purged on a fixed cycle.
                            </p>
                        </Section>
                        <Section id="cookies">
                            <p>
                                Exactly one cookie:{' '}
                                <code className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 font-mono text-xs text-stone-800">
                                    session
                                </code>
                                , httpOnly and secure, used solely to keep you signed in. It is strictly
                                necessary to the service, so no consent banner is required — and there are no
                                advertising or third-party cookies, ever.
                            </p>
                        </Section>
                        <Section id="rights">
                            <p>
                                Under the GDPR you can ask for <strong>access</strong> to your data, its{' '}
                                <strong>rectification</strong> or <strong>erasure</strong>, the{' '}
                                <strong>restriction</strong> of processing, its <strong>portability</strong>,
                                and you can <strong>object</strong> to processing based on legitimate interest.
                                Write to{' '}
                                <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
                                    {CONTACT_EMAIL}
                                </a>{' '}
                                — we answer within one month. You can also lodge a complaint with your
                                supervisory authority (in France, the CNIL).
                            </p>
                        </Section>
                        <Section id="security">
                            <p>
                                Passwords hashed with Argon2id, TLS everywhere, databases and storage isolated
                                on an internal network with no public access, a cloud firewall restricting
                                inbound traffic, and secrets managed outside the codebase. No system is
                                perfectly secure, but we designed this one to expose as little as possible.
                            </p>
                        </Section>
                        <Section id="children">
                            <p>
                                Dropicture is not directed at children. You must be at least 15 years old (or
                                the digital-consent age applicable in your country) to create an account.
                            </p>
                        </Section>
                        <Section id="changes">
                            <p>
                                We may update this page; the date above always reflects the latest version. For
                                material changes we will inform you through the service before they take effect.
                            </p>
                        </Section>
                        <Section id="contact">
                            <p>
                                Questions, requests, concerns:{' '}
                                <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
                                    {CONTACT_EMAIL}
                                </a>
                                .
                            </p>
                        </Section>
                    </div>
                </article>
                <aside className="hidden lg:block">
                    <nav
                        aria-label="On this page"
                        className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto"
                    >
                        <p className="font-mono text-xs font-medium uppercase tracking-widest text-stone-400">
                            On this page
                        </p>
                        <ul className="mt-4 space-y-0.5 border-l border-stone-200/70 pl-5">
                            {SECTION_IDS.map((id, i) => (
                                <li key={id}>
                                    <a
                                        href={`#${id}`}
                                        className="group flex items-baseline gap-2.5 py-1 text-[13px] leading-snug text-stone-500 transition-colors hover:text-stone-900"
                                    >
                                        <span
                                            aria-hidden
                                            className="select-none font-mono text-[11px] text-stone-300 transition-colors group-hover:text-stone-400"
                                        >
                                            {pad(i + 1)}
                                        </span>
                                        {SECTIONS[id]}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </aside>
            </div>
        </LayoutPublic>
    )
}