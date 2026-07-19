'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

type Urls = {
    base: string;
    srcSet: { avif: string; webp: string } | null;
    poster: string | null;
    hls: string | null;
    thumbhash: string | null;
};

type Profile = {
    username: string;
    firstname: string;
    lastname: string;
    bio: string | null;
    publicUrl: string;
    avatar: ({ id: string; status: string } & Urls) | null;
    counts: { published: number; private: number; total: number };
    limits: { avatar: { maxBytes: number } };
};

type Item = {
    id: string;
    kind: 'image' | 'video';
    visibility: 'private' | 'public';
    durationMs: number | null;
} & Urls;

type Filter = 'all' | 'published' | 'private';

const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Tout' },
    { id: 'published', label: 'Publié' },
    { id: 'private', label: 'Privé' },
];

const ERRORS: Record<string, string> = {
    FILE_TOO_LARGE: 'Image trop lourde. 8 Mo maximum.',
    UNSUPPORTED_MEDIA_TYPE: 'Format non accepté. JPEG, PNG ou WEBP.',
    BIO_TOO_LONG: 'La description fait au plus 160 caractères.',
    MEDIA_NOT_READY: 'Ce média est encore en traitement.',
    UPLOAD_NOT_FOUND: 'L’envoi n’a pas abouti. Réessaie.',
    UNKNOWN: 'Le serveur ne répond pas. Réessaie.',
};

