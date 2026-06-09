// dropicture/app/frontend/src/app/terms/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import LayoutPublic from '@/components/LayoutPublic'

const TITLE = 'Terms of Service'
const DESCRIPTION =
    'The terms governing dropicture.com, written to be read: your content stays yours, the service is free, EU consumer rights remain unaffected.'

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: 'https://dropicture.com/terms' },
    openGraph: {
        type: 'website',
        locale: 'en_US',
        url: 'https://dropicture.com/terms',
        siteName: 'Dropicture',
        title: `${TITLE} — Dropicture`,
        description: DESCRIPTION,
    },
    twitter: { card: 'summary', title: `${TITLE} — Dropicture`, description: DESCRIPTION },
}

const OPERATOR = 'Amir Redjem'
const CONTACT_EMAIL = 'contact@dropicture.com'
const GOVERNING_LAW = 'French law'
const LAST_UPDATED = 'June 5, 2026'

const SECTIONS = {
    service: 'The service',
    eligibility: 'Eligibility',
    account: 'Your account',
    content: 'Your content stays yours',
    'acceptable-use': 'Acceptable use',
    limits: 'Limits and fair use',
    availability: 'Availability and your own backups',
    termination: 'Suspension and termination',
    warranty: 'No warranty',
    liability: 'Limitation of liability',
    privacy: 'Privacy',
    changes: 'Changes to these terms',
    law: 'Governing law',
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

export default function TermsPage() {
    return (
        <LayoutPublic
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
                        Terms of Service
                    </h1>
                    <p className="mt-5 font-mono text-xs text-stone-400">
                        Last updated · {LAST_UPDATED}
                    </p>
                    <p className="mt-5 text-pretty text-base leading-relaxed text-stone-500">
                        These terms govern your use of the official Dropicture instance at dropicture.com,
                        operated by {OPERATOR}. By creating an account or using the service, you agree to
                        them. They are written to be read.
                    </p>
                    <div className="mt-10 border-t border-stone-200/70">
                        <Section id="service">
                            <p>
                                Dropicture is a photo storage and sharing service, provided{' '}
                                <strong>free of charge</strong>. The software is open source under the{' '}
                                <Link
                                    href="https://github.com/redjem-amir/dropicture/blob/main/LICENSE"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={LINK}
                                >
                                    MIT License
                                </Link>
                                . These terms cover <strong>only</strong> the hosted instance at dropicture.com
                                — self-hosted instances are run by their own operators under their own terms,
                                and the software itself is governed by its license, not by this page.
                            </p>
                        </Section>
                        <Section id="eligibility">
                            <p>
                                You must be at least 15 years old (or the digital-consent age applicable in your
                                country) and capable of entering into this agreement. One account per person,
                                created with accurate information.
                            </p>
                        </Section>
                        <Section id="account">
                            <p>
                                You are responsible for keeping your credentials confidential and for the
                                activity under your account. Sessions expire automatically; signing out on
                                shared devices is on you. If you believe your account is compromised, change
                                your password and contact us at{' '}
                                <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
                                    {CONTACT_EMAIL}
                                </a>
                                .
                            </p>
                        </Section>
                        <Section id="content">
                            <p>
                                You keep <strong>all ownership</strong> of the photos and files you upload. We
                                claim no rights over them. You grant us only the narrow, non-exclusive license
                                technically required to operate the service: storing your files, generating
                                previews or resized versions, and transmitting them when you request it. This
                                license ends when you delete your content or your account.
                            </p>
                            <p>
                                In return, you warrant that you have the rights to everything you upload, and
                                that your content doesn&apos;t infringe anyone else&apos;s rights.
                            </p>
                        </Section>
                        <Section id="acceptable-use">
                            <p>
                                Don&apos;t use Dropicture to store or share content that is illegal, that
                                exploits or endangers minors, that infringes intellectual property, or that
                                contains malware. Don&apos;t attempt to breach the security of the service,
                                circumvent rate limits or quotas, disrupt the infrastructure, or access other
                                people&apos;s data. We may remove content and suspend or ban accounts that
                                violate this section (see section 8).
                            </p>
                        </Section>
                        <Section id="limits">
                            <p>
                                The service is free and shared: we may apply reasonable technical limits (such
                                as a maximum upload size, currently 100 MB per file, or storage quotas) and
                                adjust them over time to keep the service healthy for everyone.
                            </p>
                        </Section>
                        <Section id="availability">
                            <p>
                                We run Dropicture with care, but it is a free service without an uptime
                                guarantee. Honesty matters to us: the official instance runs on lean
                                infrastructure, and while we take precautions,{' '}
                                <strong>you should keep your own copies of irreplaceable photos</strong>. We may
                                modify, suspend or discontinue the service; for material changes or
                                discontinuation we will give you reasonable advance notice so you can retrieve
                                your content.
                            </p>
                        </Section>
                        <Section id="termination">
                            <p>
                                You can stop using Dropicture and delete your account at any time; your data is
                                then deleted as described in the{' '}
                                <Link href="/privacy" className={LINK}>
                                    Privacy Policy
                                </Link>
                                . We may suspend or ban an account that violates these terms — where reasonable,
                                we will tell you why and give you a chance to respond. After termination, your
                                content is deleted on the same schedule as an account deletion.
                            </p>
                        </Section>
                        <Section id="warranty">
                            <p>
                                The service is provided{' '}
                                <strong>&quot;as is&quot; and &quot;as available&quot;</strong>, without
                                warranties of any kind, express or implied, to the extent permitted by law. The
                                open source software is additionally provided without warranty under the terms
                                of the MIT License.
                            </p>
                        </Section>
                        <Section id="liability">
                            <p>
                                To the maximum extent permitted by applicable law, and given that the service is
                                provided free of charge, we are not liable for indirect or consequential
                                damages, or for loss of data, profits or goodwill arising from your use of the
                                service. Nothing in these terms excludes liability that cannot be excluded by
                                law — including your statutory rights as a consumer in the EU, which remain
                                unaffected.
                            </p>
                        </Section>
                        <Section id="privacy">
                            <p>
                                How we handle your data is described in the{' '}
                                <Link href="/privacy" className={LINK}>
                                    Privacy Policy
                                </Link>
                                , which is part of these terms. The short version: EU hosting, no ads, no
                                trackers, one essential cookie.
                            </p>
                        </Section>
                        <Section id="changes">
                            <p>
                                We may update these terms; the date above always reflects the latest version.
                                For material changes we will inform you through the service before they take
                                effect — continuing to use Dropicture after that means you accept the new terms.
                            </p>
                        </Section>
                        <Section id="law">
                            <p>
                                These terms are governed by {GOVERNING_LAW}. If you are a consumer in the EU,
                                you also benefit from the mandatory protections of the law of your country of
                                residence, and you may bring proceedings before your local courts.
                            </p>
                        </Section>
                        <Section id="contact">
                            <p>
                                Questions about these terms:{' '}
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