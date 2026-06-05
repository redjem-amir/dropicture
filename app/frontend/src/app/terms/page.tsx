// dropicture/app/frontend/src/app/terms/page.tsx
import Link from 'next/link'

const OPERATOR = 'Amir Redjem'
const CONTACT_EMAIL = 'contact@dropicture.com'
const GOVERNING_LAW = 'French law'
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

export default function TermsPage() {
    return (
        <main className="relative flex min-h-dvh flex-col overflow-hidden bg-stone-50">
            <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
                <svg className="absolute inset-0 h-full w-full text-stone-300 mask-[radial-gradient(ellipse_at_center,black_30%,transparent_75%)]">
                    <defs>
                        <pattern id="dots-terms" width="26" height="26" patternUnits="userSpaceOnUse">
                            <circle cx="1.5" cy="1.5" r="1.5" fill="currentColor" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#dots-terms)" />
                </svg>
                <div className="absolute -right-40 -top-40 size-120 rounded-full bg-linear-to-bl from-amber-200 via-orange-100 to-transparent opacity-60 blur-3xl" />
                <div className="absolute -bottom-48 -left-32 size-136 rounded-full bg-linear-to-tr from-violet-200 via-fuchsia-100 to-transparent opacity-60 blur-3xl" />
                <svg viewBox="0 0 24 24" className="absolute left-[14%] top-[10%] hidden size-4 text-amber-400 md:block">
                    <path d={SPARKLE} fill="currentColor" />
                </svg>
                <svg viewBox="0 0 24 24" className="absolute bottom-[16%] right-[10%] hidden size-3.5 text-violet-400 md:block">
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
                    <svg aria-hidden viewBox="0 0 24 24" className="absolute -left-3 -top-4 size-6 text-amber-400">
                        <path d={SPARKLE} fill="currentColor" />
                    </svg>

                    <div className="rounded-3xl border border-stone-200/80 bg-white/80 p-8 shadow-[0_8px_40px_-12px_rgba(28,25,23,0.12)] backdrop-blur-sm sm:p-10">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-500">
                            <svg viewBox="0 0 24 24" className="size-3 text-amber-500" aria-hidden="true">
                                <path d={SPARKLE} fill="currentColor" />
                            </svg>
                            Plain words, fair terms
                        </span>
                        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-stone-900">
                            Terms of Service
                        </h1>
                        <svg aria-hidden viewBox="0 0 120 12" className="mt-1 h-3 w-28 text-amber-400">
                            <path d="M3 8 C 22 3, 42 10, 62 6 S 100 4, 117 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
                        </svg>
                        <p className="mt-3 text-sm text-stone-500">Last updated: {LAST_UPDATED}</p>
                        <p className="mt-4 text-sm leading-relaxed text-stone-600">
                            These terms govern your use of the official Dropicture instance at dropicture.com,
                            operated by {OPERATOR}. By creating an account or using the service, you agree to
                            them. They are written to be read.
                        </p>
                        <hr className="my-8 border-stone-200/80" />
                        <Section id="service" title="1. The service">
                            <p>
                                Dropicture is a photo storage and sharing service, provided <strong>free of
                                    charge</strong>. The software is open source under the{' '}
                                <Link
                                    href="https://github.com/redjem-amir/dropicture/blob/main/LICENSE"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-stone-900 underline-offset-4 hover:underline"
                                >
                                    MIT License
                                </Link>
                                . These terms cover <strong>only</strong> the hosted instance at dropicture.com —
                                self-hosted instances are run by their own operators under their own terms, and the
                                software itself is governed by its license, not by this page.
                            </p>
                        </Section>
                        <Section id="eligibility" title="2. Eligibility">
                            <p>
                                You must be at least 15 years old (or the digital-consent age applicable in your
                                country) and capable of entering into this agreement. One account per person,
                                created with accurate information.
                            </p>
                        </Section>
                        <Section id="account" title="3. Your account">
                            <p>
                                You are responsible for keeping your credentials confidential and for the activity
                                under your account. Sessions expire automatically; signing out on shared devices is
                                on you. If you believe your account is compromised, change your password and contact
                                us at{' '}
                                <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-stone-900 underline-offset-4 hover:underline">
                                    {CONTACT_EMAIL}
                                </a>
                                .
                            </p>
                        </Section>
                        <Section id="content" title="4. Your content stays yours">
                            <p>
                                You keep <strong>all ownership</strong> of the photos and files you upload. We claim
                                no rights over them. You grant us only the narrow, non-exclusive license technically
                                required to operate the service: storing your files, generating previews or resized
                                versions, and transmitting them when you request it. This license ends when you
                                delete your content or your account.
                            </p>
                            <p>
                                In return, you warrant that you have the rights to everything you upload, and that
                                your content doesn&apos;t infringe anyone else&apos;s rights.
                            </p>
                        </Section>
                        <Section id="acceptable-use" title="5. Acceptable use">
                            <p>
                                Don&apos;t use Dropicture to store or share content that is illegal, that exploits
                                or endangers minors, that infringes intellectual property, or that contains malware.
                                Don&apos;t attempt to breach the security of the service, circumvent rate limits or
                                quotas, disrupt the infrastructure, or access other people&apos;s data. We may
                                remove content and suspend or ban accounts that violate this section (see
                                section 8).
                            </p>
                        </Section>
                        <Section id="limits" title="6. Limits and fair use">
                            <p>
                                The service is free and shared: we may apply reasonable technical limits (such as a
                                maximum upload size, currently 100 MB per file, or storage quotas) and adjust them
                                over time to keep the service healthy for everyone.
                            </p>
                        </Section>
                        <Section id="availability" title="7. Availability and your own backups">
                            <p>
                                We run Dropicture with care, but it is a free service without an uptime guarantee.
                                Honesty matters to us: the official instance runs on lean infrastructure, and while
                                we take precautions, <strong>you should keep your own copies of irreplaceable
                                    photos</strong>. We may modify, suspend or discontinue the service; for material
                                changes or discontinuation we will give you reasonable advance notice so you can
                                retrieve your content.
                            </p>
                        </Section>
                        <Section id="termination" title="8. Suspension and termination">
                            <p>
                                You can stop using Dropicture and delete your account at any time; your data is then
                                deleted as described in the{' '}
                                <Link href="/privacy" className="font-medium text-stone-900 underline-offset-4 hover:underline">
                                    Privacy Policy
                                </Link>
                                . We may suspend or ban an account that violates these terms — where reasonable, we
                                will tell you why and give you a chance to respond. After termination, your content
                                is deleted on the same schedule as an account deletion.
                            </p>
                        </Section>
                        <Section id="warranty" title="9. No warranty">
                            <p>
                                The service is provided <strong>&quot;as is&quot; and &quot;as available&quot;</strong>,
                                without warranties of any kind, express or implied, to the extent permitted by law.
                                The open source software is additionally provided without warranty under the terms
                                of the MIT License.
                            </p>
                        </Section>
                        <Section id="liability" title="10. Limitation of liability">
                            <p>
                                To the maximum extent permitted by applicable law, and given that the service is
                                provided free of charge, we are not liable for indirect or consequential damages,
                                or for loss of data, profits or goodwill arising from your use of the service.
                                Nothing in these terms excludes liability that cannot be excluded by law — including
                                your statutory rights as a consumer in the EU, which remain unaffected.
                            </p>
                        </Section>
                        <Section id="privacy" title="11. Privacy">
                            <p>
                                How we handle your data is described in the{' '}
                                <Link href="/privacy" className="font-medium text-stone-900 underline-offset-4 hover:underline">
                                    Privacy Policy
                                </Link>
                                , which is part of these terms. The short version: EU hosting, no ads, no trackers,
                                one essential cookie.
                            </p>
                        </Section>
                        <Section id="changes" title="12. Changes to these terms">
                            <p>
                                We may update these terms; the date above always reflects the latest version. For
                                material changes we will inform you through the service before they take effect —
                                continuing to use Dropicture after that means you accept the new terms.
                            </p>
                        </Section>
                        <Section id="law" title="13. Governing law">
                            <p>
                                These terms are governed by {GOVERNING_LAW}. If you are a consumer in the EU, you
                                also benefit from the mandatory protections of the law of your country of residence,
                                and you may bring proceedings before your local courts.
                            </p>
                        </Section>
                        <Section id="contact" title="14. Contact">
                            <p>
                                Questions about these terms:{' '}
                                <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-stone-900 underline-offset-4 hover:underline">
                                    {CONTACT_EMAIL}
                                </a>
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