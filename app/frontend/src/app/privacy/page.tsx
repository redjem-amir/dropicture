// dropicture/app/frontend/src/app/privacy/page.tsx
import Link from 'next/link'

const CONTROLLER = 'Amir Redjem'
const CONTACT_EMAIL = 'privacy@dropicture.com'
const LAST_UPDATED = 'June 5, 2026'

const SPARKLE =
    'M12 0c.9 6.1 5 10.2 11.9 12-6.9 1.8-11 5.9-11.9 12-.9-6.1-5-10.2-11.9-12C7 10.2 11.1 6.1 12 0Z'

function Section({
    id,
    title,
    children,
}: {
    id: string
    title: string
    children: React.ReactNode
}) {
    return (
        <section id={id} className="mt-10 scroll-mt-24 first:mt-0">
            <h2 className="text-lg font-semibold tracking-tight text-stone-900">{title}</h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-stone-600">{children}</div>
        </section>
    )
}

export default function PrivacyPage() {
    return (
        <main className="relative flex min-h-dvh flex-col overflow-hidden bg-stone-50">
            <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
                <svg className="absolute inset-0 h-full w-full text-stone-300 mask-[radial-gradient(ellipse_at_center,black_30%,transparent_75%)]">
                    <defs>
                        <pattern id="dots-privacy" width="26" height="26" patternUnits="userSpaceOnUse">
                            <circle cx="1.5" cy="1.5" r="1.5" fill="currentColor" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#dots-privacy)" />
                </svg>
                <div className="absolute -left-40 -top-40 size-120 rounded-full bg-linear-to-br from-amber-200 via-orange-100 to-transparent opacity-60 blur-3xl" />
                <div className="absolute -bottom-48 -right-32 size-136 rounded-full bg-linear-to-tr from-violet-200 via-fuchsia-100 to-transparent opacity-60 blur-3xl" />
                <svg viewBox="0 0 24 24" className="absolute right-[14%] top-[10%] hidden size-4 text-amber-400 md:block">
                    <path d={SPARKLE} fill="currentColor" />
                </svg>
                <svg viewBox="0 0 24 24" className="absolute bottom-[16%] left-[10%] hidden size-3.5 text-violet-400 md:block">
                    <path d={SPARKLE} fill="currentColor" />
                </svg>
            </div>
            <div className="relative z-10 mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:py-16">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-stone-900 transition hover:opacity-80"
                >
                    <span className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-amber-400 to-orange-500 text-white shadow-[0_6px_16px_-4px_rgba(249,115,22,0.5)]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M14.31 8l5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16L3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94" />
                        </svg>
                    </span>
                    <span className="text-sm font-semibold tracking-tight">Dropicture</span>
                </Link>
                <div className="relative mt-8">
                    <svg aria-hidden viewBox="0 0 24 24" className="absolute -right-3 -top-4 size-6 text-amber-400">
                        <path d={SPARKLE} fill="currentColor" />
                    </svg>
                    <div className="rounded-3xl border border-stone-200/80 bg-white/80 p-8 shadow-[0_8px_40px_-12px_rgba(28,25,23,0.12)] backdrop-blur-sm sm:p-10">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-500">
                            <svg viewBox="0 0 24 24" className="size-3 text-amber-500" aria-hidden="true">
                                <path d={SPARKLE} fill="currentColor" />
                            </svg>
                            Your data, your rules
                        </span>
                        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-stone-900">
                            Privacy Policy
                        </h1>
                        <svg aria-hidden viewBox="0 0 120 12" className="mt-1 h-3 w-28 text-amber-400">
                            <path d="M3 8 C 22 3, 42 10, 62 6 S 100 4, 117 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
                        </svg>
                        <p className="mt-3 text-sm text-stone-500">Last updated: {LAST_UPDATED}</p>
                        <p className="mt-4 text-sm leading-relaxed text-stone-600">
                            Dropicture exists so that your photos stay yours. This policy explains, in plain
                            words, what data the official instance at dropicture.com collects, why, where it
                            lives, and the rights you have over it.
                        </p>
                        <hr className="my-8 border-stone-200/80" />
                        <Section id="controller" title="1. Who is responsible">
                            <p>
                                The data controller for dropicture.com is {CONTROLLER}. For anything related to
                                your data, write to{' '}
                                <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-stone-900 underline-offset-4 hover:underline">
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
                        <Section id="data" title="2. Data we collect">
                            <p>We collect the minimum needed to run the service:</p>
                            <p>
                                <strong className="text-stone-800">Account.</strong> First name, last name, email
                                address, and your password — stored only as a salted Argon2id hash, never in plain
                                text. We cannot read your password.
                            </p>
                            <p>
                                <strong className="text-stone-800">Your content.</strong> The photos and files you
                                upload, stored on our own servers (see section 5).
                            </p>
                            <p>
                                <strong className="text-stone-800">Sessions &amp; security.</strong> When you sign
                                in we create a server-side session holding a random identifier, your browser&apos;s
                                user-agent, your IP address and a truncated hash of it, and activity timestamps.
                                Sessions live at most 8 hours (30 minutes of inactivity) and are then deleted
                                automatically. Security events (such as suspicious session activity) are written to
                                server logs.
                            </p>
                            <p>
                                <strong className="text-stone-800">Anti-abuse counters.</strong> Short-lived
                                counters keyed by IP address and email protect sign-up and sign-in against abuse.
                                They expire on their own within 10 to 60 minutes.
                            </p>
                        </Section>
                        <Section id="never" title="3. What we never do">
                            <p>
                                No advertising, no third-party analytics, no trackers, no fingerprinting, no
                                profiling, and no selling, renting or sharing of your data for commercial purposes.
                                We don&apos;t email you except to answer you or for messages strictly necessary to
                                the service.
                            </p>
                        </Section>
                        <Section id="legal" title="4. Legal bases (GDPR)">
                            <p>
                                We process your data to <strong>perform our contract</strong> with you (providing
                                your account and storing your photos — Art. 6(1)(b)), out of{' '}
                                <strong>legitimate interest</strong> (keeping the service secure and preventing
                                abuse — Art. 6(1)(f)), and to meet <strong>legal obligations</strong> where they
                                apply (Art. 6(1)(c)).
                            </p>
                        </Section>
                        <Section id="where" title="5. Where your data lives">
                            <p>
                                Your account data, sessions and photos are stored on servers we operate at{' '}
                                <strong>Hetzner Online GmbH in Falkenstein, Germany (EU)</strong>. They are not
                                replicated outside the European Union.
                            </p>
                            <p>
                                Traffic to dropicture.com transits through <strong>Cloudflare</strong> (DNS, DDoS
                                protection, TLS at the edge), which processes connection data in transit on our
                                behalf. See{' '}
                                <Link
                                    href="https://www.cloudflare.com/privacypolicy/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-stone-900 underline-offset-4 hover:underline"
                                >
                                    Cloudflare&apos;s privacy policy
                                </Link>{' '}
                                for how they handle that data. We have no other processors and no other recipients,
                                unless the law compels us.
                            </p>
                        </Section>
                        <Section id="retention" title="6. How long we keep things">
                            <p>
                                Account data and photos: for as long as your account exists, then deleted. Sessions:
                                at most 8 hours. Anti-abuse counters: at most 1 hour. Security logs are rotated and
                                kept only briefly. Backups, where present, follow the same logic and are purged on a
                                fixed cycle.
                            </p>
                        </Section>
                        <Section id="cookies" title="7. Cookies">
                            <p>
                                Exactly one cookie: <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-800">session</code>,
                                httpOnly and secure, used solely to keep you signed in. It is strictly necessary to
                                the service, so no consent banner is required — and there are no advertising or
                                third-party cookies, ever.
                            </p>
                        </Section>
                        <Section id="rights" title="8. Your rights">
                            <p>
                                Under the GDPR you can ask for <strong>access</strong> to your data, its{' '}
                                <strong>rectification</strong> or <strong>erasure</strong>, the{' '}
                                <strong>restriction</strong> of processing, its <strong>portability</strong>, and
                                you can <strong>object</strong> to processing based on legitimate interest. Write to{' '}
                                <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-stone-900 underline-offset-4 hover:underline">
                                    {CONTACT_EMAIL}
                                </a>{' '}
                                — we answer within one month. You can also lodge a complaint with your supervisory
                                authority (in France, the CNIL).
                            </p>
                        </Section>
                        <Section id="security" title="9. Security">
                            <p>
                                Passwords hashed with Argon2id, TLS everywhere, databases and storage isolated on an
                                internal network with no public access, a cloud firewall restricting inbound
                                traffic, and secrets managed outside the codebase. No system is perfectly secure,
                                but we designed this one to expose as little as possible.
                            </p>
                        </Section>
                        <Section id="children" title="10. Children">
                            <p>
                                Dropicture is not directed at children. You must be at least 15 years old (or the
                                digital-consent age applicable in your country) to create an account.
                            </p>
                        </Section>
                        <Section id="changes" title="11. Changes to this policy">
                            <p>
                                We may update this page; the date above always reflects the latest version. For
                                material changes we will inform you through the service before they take effect.
                            </p>
                        </Section>
                        <Section id="contact" title="12. Contact">
                            <p>
                                Questions, requests, concerns:{' '}
                                <Link href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-stone-900 underline-offset-4 hover:underline">
                                    {CONTACT_EMAIL}
                                </Link>
                                .
                            </p>
                        </Section>
                    </div>
                </div>
            </div>
            <footer className="relative z-10 flex items-center justify-center gap-6 px-4 py-6">
                <Link href="/terms" className="text-xs text-stone-400 transition hover:text-stone-600">
                    Terms
                </Link>
                <Link href="/privacy" className="text-xs text-stone-400 transition hover:text-stone-600">
                    Privacy
                </Link>
                <Link
                    href="https://github.com/redjem-amir/dropicture"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-stone-400 transition hover:text-stone-600"
                >
                    GitHub
                </Link>
            </footer>
        </main>
    )
}