const FIELD =
    'w-full resize-none rounded-lg border border-[#EAEAEA] bg-white px-3 py-2 text-[13px] text-[#171717] outline-none transition placeholder:text-[#A1A1A1] focus:border-[#171717] focus:ring-4 focus:ring-[#171717]/8';

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API}${path}`, {
        method,
        credentials: 'include',
        ...(body === undefined
            ? {}
            : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
    if (res.ok) return (await res.json()) as T;
    const data = await res.json().catch(() => null);
    throw new Error(data?.code ?? 'UNKNOWN');
}

const say = (e: unknown) => ERRORS[e instanceof Error ? e.message : 'UNKNOWN'] ?? ERRORS.UNKNOWN;

export default function Page() {
    const calm = useReducedMotion() === true;

    const [profile, setProfile] = useState<Profile | null>(null);
    const [items, setItems] = useState<Item[]>([]);
    const [filter, setFilter] = useState<Filter>('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [bio, setBio] = useState('');
    const [editing, setEditing] = useState(false);
    const [savingBio, setSavingBio] = useState(false);

    const [uploading, setUploading] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const fileRef = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        try {
            const [p, m] = await Promise.all([
                api<Profile>('GET', '/api/profile'),
                api<{ items: Item[] }>('GET', `/api/profile/media?filter=${filter}`),
            ]);
            setProfile(p);
            setItems(m.items);
            setBio(p.bio ?? '');
        } catch (err) {
            setError(say(err));
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        void api('POST', '/api/profile/cdn-session').catch(() => undefined);
        const id = window.setInterval(
            () => void api('POST', '/api/profile/cdn-session').catch(() => undefined),
            50 * 60 * 1000,
        );
        return () => window.clearInterval(id);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        const pending = profile?.avatar && profile.avatar.status !== 'ready';
        if (!pending) return;
        const id = window.setInterval(async () => {
            const p = await api<Profile>('GET', '/api/profile').catch(() => null);
            if (p) setProfile(p);
        }, 2500);
        return () => window.clearInterval(id);
    }, [profile?.avatar?.status]);

    const saveBio = async () => {
        if (savingBio) return;
        setSavingBio(true);
        setError(null);
        try {
            const res = await api<{ bio: string | null }>('PATCH', '/api/profile', { bio });
            setProfile((p) => (p ? { ...p, bio: res.bio } : p));
            setEditing(false);
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
            const ticket = await api<{
                strategy: string;
                mediaId: string;
                url: string;
                fields: Record<string, string>;
            }>('POST', '/api/profile/avatar', {
                contentType: file.type,
                contentLength: file.size,
            });

            const form = new FormData();
            for (const [k, v] of Object.entries(ticket.fields)) form.append(k, v);
            form.append('file', file);

            const upload = await fetch(ticket.url, { method: 'POST', body: form });
            if (!upload.ok) throw new Error('UPLOAD_NOT_FOUND');

            await api('POST', `/api/profile/avatar/${ticket.mediaId}/complete`);
            await load();
        } catch (err) {
            setError(say(err));
        } finally {
            setUploading(false);
        }
    };

    const toggle = async (item: Item) => {
        if (busy) return;
        setBusy(item.id);
        setError(null);
        const action = item.visibility === 'public' ? 'unpublish' : 'publish';
        try {
            const res = await api<{ id: string; visibility: Item['visibility'] }>(
                'PATCH',
                `/api/profile/media/${item.id}/${action}`,
            );
            setItems((prev) =>
                prev.map((i) => (i.id === res.id ? { ...i, visibility: res.visibility } : i)),
            );
            setProfile((p) =>
                p
                    ? {
                        ...p,
                        counts: {
                            ...p.counts,
                            published: p.counts.published + (res.visibility === 'public' ? 1 : -1),
                            private: p.counts.private + (res.visibility === 'public' ? -1 : 1),
                        },
                    }
                    : p,
            );
        } catch (err) {
            setError(say(err));
        } finally {
            setBusy(null);
        }
    };

    const copy = async () => {
        if (!profile) return;
        await navigator.clipboard.writeText(profile.publicUrl).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };

    const initials =
        `${profile?.firstname?.[0] ?? ''}${profile?.lastname?.[0] ?? ''}`.toUpperCase() || '?';
    const avatarReady = profile?.avatar?.status === 'ready' && profile.avatar.srcSet;

    return (
        <div className="relative h-full">
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-96 bg-[repeating-linear-gradient(to_right,rgba(9,9,11,0.05)_0_1px,transparent_1px_72px),repeating-linear-gradient(to_bottom,rgba(9,9,11,0.05)_0_1px,transparent_1px_72px)] mask-[radial-gradient(ellipse_80%_100%_at_50%_-10%,#000_30%,transparent_85%)]" />
            </div>

            <div className="relative h-full overflow-y-auto overscroll-contain">
                <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
                    <motion.header
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: calm ? 0 : 0.5, ease: EASE }}
                    >
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">
                            Public
                        </p>
                        <h1 className="mt-2 text-[26px] font-semibold leading-[1.15] tracking-[-0.035em]">
                            Ta vitrine
                        </h1>
                        <p className="mt-1 text-[14px] leading-relaxed text-[#666]">
                            Ce que les visiteurs voient. Tout le reste de ta bibliothèque demeure invisible.
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
                                        {avatarReady ? (
                                            <picture>
                                                <source srcSet={profile.avatar!.srcSet!.avif} type="image/avif" sizes="64px" />
                                                <source srcSet={profile.avatar!.srcSet!.webp} type="image/webp" sizes="64px" />
                                                <img
                                                    src={`${profile.avatar!.base}/160.webp`}
                                                    alt=""
                                                    width={64}
                                                    height={64}
                                                    className="size-16 rounded-full border border-[#EAEAEA] object-cover"
                                                />
                                            </picture>
                                        ) : (
                                            <span
                                                aria-hidden
                                                className="grid size-16 place-items-center rounded-full bg-[#171717] font-mono text-[18px] font-medium text-white"
                                            >
                                                {initials}
                                            </span>
                                        )}

                                        {(uploading || (profile.avatar && profile.avatar.status !== 'ready')) && (
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
                                            accept="image/jpeg,image/png,image/webp"
                                            hidden
                                            onChange={onPickAvatar}
                                        />
                                    </div>

                                    <div className="min-w-56 flex-1">
                                        <p className="font-mono text-[13px] text-[#171717]">@{profile.username}</p>

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
                                                    {profile.bio ?? (
                                                        <span className="text-[#A1A1A1]">Aucune description.</span>
                                                    )}
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
                                            <span className="text-[#171717]">{profile.counts.published} publiés</span>
                                            <span aria-hidden className="size-1 rounded-full bg-[#EAEAEA]" />
                                            <span>{profile.counts.private} privés</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 border-t border-[#EAEAEA] bg-[#FAFAFA]/60 px-5 py-3 sm:px-6">
                                    <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-[#666]">
                                        {profile.publicUrl}
                                    </code>
                                    <button
                                        type="button"
                                        onClick={copy}
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
                                <h2 className="text-[15px] font-semibold tracking-[-0.02em]">Médias</h2>
                                <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-[#EAEAEA] bg-white p-0.5">
                                    {FILTERS.map((f) => (
                                        <button
                                            key={f.id}
                                            type="button"
                                            onClick={() => setFilter(f.id)}
                                            aria-pressed={filter === f.id}
                                            className={`rounded-md px-2.5 py-1 text-[12px] transition ${filter === f.id
                                                    ? 'bg-[#171717] text-white'
                                                    : 'text-[#666] hover:text-[#171717]'
                                                }`}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                                {items.map((item, i) => (
                                    <motion.figure
                                        key={item.id}
                                        initial={{ opacity: calm ? 1 : 0, y: calm ? 0 : 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: calm ? 0 : 0.35, delay: calm ? 0 : i * 0.02, ease: EASE }}
                                        className={`group overflow-hidden rounded-xl border bg-white transition ${item.visibility === 'public' ? 'border-[#171717]' : 'border-[#EAEAEA]'
                                            }`}
                                    >
                                        <div className="relative aspect-square bg-[#FAFAFA]">
                                            {item.kind === 'video' ? (
                                                item.poster && (
                                                    <img
                                                        src={item.poster}
                                                        alt=""
                                                        loading="lazy"
                                                        decoding="async"
                                                        className="size-full object-cover"
                                                    />
                                                )
                                            ) : (
                                                item.srcSet && (
                                                    <picture>
                                                        <source srcSet={item.srcSet.avif} type="image/avif" sizes="(max-width:640px) 50vw, 25vw" />
                                                        <source srcSet={item.srcSet.webp} type="image/webp" sizes="(max-width:640px) 50vw, 25vw" />
                                                        <img
                                                            src={`${item.base}/480.webp`}
                                                            alt=""
                                                            loading="lazy"
                                                            decoding="async"
                                                            className="size-full object-cover"
                                                        />
                                                    </picture>
                                                )
                                            )}

                                            {item.kind === 'video' && item.durationMs && (
                                                <span className="absolute bottom-1.5 right-1.5 rounded bg-[#171717]/70 px-1 py-px font-mono text-[9px] tabular-nums text-white backdrop-blur">
                                                    {Math.floor(item.durationMs / 60000)}:
                                                    {String(Math.floor((item.durationMs % 60000) / 1000)).padStart(2, '0')}
                                                </span>
                                            )}

                                            {item.visibility === 'public' && (
                                                <span
                                                    title="Visible sur ta vitrine"
                                                    className="absolute left-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-[#171717] text-white"
                                                >
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                                                        <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="2.4" />
                                                        <path d="M3.4 12h17.2M12 3.4a15 15 0 0 1 0 17.2M12 3.4a15 15 0 0 0 0 17.2" stroke="currentColor" strokeWidth="2.4" />
                                                    </svg>
                                                </span>
                                            )}
                                        </div>

                                        <figcaption className="p-2">
                                            <button
                                                type="button"
                                                onClick={() => toggle(item)}
                                                disabled={busy === item.id}
                                                aria-pressed={item.visibility === 'public'}
                                                className={`flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border text-[12px] font-medium transition disabled:opacity-60 ${item.visibility === 'public'
                                                        ? 'border-[#EAEAEA] bg-white text-[#666] hover:border-[#D4D4D4] hover:text-[#171717]'
                                                        : 'border-[#171717] bg-[#171717] text-white hover:bg-[#383838]'
                                                    }`}
                                            >
                                                {busy === item.id && (
                                                    <motion.span
                                                        aria-hidden
                                                        className={`size-3 rounded-full border-2 ${item.visibility === 'public'
                                                                ? 'border-[#EAEAEA] border-t-[#171717]'
                                                                : 'border-white/30 border-t-white'
                                                            }`}
                                                        animate={{ rotate: 360 }}
                                                        transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                                                    />
                                                )}
                                                {item.visibility === 'public' ? 'Retirer' : 'Publier'}
                                            </button>
                                        </figcaption>
                                    </motion.figure>
                                ))}
                            </div>

                            {items.length === 0 && (
                                <div className="mt-4 rounded-xl border border-dashed border-[#EAEAEA] bg-white/60 px-6 py-14 text-center">
                                    <p className="text-[14px] text-[#666]">
                                        {filter === 'published'
                                            ? 'Rien de publié pour l’instant.'
                                            : 'Aucun média prêt. Dépose des fichiers depuis ta bibliothèque.'}
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}