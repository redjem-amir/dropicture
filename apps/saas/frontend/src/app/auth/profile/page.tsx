// dropicture/apps/saas/frontend/src/app/auth/profile/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const PAGE_SIZE = 48;

type MediaView = {
    id: string;
    kind: 'image' | 'video';
    width: number | null;
    height: number | null;
    durationMs: number | null;
    url: string;
};

type Item = MediaView & { publishedAt: string | null };

type Profile = {
    username: string;
    firstname: string;
    lastname: string;
    bio: string | null;
    publicUrl: string;
    avatar: MediaView | null;
    counts: { published: number; inLibrary: number };
    firstPublishedAt: string | null;
    limits: { avatar: { maxBytes: number; accepted: string[] } };
};

type Bulk = { done: string[]; failed: { id: string; code: string }[] };

const ERRORS: Record<string, string> = {
    FILE_TOO_LARGE: 'Image trop lourde. 8 Mo maximum.',
    FILE_REQUIRED: 'Fichier vide.',
    UNSUPPORTED_MEDIA_TYPE: 'Format non accepté. JPEG, PNG ou WEBP.',
    UPLOAD_FAILED: 'L’envoi a été interrompu. Réessaie.',
    BIO_TOO_LONG: 'La description fait au plus 160 caractères.',
    NO_MEDIA: 'Sélection vide.',
    TOO_MANY_ITEMS: 'Trop d’éléments d’un coup (200 max).',
    MEDIA_NOT_FOUND: 'Média introuvable.',
    ALREADY_PRIVATE: 'Déjà retiré de ta vitrine.',
    AVATAR_ALWAYS_PUBLIC: 'La photo de profil reste publique.',
    UNPUBLISH_FAILED: 'Retrait impossible.',
    BAD_CURSOR: 'Pagination expirée.',
    NETWORK: 'Connexion perdue.',
    UNKNOWN: 'Le serveur ne répond pas. Réessaie.',
};

const FIELD =
    'w-full resize-none rounded-lg border border-[#EAEAEA] bg-white px-3 py-2 text-[13px] text-[#171717] outline-none transition placeholder:text-[#A1A1A1] focus:border-[#171717] focus:ring-4 focus:ring-[#171717]/8';

const say = (e: unknown) => {
    const code = e instanceof Error ? e.message : 'UNKNOWN';
    return ERRORS[code] ?? ERRORS.UNKNOWN;
};

const plural = (n: number) => (n > 1 ? 's' : '');

const clip = (ms: number | null) => {
    if (!ms) return null;
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const dayLabel = (iso: string | null) =>
    iso
        ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        : null;

async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const res = await fetch(`${API}/api/profile${path}`, {
        method: init?.method ?? 'GET',
        credentials: 'include',
        ...(init?.body === undefined
            ? {}
            : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(init.body) }),
    });
    if (res.ok) return (await res.json()) as T;
    const data = await res.json().catch(() => null);
    throw new Error(data?.code ?? 'UNKNOWN');
}

async function sendFile<T>(path: string, file: File): Promise<T> {
    const res = await fetch(`${API}/api/profile${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': file.type },
        body: file,
    });
    if (res.ok) return (await res.json()) as T;
    const data = await res.json().catch(() => null);
    throw new Error(data?.code ?? 'UPLOAD_FAILED');
}

const POSTERS = new Map<string, string>();

function grabPoster(item: MediaView): Promise<string | null> {
    const cached = POSTERS.get(item.id);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.playsInline = true;
        video.preload = 'metadata';
        const done = (value: string | null) => {
            video.removeAttribute('src');
            video.load();
            resolve(value);
        };
        video.onloadeddata = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 320;
                canvas.height = video.videoHeight || 240;
                const ctx = canvas.getContext('2d');
                if (!ctx) return done(null);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const url = canvas.toDataURL('image/jpeg', 0.7);
                POSTERS.set(item.id, url);
                done(url);
            } catch {
                done(null);
            }
        };
        video.onerror = () => done(null);
        video.src = `${item.url}#t=0.1`;
    });
}

