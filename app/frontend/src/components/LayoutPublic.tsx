// dropicture/app/frontend/src/components/LayoutPublic.tsx
import Link from 'next/link'

export const SPARKLE =
    'M12 0c.9 6.1 5 10.2 11.9 12-6.9 1.8-11 5.9-11.9 12-.9-6.1-5-10.2-11.9-12C7 10.2 11.1 6.1 12 0Z'

const NAV = [
    { href: '/open-source', label: 'Open source' },
    { href: '/about', label: 'About' },
]

export default function LayoutPublic({
    children,
    active,
    flip = false,
    decor,
}: {
    children: React.ReactNode
    active?: string
    flip?: boolean
    decor?: React.ReactNode
}) {
    return (
        <div className="relative flex min-h-dvh flex-col bg-white">
            <div aria-hidden className="pointer-events-none absolute inset-0 select-none overflow-hidden">
                <div
                    className={
                        (flip ? '-right-40 bg-linear-to-bl' : '-left-40 bg-linear-to-br') +
                        ' absolute -top-40 size-120 rounded-full from-amber-100/80 to-transparent opacity-60 blur-3xl'
                    }
                />
                {decor}
            </div>
            <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-white/80 backdrop-blur-sm">
                <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:px-6">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-stone-900 transition-opacity hover:opacity-80"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="size-5"
                            aria-hidden="true"
                        >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M14.31 8l5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16L3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94" />
                        </svg>
                        <span className="text-sm font-semibold tracking-tight">Dropicture</span>
                    </Link>
                    <nav aria-label="Main" className="ml-6 hidden items-center gap-1 md:flex">
                        {NAV.map(item => {
                            const isActive = item.href === active
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    aria-current={isActive ? 'page' : undefined}
                                    className={
                                        'rounded-full px-3 py-1.5 text-sm font-medium transition-colors ' +
                                        (isActive
                                            ? 'bg-stone-100 text-stone-900'
                                            : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900')
                                    }
                                >
                                    {item.label}
                                </Link>
                            )
                        })}
                    </nav>
                    <div className="ml-auto flex items-center gap-2">
                        <Link
                            href="/signin"
                            className="inline-flex h-8 items-center rounded-full border border-stone-200 bg-white px-3.5 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:border-stone-300 hover:text-stone-900"
                        >
                            Sign in
                        </Link>
                        <Link
                            href="/signup"
                            className="inline-flex h-8 items-center rounded-full bg-stone-900 px-3.5 text-sm font-medium text-white transition-colors hover:bg-stone-700"
                        >
                            Get started
                        </Link>
                    </div>
                </div>
            </header>
            <main className="relative z-10 flex-1">{children}</main>
            <footer className="relative z-10 border-t border-stone-200/70 bg-white">
                <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
                    <p className="text-xs text-stone-400">
                        © {new Date().getFullYear()} Dropicture · MIT licensed · Built in the open, hosted in
                        Europe
                    </p>
                    <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
                        <Link href="/open-source" className="text-xs text-stone-500 transition-colors hover:text-stone-900">
                            Open source
                        </Link>
                        <Link href="/about" className="text-xs text-stone-500 transition-colors hover:text-stone-900">
                            About
                        </Link>
                        <Link href="/terms" className="text-xs text-stone-500 transition-colors hover:text-stone-900">
                            Terms
                        </Link>
                        <Link href="/privacy" className="text-xs text-stone-500 transition-colors hover:text-stone-900">
                            Privacy
                        </Link>
                        <Link
                            href="https://github.com/redjem-amir/dropicture"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-stone-500 transition-colors hover:text-stone-900"
                        >
                            GitHub
                        </Link>
                    </nav>
                </div>
            </footer>
        </div>
    )
}