function Thumb({ item, className }: { item: MediaView; className?: string }) {
    const [poster, setPoster] = useState<string | null>(
        item.kind === 'video' ? POSTERS.get(item.id) ?? null : null,
    );
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (item.kind !== 'video' || poster || failed) return;
        let alive = true;
        void grabPoster(item).then((url) => {
            if (!alive) return;
            if (url) setPoster(url);
            else setFailed(true);
        });
        return () => {
            alive = false;
        };
    }, [item, poster, failed]);

    if (item.kind === 'image') {
        return <img src={item.url} alt="" loading="lazy" decoding="async" draggable={false} className={className} />;
    }
    if (poster) {
        return <img src={poster} alt="" decoding="async" draggable={false} className={className} />;
    }
    return <video src={`${item.url}#t=0.1`} preload="metadata" muted playsInline className={className} />;
}

function PlayBadge() {
    return (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden className="text-white/90 drop-shadow">
                <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.2" />
                <path d="M10.4 8.8 15.6 12l-5.2 3.2V8.8Z" fill="currentColor" />
            </svg>
        </span>
    );
}

export default function Page() {
    const calm = useReducedMotion() === true;

    const [profile, setProfile] = useState<Profile | null>(null);
    const [items, setItems] = useState<Item[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState(false);
    const [viewer, setViewer] = useState<number | null>(null);

    const [bio, setBio] = useState('');
    const [editing, setEditing] = useState(false);
    const [savingBio, setSavingBio] = useState(false);

    const [uploading, setUploading] = useState(false);
    const [copied, setCopied] = useState(false);

    const fileRef = useRef<HTMLInputElement>(null);
    const scroller = useRef<HTMLDivElement>(null);
    const sentinel = useRef<HTMLDivElement>(null);

    const ids = useMemo(() => Array.from(selected), [selected]);
    const open = viewer !== null ? items[viewer] ?? null : null;

    const flash = useCallback((message: string) => {
        setToast(message);
        window.setTimeout(() => setToast((t) => (t === message ? null : t)), 3200);
    }, []);

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            api<Profile>('/'),
            api<{ items: Item[]; nextCursor: string | null }>(`/media?limit=${PAGE_SIZE}`),
        ])
            .then(([p, page]) => {
                if (cancelled) return;
                setProfile(p);
                setBio(p.bio ?? '');
                setItems(page.items);
                setCursor(page.nextCursor);
            })
            .catch((err) => {
                if (!cancelled) setError(say(err));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const loadMore = useCallback(() => {
        if (!cursor || loadingMore) return;
        setLoadingMore(true);
        api<{ items: Item[]; nextCursor: string | null }>(
            `/media?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(cursor)}`,
        )
            .then((page) => {
                setItems((prev) => {
                    const seen = new Set(prev.map((i) => i.id));
                    return [...prev, ...page.items.filter((i) => !seen.has(i.id))];
                });
                setCursor(page.nextCursor);
            })
            .catch((err) => setError(say(err)))
            .finally(() => setLoadingMore(false));
    }, [cursor, loadingMore]);

    useEffect(() => {
        const node = sentinel.current;
        const root = scroller.current;
        if (!node || !root || !cursor || loading) return;
        const io = new IntersectionObserver((e) => e[0].isIntersecting && loadMore(), {
            root,
            rootMargin: '800px 0px',
        });
        io.observe(node);
        return () => io.disconnect();
    }, [cursor, loading, loadMore]);

    useEffect(() => {
        const root = scroller.current;
        if (!root || !cursor || loading || loadingMore) return;
        if (root.scrollHeight <= root.clientHeight + 40) loadMore();
    }, [items, cursor, loading, loadingMore, loadMore]);

    const goTo = useCallback(
        (next: number) => {
            if (!items.length) return;
            const idx = Math.max(0, Math.min(items.length - 1, next));
            setViewer(idx);
            if (idx >= items.length - 3) loadMore();
        },
        [items.length, loadMore],
    );

    useEffect(() => {
        if (viewer === null) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setViewer(null);
            if (e.key === 'ArrowRight') goTo(viewer + 1);
            if (e.key === 'ArrowLeft') goTo(viewer - 1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [viewer, goTo]);

    const saveBio = async () => {
        if (savingBio) return;
        setSavingBio(true);
        setError(null);
        try {
            const res = await api<{ bio: string | null }>('/', { method: 'PATCH', body: { bio } });
            setProfile((p) => (p ? { ...p, bio: res.bio } : p));
            setEditing(false);
            flash('Description enregistrée');
        } catch (err) {
            setError(say(err));
        } finally {
            setSavingBio(false);
        }
    };

    const onPickAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || uploading) return;
        setUploading(true);
        setError(null);
        try {
            const avatar = await sendFile<MediaView>('/avatar', file);
            setProfile((p) => (p ? { ...p, avatar } : p));
            flash('Photo de profil mise à jour');
        } catch (err) {
            setError(say(err));
        } finally {
            setUploading(false);
        }
    };

    const removeAvatar = async () => {
        if (!profile?.avatar || uploading) return;
        if (!window.confirm('Retirer ta photo de profil ?')) return;
        setUploading(true);
        try {
            await api('/avatar', { method: 'DELETE' });
            setProfile((p) => (p ? { ...p, avatar: null } : p));
            flash('Photo de profil retirée');
        } catch (err) {
            setError(say(err));
        } finally {
            setUploading(false);
        }
    };

    const toggle = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const selectAll = () =>
        setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))));

    const unpublish = async (target: string[]) => {
        if (!target.length || busy) return;
        setBusy(true);
        setError(null);
        try {
            const { done, failed } = await api<Bulk>('/media/unpublish', {
                method: 'PATCH',
                body: { ids: target },
            });
            const gone = new Set(done);
            setItems((prev) => prev.filter((i) => !gone.has(i.id)));
            setSelected((prev) => {
                const next = new Set(prev);
                done.forEach((id) => next.delete(id));
                return next;
            });
            setViewer(null);
            setProfile((p) =>
                p
                    ? {
                        ...p,
                        counts: {
                            published: Math.max(0, p.counts.published - done.length),
                            inLibrary: p.counts.inLibrary + done.length,
                        },
                    }
                    : p,
            );
            flash(
                failed.length
                    ? `${done.length} retiré${plural(done.length)} · ${failed.length} en échec (${ERRORS[failed[0].code] ?? ERRORS.UNKNOWN})`
                    : `${done.length} élément${plural(done.length)} de retour dans ta bibliothèque`,
            );
        } catch (err) {
            setError(say(err));
        } finally {
            setBusy(false);
        }
    };

    const copyUrl = async () => {
        if (!profile) return;
        await navigator.clipboard.writeText(profile.publicUrl).catch(() => undefined);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
    };

    const copyLinks = async (target = ids) => {
        const links = items.filter((i) => target.includes(i.id)).map((i) => i.url);
        if (!links.length) return;
        try {
            await navigator.clipboard.writeText(links.join('\n'));
            flash(`${links.length} lien${plural(links.length)} copié${plural(links.length)}`);
        } catch {
            flash('Copie refusée par le navigateur');
        }
    };

    const initials =
        `${profile?.firstname?.[0] ?? ''}${profile?.lastname?.[0] ?? ''}`.toUpperCase() || '?';

    return (
        <div className="relative h-full">
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-96 bg-[repeating-linear-gradient(to_right,rgba(9,9,11,0.05)_0_1px,transparent_1px_72px),repeating-linear-gradient(to_bottom,rgba(9,9,11,0.05)_0_1px,transparent_1px_72px)] mask-[radial-gradient(ellipse_80%_100%_at_50%_-10%,#000_30%,transparent_85%)]" />
            </div>
            <div ref={scroller} className="relative h-full overflow-y-auto overscroll-contain">
                <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
                    <motion.header
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: calm ? 0 : 0.5, ease: EASE }}
                    >
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">Public</p>
                        <h1 className="mt-2 text-[26px] font-semibold leading-[1.15] tracking-[-0.035em]">
                            Ta vitrine
                        </h1>
                        <p className="mt-1 text-[14px] leading-relaxed text-[#666]">
                            Tout ce qui est sur cette page est visible de tous. Le reste attend dans ta
                            bibliothèque.
                        </p>
                    </motion.header>
                    <AnimatePresence initial={false}>
                        {error && (
                            <motion.p
                                key={error}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: calm ? 0 : 0.2, ease: EASE }}
                                role="alert"
                                className="flex items-start gap-1.5 overflow-hidden pt-4 text-[13px] leading-5 text-[#E5484D]"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="mt-0.75 shrink-0">
                                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                                    <path d="M12 7.5v5.5M12 16.2v.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                                {error}
                            </motion.p>
                        )}
                    </AnimatePresence>
                    {loading || !profile ? (
                        <div className="mt-7 space-y-4">
                            <div className="h-44 animate-pulse rounded-xl bg-[#F4F4F5]" />
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                                {[0, 1, 2, 3].map((i) => (
                                    <div key={i} className="aspect-square animate-pulse rounded-xl bg-[#F4F4F5]" />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <>
                            <motion.section
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: calm ? 0 : 0.5, delay: calm ? 0 : 0.05, ease: EASE }}
                                className="mt-7 overflow-hidden rounded-xl border border-[#EAEAEA] bg-white/85 backdrop-blur-xl"
                            >
                                <div className="flex flex-wrap items-start gap-4 p-5 sm:p-6">
                                    <div className="relative shrink-0">
                                        {profile.avatar ? (
                                            <img
                                                src={profile.avatar.url}
                                                alt=""
                                                width={64}
                                                height={64}
                                                className="size-16 rounded-full border border-[#EAEAEA] object-cover"
                                            />
                                        ) : (
                                            <span
                                                aria-hidden
                                                className="grid size-16 place-items-center rounded-full bg-[#171717] font-mono text-[18px] font-medium text-white"
                                            >
                                                {initials}
                                            </span>
                                        )}
                                        {uploading && (
                                            <span className="absolute inset-0 grid place-items-center rounded-full bg-white/70 backdrop-blur">
                                                <motion.span
                                                    aria-hidden
                                                    className="size-4 rounded-full border-2 border-[#EAEAEA] border-t-[#171717]"
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                                                />
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => fileRef.current?.click()}
                                            disabled={uploading}
                                            aria-label="Changer la photo de profil"
                                            className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full border border-[#EAEAEA] bg-white text-[#666] transition hover:border-[#D4D4D4] hover:text-[#171717] disabled:opacity-60"
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                                                <rect x="3" y="6.5" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                                                <path d="M8.5 6.5 10 4h4l1.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                                                <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.8" />
                                            </svg>
                                        </button>
                                        <input
                                            ref={fileRef}
                                            type="file"
                                            accept={profile.limits.avatar.accepted.join(',')}
                                            hidden
                                            onChange={onPickAvatar}
                                        />
                                    </div>
                                    <div className="min-w-56 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-mono text-[13px] text-[#171717]">@{profile.username}</p>
                                            {profile.avatar && (
                                                <button
                                                    type="button"
                                                    onClick={removeAvatar}
                                                    disabled={uploading}
                                                    className="text-[11px] text-[#A1A1A1] transition hover:text-[#171717] disabled:opacity-50"
                                                >
                                                    Retirer la photo
                                                </button>
                                            )}
                                        </div>
                                        {editing ? (
                                            <div className="mt-2">
                                                <textarea
                                                    value={bio}
                                                    onChange={(e) => setBio(e.target.value)}
                                                    maxLength={160}
                                                    rows={2}
                                                    placeholder="Une phrase sur ce que tu montres."
                                                    className={FIELD}
                                                />
                                                <div className="mt-2 flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={saveBio}
                                                        disabled={savingBio}
                                                        className="inline-flex h-8 items-center gap-2 rounded-lg bg-[#171717] px-3 text-[12px] font-medium text-white transition hover:bg-[#383838] disabled:bg-[#EAEAEA] disabled:text-[#A1A1A1]"
                                                    >
                                                        {savingBio && (
                                                            <motion.span
                                                                aria-hidden
                                                                className="size-3 rounded-full border-2 border-white/30 border-t-white"
                                                                animate={{ rotate: 360 }}
                                                                transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                                                            />
                                                        )}
                                                        Enregistrer
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditing(false);
                                                            setBio(profile.bio ?? '');
                                                        }}
                                                        className="text-[12px] text-[#8F8F8F] transition hover:text-[#171717]"
                                                    >
                                                        Annuler
                                                    </button>
                                                    <span className="ml-auto font-mono text-[10px] tabular-nums text-[#A1A1A1]">
                                                        {bio.length} / 160
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mt-1.5 flex items-start gap-2">
                                                <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-[#666]">
                                                    {profile.bio ?? <span className="text-[#A1A1A1]">Aucune description.</span>}
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditing(true)}
                                                    className="shrink-0 text-[12px] text-[#8F8F8F] transition hover:text-[#171717]"
                                                >
                                                    Modifier
                                                </button>
                                            </div>
                                        )}
                                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums text-[#A1A1A1]">
                                            <span className="text-[#171717]">{profile.counts.published} en vitrine</span>
                                            <span aria-hidden className="size-1 rounded-full bg-[#EAEAEA]" />
                                            <Link href="/auth/library" className="transition hover:text-[#171717]">
                                                {profile.counts.inLibrary} en bibliothèque →
                                            </Link>
                                            {profile.firstPublishedAt && (
                                                <>
                                                    <span aria-hidden className="size-1 rounded-full bg-[#EAEAEA]" />
                                                    <span>depuis le {dayLabel(profile.firstPublishedAt)}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 border-t border-[#EAEAEA] bg-[#FAFAFA]/60 px-5 py-3 sm:px-6">
                                    <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-[#666]">
                                        {profile.publicUrl}
                                    </code>
                                    <button
                                        type="button"
                                        onClick={copyUrl}
                                        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#EAEAEA] bg-white px-2.5 text-[12px] font-medium text-[#171717] transition hover:border-[#D4D4D4]"
                                    >
                                        {copied ? (
                                            <>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                                                    <path d="m4.5 12.5 5 5 10-11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                Copié
                                            </>
                                        ) : (
                                            'Copier'
                                        )}
                                    </button>
                                    <Link
                                        href={profile.publicUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#171717] px-2.5 text-[12px] font-medium text-white transition hover:bg-[#383838]"
                                    >
                                        Voir la page
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
                                            <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </Link>
                                </div>
                            </motion.section>
                            <div className="mt-8 flex flex-wrap items-center gap-3">
                                <h2 className="text-[15px] font-semibold tracking-[-0.02em]">Publié</h2>
                                {items.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={selectAll}
                                        className="text-[12px] text-[#8F8F8F] transition hover:text-[#171717]"
                                    >
                                        {selected.size === items.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                                    </button>
                                )}
                                <Link
                                    href="/auth/library"
                                    className="ml-auto inline-flex h-8 items-center rounded-lg border border-[#EAEAEA] bg-white px-3 text-[12px] font-medium text-[#171717] transition hover:border-[#D4D4D4]"
                                >
                                    Publier depuis ma bibliothèque
                                </Link>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                                {items.map((item, i) => {
                                    const on = selected.has(item.id);
                                    return (
                                        <motion.figure
                                            key={item.id}
                                            initial={{ opacity: calm ? 1 : 0, y: calm ? 0 : 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: calm ? 0 : 0.35, delay: calm ? 0 : Math.min(i, 12) * 0.02, ease: EASE }}
                                            className={`group overflow-hidden rounded-xl border bg-white transition ${on ? 'border-[#171717] ring-2 ring-[#171717]/15' : 'border-[#EAEAEA]'
                                                }`}
                                        >
                                            <div className="relative aspect-square bg-[#FAFAFA]">
                                                <button
                                                    type="button"
                                                    onClick={() => goTo(i)}
                                                    aria-label="Ouvrir"
                                                    className="absolute inset-0 size-full"
                                                >
                                                    <Thumb item={item} className="size-full object-cover" />
                                                    {item.kind === 'video' && <PlayBadge />}
                                                </button>
                                                {item.kind === 'video' && clip(item.durationMs) && (
                                                    <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded bg-[#171717]/70 px-1 py-px font-mono text-[9px] tabular-nums text-white backdrop-blur">
                                                        {clip(item.durationMs)}
                                                    </span>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => toggle(item.id)}
                                                    aria-pressed={on}
                                                    aria-label="Sélectionner"
                                                    className={`absolute left-1.5 top-1.5 grid size-5 place-items-center rounded-full border transition ${on
                                                        ? 'border-[#171717] bg-[#171717] text-white opacity-100'
                                                        : 'border-white/70 bg-black/20 text-transparent opacity-0 backdrop-blur group-hover:opacity-100 focus-visible:opacity-100'
                                                        }`}
                                                >
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                                                        <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                </button>
                                            </div>
                                            <figcaption className="p-2">
                                                <button
                                                    type="button"
                                                    onClick={() => unpublish([item.id])}
                                                    disabled={busy}
                                                    className="flex h-8 w-full items-center justify-center rounded-lg border border-[#EAEAEA] bg-white text-[12px] font-medium text-[#666] transition hover:border-[#D4D4D4] hover:text-[#171717] disabled:opacity-60"
                                                >
                                                    Retirer de ma vitrine
                                                </button>
                                            </figcaption>
                                        </motion.figure>
                                    );
                                })}
                            </div>
                            <div ref={sentinel} aria-hidden className="h-px" />
                            {loadingMore && (
                                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                                    {[0, 1, 2, 3].map((i) => (
                                        <div key={i} className="aspect-square animate-pulse rounded-xl bg-[#F4F4F5]" />
                                    ))}
                                </div>
                            )}
                            {items.length === 0 && (
                                <div className="mt-4 rounded-xl border border-dashed border-[#EAEAEA] bg-white/60 px-6 py-14 text-center">
                                    <p className="text-[14px] text-[#666]">
                                        Ta vitrine est vide. Rien n’est visible tant que tu n’as rien publié.
                                    </p>
                                    <Link
                                        href="/auth/library"
                                        className="mt-4 inline-flex h-9 items-center rounded-lg bg-[#171717] px-4 text-[13px] font-medium text-white transition hover:bg-[#383838]"
                                    >
                                        {profile.counts.inLibrary > 0
                                            ? `Choisir parmi ${profile.counts.inLibrary} élément${plural(profile.counts.inLibrary)}`
                                            : 'Déposer des fichiers'}
                                    </Link>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: calm ? 0 : 0.18 }}
                        role="dialog"
                        aria-modal="true"
                        className="fixed inset-0 z-50 flex flex-col bg-[#09090B]/92 backdrop-blur-sm"
                        onClick={() => setViewer(null)}
                    >
                        <div className="flex flex-wrap items-center gap-2 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="min-w-0">
                                <p className="truncate text-[13px] font-medium text-white">
                                    {dayLabel(open.publishedAt) ? `Publié le ${dayLabel(open.publishedAt)}` : 'En vitrine'}
                                </p>
                                <p className="truncate font-mono text-[11px] text-white/60">
                                    {open.width && open.height ? `${open.width}×${open.height}` : 'visible de tous'}
                                </p>
                            </div>
                            <div className="ml-auto flex flex-wrap items-center gap-1">
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => copyLinks([open.id])}
                                    className="h-8 rounded-lg border border-white/25 px-3 text-[12px] font-medium text-white/80 transition hover:text-white disabled:opacity-40 cursor-pointer"
                                >
                                    Copier le lien
                                </button>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => unpublish([open.id])}
                                    className="h-8 rounded-lg border border-white bg-white px-3 text-[12px] font-medium text-[#171717] transition hover:bg-white/90 disabled:opacity-40 cursor-pointer"
                                >
                                    Retirer de ma vitrine
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewer(null)}
                                    aria-label="Fermer"
                                    className="grid size-8 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white cursor-pointer"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                                        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6">
                            <button
                                type="button"
                                disabled={viewer === 0}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    goTo((viewer ?? 0) - 1);
                                }}
                                aria-label="Précédent"
                                className="absolute left-2 grid size-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-0"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                                    <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                            {open.kind === 'video' ? (
                                <video
                                    key={open.id}
                                    src={open.url}
                                    controls
                                    autoPlay
                                    playsInline
                                    onClick={(e) => e.stopPropagation()}
                                    className="max-h-full max-w-full rounded-xl"
                                />
                            ) : (
                                <img
                                    key={open.id}
                                    src={open.url}
                                    alt=""
                                    onClick={(e) => e.stopPropagation()}
                                    className="max-h-full max-w-full rounded-xl object-contain"
                                />
                            )}
                            <button
                                type="button"
                                disabled={viewer === items.length - 1 && !cursor}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    goTo((viewer ?? 0) + 1);
                                }}
                                aria-label="Suivant"
                                className="absolute right-2 grid size-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-0"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                                    <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {selected.size > 0 && !open && (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 16 }}
                        transition={{ duration: calm ? 0 : 0.24, ease: EASE }}
                        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-4"
                    >
                        <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-[#EAEAEA] bg-white/90 p-1.5 shadow-[0_1px_2px_rgba(9,9,11,0.04),0_16px_40px_-16px_rgba(9,9,11,0.22)] backdrop-blur-xl">
                            <span className="px-2 font-mono text-[12px] tabular-nums text-[#171717]">
                                {selected.size}
                            </span>
                            <span aria-hidden className="mx-1 h-5 w-px bg-[#EAEAEA]" />

                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => unpublish(ids)}
                                className="inline-flex h-8 items-center rounded-lg bg-[#171717] px-2.5 text-[12px] font-medium text-white transition hover:bg-[#383838] disabled:opacity-40"
                            >
                                Retirer de ma vitrine
                            </button>

                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => copyLinks()}
                                className="inline-flex h-8 items-center rounded-lg border border-[#EAEAEA] px-2.5 text-[12px] font-medium text-[#171717] transition hover:bg-[#FAFAFA] disabled:opacity-40"
                            >
                                Copier les liens
                            </button>

                            <span aria-hidden className="mx-1 h-5 w-px bg-[#EAEAEA]" />
                            <button
                                type="button"
                                onClick={() => setSelected(new Set())}
                                className="rounded-lg px-2.5 py-1.5 text-[12px] text-[#8F8F8F] transition hover:text-[#171717]"
                            >
                                Annuler
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {toast && (
                    <motion.p
                        role="status"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: calm ? 0 : 0.2, ease: EASE }}
                        className={`pointer-events-none fixed inset-x-0 z-60 mx-auto w-fit rounded-lg bg-[#171717] px-3 py-1.5 text-[12px] text-white ${selected.size > 0 ? 'bottom-20' : 'bottom-4'
                            }`}
                    >
                        {toast}
                    </motion.p>
                )}
            </AnimatePresence>
        </div>
    );
}