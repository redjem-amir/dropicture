// dropicture/apps/saas/frontend/src/app/auth/library/page.tsx
'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const API = process.env.NEXT_PUBLIC_API_URL ?? '';
const PAGE_SIZE = 60;
const POLL_MS = 2500;

type Status = 'pending' | 'queued' | 'processing' | 'ready' | 'failed' | 'rejected';
type Filter = 'all' | 'published' | 'private' | 'processing';

type Item = {
  id: string;
  kind: 'image' | 'video';
  status: Status;
  visibility: 'public' | 'private';
  width: number | null;
  height: number | null;
  durationMs: number | null;
  bytes: string;
  errorCode: string | null;
  takenAt: string;
  base: string;
  srcSet: { avif: string; webp: string } | null;
  poster: string | null;
  hls: string | null;
  thumbhash: string | null;
};

type Summary = {
  counts: { total: number; published: number; private: number; pending: number; failed: number };
  bytes: string;
  months: { month: string; total: number; bytes: string }[];
  firstAt: string | null;
  limits: {
    image: { maxBytes: number };
    video: { maxBytes: number; minDurationMs: number; maxDurationMs: number };
    avatar: { maxBytes: number };
    accepted: string[];
  };
};

type Ticket =
  | { strategy: 'post'; mediaId: string; key: string; url: string; fields: Record<string, string>; expiresAt: string }
  | { strategy: 'multipart'; mediaId: string; key: string; uploadId: string; partSize: number; partUrls: { partNumber: number; url: string }[]; expiresAt: string };

type Upload = {
  localId: string;
  name: string;
  progress: number;
  state: 'sending' | 'done' | 'error';
  message?: string;
};

type Album = {
  id: string;
  title: string;
  tags: string[];
  visibility: 'private' | 'public';
  total: number;
};

type Loaded = { filter: Filter; error: string | null };

const DENSITY = {
  large: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  medium: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-7',
  small: 'grid-cols-4 sm:grid-cols-6 lg:grid-cols-10',
} as const;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'published', label: 'Publiés' },
  { key: 'private', label: 'Privés' },
  { key: 'processing', label: 'En cours' },
];

const ICON =
  'grid size-8 place-items-center rounded-lg text-[#666] transition hover:bg-[#FAFAFA] hover:text-[#171717] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#171717]/15 disabled:opacity-40 disabled:pointer-events-none';

const ERRORS: Record<string, string> = {
  FILE_TOO_LARGE: 'Fichier trop lourd',
  UNSUPPORTED_MEDIA_TYPE: 'Format non accepté',
  VIDEO_TOO_LONG: 'Vidéo trop longue',
  VIDEO_TOO_SHORT: 'Vidéo trop courte',
  IMAGE_UNREADABLE: 'Image illisible',
  VIDEO_UNREADABLE: 'Vidéo illisible',
  PROCESSING_FAILED: 'Traitement échoué',
  MEDIA_NOT_READY: 'Traitement en cours',
  BAD_CURSOR: 'Pagination expirée',
  TITLE_REQUIRED: 'Donne un nom à l’album',
  TITLE_TOO_LONG: 'Nom trop long (60 caractères)',
  NO_READY_MEDIA: 'Ces éléments ne sont pas encore prêts',
  TOO_MANY_ITEMS: 'Trop d’éléments d’un coup (200 max)',
  GALLERY_NOT_FOUND: 'Album introuvable',
};

const say = (code?: string | null) => (code && ERRORS[code]) || 'Une erreur est survenue';

const bytesLabel = (n: number) => {
  if (!n) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / 1024 ** i;
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1).replace('.', ',')} ${units[i]}`;
};

const duration = (ms: number | null) => {
  if (!ms) return null;
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  const name = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return name.charAt(0).toUpperCase() + name.slice(1);
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/api/library${path}`, {
    credentials: 'include',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.code ?? body?.message ?? String(res.status));
  }
  return res.json() as Promise<T>;
}

function send(
  method: 'POST' | 'PUT',
  url: string,
  body: XMLHttpRequestBodyInit,
  onProgress: (ratio: number) => void,
): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve(xhr)
        : reject(new Error(`S3_${xhr.status}`));
    xhr.onerror = () => reject(new Error('NETWORK'));
    xhr.send(body);
  });
}

function probeDuration(file: File): Promise<number | undefined> {
  if (!file.type.startsWith('video/')) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(el.src);
      resolve(Number.isFinite(el.duration) ? Math.round(el.duration * 1000) : undefined);
    };
    el.onerror = () => resolve(undefined);
    el.src = URL.createObjectURL(file);
  });
}

export default function Page() {
  const calm = useReducedMotion() === true;

  const [density, setDensity] = useState<keyof typeof DENSITY>('medium');
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [picker, setPicker] = useState(false);
  const [newAlbum, setNewAlbum] = useState('');

  const fileInput = useRef<HTMLInputElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  const loading = loaded?.filter !== filter;
  const error = loaded && loaded.filter === filter ? loaded.error : null;

  const accept = summary?.limits.accepted.join(',') ?? 'image/*,video/*';

  const flash = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 3200);
  }, []);

  const refreshSummary = useCallback(() => {
    api<Summary>('/summary').then(setSummary).catch(() => undefined);
  }, []);

  useEffect(() => {
    let alive = true;
    const open = () => api('/cdn-session', { method: 'POST' }).catch(() => undefined);
    open();
    const timer = window.setInterval(() => alive && open(), 45 * 60 * 1000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(refreshSummary, [refreshSummary]);

  const refreshAlbums = useCallback(() => {
    fetch(`${API}/api/galleries`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((r) => r && setAlbums(r.galleries))
      .catch(() => undefined);
  }, []);

  useEffect(refreshAlbums, [refreshAlbums]);

  useEffect(() => {
    const id = ++requestId.current;
    api<{ items: Item[]; nextCursor: string | null }>(`/?filter=${filter}&limit=${PAGE_SIZE}`)
      .then((page) => {
        if (id !== requestId.current) return;
        setItems(page.items);
        setCursor(page.nextCursor);
        setLoaded({ filter, error: null });
      })
      .catch((err: Error) => {
        if (id !== requestId.current) return;
        setItems([]);
        setCursor(null);
        setLoaded({ filter, error: say(err.message) });
      });
  }, [filter]);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    api<{ items: Item[]; nextCursor: string | null }>(
      `/?filter=${filter}&limit=${PAGE_SIZE}&cursor=${encodeURIComponent(cursor)}`,
    )
      .then((page) => {
        if (id !== requestId.current) return;
        setItems((prev) => {
          const seen = new Set(prev.map((i) => i.id));
          return [...prev, ...page.items.filter((i) => !seen.has(i.id))];
        });
        setCursor(page.nextCursor);
      })
      .catch((err: Error) => setLoaded({ filter, error: say(err.message) }))
      .finally(() => setLoadingMore(false));
  }, [cursor, filter, loadingMore]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), {
      rootMargin: '600px',
    });
    io.observe(node);
    return () => io.disconnect();
  }, [cursor, loadMore]);

  const pendingIds = useMemo(
    () => items.filter((i) => i.status !== 'ready' && i.status !== 'rejected' && i.status !== 'failed').map((i) => i.id),
    [items],
  );

  useEffect(() => {
    if (!pendingIds.length) return;
    const tick = async () => {
      try {
        const { items: fresh } = await api<{ items: Item[] }>('/status', {
          method: 'POST',
          body: JSON.stringify({ ids: pendingIds.slice(0, 200) }),
        });
        const byId = new Map(fresh.map((i) => [i.id, i]));
        let changed = false;
        setItems((prev) =>
          prev.map((i) => {
            const next = byId.get(i.id);
            if (!next || next.status === i.status) return i;
            changed = true;
            return next;
          }),
        );
        if (changed) refreshSummary();
      } catch {
        /* le prochain tour retentera */
      }
    };
    const timer = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(timer);
  }, [pendingIds, refreshSummary]);

  const upload = useCallback(
    async (file: File) => {
      const localId = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      setUploads((prev) => [...prev, { localId, name: file.name, progress: 0, state: 'sending' }]);
      const patch = (u: Partial<Upload>) =>
        setUploads((prev) => prev.map((x) => (x.localId === localId ? { ...x, ...u } : x)));

      try {
        const durationMs = await probeDuration(file);
        const ticket = await api<Ticket>('/uploads', {
          method: 'POST',
          body: JSON.stringify({
            contentType: file.type,
            contentLength: file.size,
            ...(durationMs ? { durationMs } : {}),
          }),
        });

        if (ticket.strategy === 'post') {
          const form = new FormData();
          Object.entries(ticket.fields).forEach(([k, v]) => form.append(k, v));
          form.append('file', file);
          await send('POST', ticket.url, form, (r) => patch({ progress: r * 0.95 }));
        } else {
          const parts: { partNumber: number; etag: string }[] = [];
          const total = ticket.partUrls.length;
          for (const part of ticket.partUrls) {
            const start = (part.partNumber - 1) * ticket.partSize;
            const blob = file.slice(start, start + ticket.partSize);
            const xhr = await send('PUT', part.url, blob, (r) =>
              patch({ progress: ((part.partNumber - 1 + r) / total) * 0.95 }),
            );
            const etag = xhr.getResponseHeader('ETag');
            if (!etag) throw new Error('ETAG_MISSING');
            parts.push({ partNumber: part.partNumber, etag });
          }
          await api(`/uploads/${ticket.mediaId}/multipart/complete`, {
            method: 'POST',
            body: JSON.stringify({ key: ticket.key, uploadId: ticket.uploadId, parts }),
          });
        }

        const media = await api<Item>(`/uploads/${ticket.mediaId}/complete`, { method: 'POST' });
        patch({ progress: 1, state: 'done' });
        setItems((prev) => (prev.some((i) => i.id === media.id) ? prev : [media, ...prev]));
        refreshSummary();
        window.setTimeout(
          () => setUploads((prev) => prev.filter((x) => x.localId !== localId)),
          1200,
        );
      } catch (err) {
        patch({ state: 'error', message: say((err as Error).message) });
      }
    },
    [refreshSummary],
  );

  const addFiles = useCallback(
    (list: FileList | null) => {
      if (!list?.length) return;
      Array.from(list).forEach((file) => void upload(file));
    },
    [upload],
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      const key = item.takenAt.slice(0, 7);
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(item);
      } else {
        map.set(key, [item]);
      }
    }
    const totals = new Map(summary?.months.map((m) => [m.month, m.total]) ?? []);
    return Array.from(map, ([month, list]) => ({
      month,
      items: list,
      total: totals.get(month) ?? list.length,
    }));
  }, [items, summary]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const selectGroup = (list: Item[]) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const full = list.every((i) => next.has(i.id));
      list.forEach((i) => (full ? next.delete(i.id) : next.add(i.id)));
      return next;
    });

  const ids = useMemo(() => Array.from(selected), [selected]);
  const selectedItems = useMemo(() => items.filter((i) => selected.has(i.id)), [items, selected]);
  const canPublish = selectedItems.some((i) => i.status === 'ready' && i.visibility === 'private');
  const canUnpublish = selectedItems.some((i) => i.visibility === 'public');

  const applyVisibility = async (action: 'publish' | 'unpublish') => {
    setBusy(true);
    try {
      const { done, failed } = await api<{ done: string[]; failed: { id: string; code: string }[] }>(
        `/${action}`,
        { method: 'PATCH', body: JSON.stringify({ ids }) },
      );
      const target = action === 'publish' ? 'public' : 'private';
      const touched = new Set(done);
      setItems((prev) =>
        prev.map((i) => (touched.has(i.id) ? { ...i, visibility: target as Item['visibility'] } : i)),
      );
      setSelected(new Set());
      refreshSummary();
      flash(
        failed.length
          ? `${done.length} ${action === 'publish' ? 'publiés' : 'retirés'} · ${failed.length} en échec`
          : action === 'publish'
            ? `${done.length} élément${done.length > 1 ? 's' : ''} publié${done.length > 1 ? 's' : ''}`
            : `${done.length} élément${done.length > 1 ? 's' : ''} retiré${done.length > 1 ? 's' : ''} de ta vitrine`,
      );
    } catch (err) {
      flash(say((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const trash = async () => {
    if (!window.confirm(`Supprimer ${ids.length} élément${ids.length > 1 ? 's' : ''} ?`)) return;
    setBusy(true);
    try {
      const { done } = await api<{ done: string[] }>('/trash', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });
      const gone = new Set(done);
      setItems((prev) => prev.filter((i) => !gone.has(i.id)));
      setSelected(new Set());
      refreshSummary();
      flash(`${done.length} élément${done.length > 1 ? 's' : ''} supprimé${done.length > 1 ? 's' : ''}`);
    } catch (err) {
      flash(say((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      const { items: files } = await api<{ items: { id: string; filename: string; url: string }[] }>(
        '/download',
        { method: 'POST', body: JSON.stringify({ ids }) },
      );
      files.forEach((f, i) =>
        window.setTimeout(() => {
          const a = document.createElement('a');
          a.href = f.url;
          a.download = f.filename;
          a.rel = 'noopener';
          document.body.appendChild(a);
          a.click();
          a.remove();
        }, i * 400),
      );
      flash(`${files.length} téléchargement${files.length > 1 ? 's' : ''} lancé${files.length > 1 ? 's' : ''}`);
    } catch (err) {
      flash(say((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const copyLinks = async () => {
    const links = selectedItems
      .filter((i) => i.visibility === 'public' && i.status === 'ready')
      .map((i) => `${i.base}/${i.kind === 'video' ? 'poster.jpg' : '1440.webp'}`);
    if (!links.length) {
      flash('Publie ces éléments pour obtenir un lien partageable');
      return;
    }
    try {
      await navigator.clipboard.writeText(links.join('\n'));
      flash(`${links.length} lien${links.length > 1 ? 's' : ''} copié${links.length > 1 ? 's' : ''}`);
    } catch {
      flash('Copie refusée par le navigateur');
    }
  };

  const addToAlbum = async (album: Album) => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/galleries/${album.id}/media`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.code);
      const { added } = (await res.json()) as { added: number };
      setPicker(false);
      setSelected(new Set());
      refreshAlbums();
      flash(`${added} élément${added > 1 ? 's' : ''} ajouté${added > 1 ? 's' : ''} à « ${album.title} »`);
    } catch (err) {
      flash(say((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const createAlbum = async () => {
    const title = newAlbum.trim();
    if (!title) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/galleries`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, mediaIds: ids }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.code);
      setNewAlbum('');
      setPicker(false);
      setSelected(new Set());
      refreshAlbums();
      flash(`Album « ${title} » créé`);
    } catch (err) {
      flash(say((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const totalBytes = Number(summary?.bytes ?? 0);
  const sending = uploads.filter((u) => u.state === 'sending');

  return (
    <div className="relative h-full">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-96 bg-[repeating-linear-gradient(to_right,rgba(9,9,11,0.05)_0_1px,transparent_1px_72px),repeating-linear-gradient(to_bottom,rgba(9,9,11,0.05)_0_1px,transparent_1px_72px)] mask-[radial-gradient(ellipse_80%_100%_at_50%_-10%,#000_30%,transparent_85%)]" />
      </div>

      <input
        ref={fileInput}
        type="file"
        multiple
        accept={accept}
        onChange={onPick}
        className="sr-only"
      />

      <div className="relative h-full overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          <motion.header
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: calm ? 0 : 0.5, ease: EASE }}
            className="flex flex-wrap items-end justify-between gap-4"
          >
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">Privé</p>
              <h1 className="mt-2 text-[26px] font-semibold leading-[1.15] tracking-[-0.035em]">
                Ta bibliothèque
              </h1>
              <p className="mt-1 font-mono text-[12px] tabular-nums text-[#8F8F8F]">
                {summary
                  ? `${summary.counts.total} éléments · ${summary.counts.published} publiés · ${bytesLabel(totalBytes)}`
                  : 'Chargement…'}
                {summary && summary.counts.pending > 0 && (
                  <span className="text-[#171717]"> · {summary.counts.pending} en traitement</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-0.5 rounded-lg border border-[#EAEAEA] bg-white p-0.5">
              {(['large', 'medium', 'small'] as const).map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDensity(d)}
                  aria-pressed={density === d}
                  aria-label={`Densité ${d}`}
                  className={`grid size-7 place-items-center rounded-md transition ${density === d ? 'bg-[#171717] text-white' : 'text-[#A1A1A1] hover:text-[#171717]'
                    }`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    {i === 0 && (
                      <>
                        <rect x="3" y="3" width="8" height="8" rx="1.5" />
                        <rect x="13" y="3" width="8" height="8" rx="1.5" />
                        <rect x="3" y="13" width="8" height="8" rx="1.5" />
                        <rect x="13" y="13" width="8" height="8" rx="1.5" />
                      </>
                    )}
                    {i === 1 &&
                      Array.from({ length: 9 }, (_, k) => (
                        <rect key={k} x={3 + (k % 3) * 6.5} y={3 + Math.floor(k / 3) * 6.5} width="5" height="5" rx="1" />
                      ))}
                    {i === 2 &&
                      Array.from({ length: 16 }, (_, k) => (
                        <rect key={k} x={3 + (k % 4) * 4.8} y={3 + Math.floor(k / 4) * 4.8} width="3.6" height="3.6" rx="0.7" />
                      ))}
                  </svg>
                </button>
              ))}
            </div>
          </motion.header>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: calm ? 0 : 0.5, delay: calm ? 0 : 0.05, ease: EASE }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`mt-6 flex items-center gap-3 rounded-xl border border-dashed px-4 py-3.5 transition-colors duration-200 ${dragging ? 'border-[#171717] bg-[#FAFAFA]' : 'border-[#EAEAEA] bg-white/60'
              }`}
          >
            <span
              aria-hidden
              className={`grid size-9 shrink-0 place-items-center rounded-lg border transition-colors duration-200 ${dragging ? 'border-[#171717] bg-[#171717] text-white' : 'border-[#EAEAEA] bg-[#FAFAFA] text-[#666]'
                }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 15.5V4.5M8 8.5 12 4.5l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-[#171717]">
                {dragging ? 'Relâche pour déposer' : 'Dépose tes photos et tes vidéos'}
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-[#A1A1A1]">
                {summary
                  ? `JPEG · PNG · WEBP · AVIF · HEIC · MP4 · MOV · WEBM — jusqu'à ${bytesLabel(summary.limits.video.maxBytes)}`
                  : 'JPEG · PNG · WEBP · AVIF · HEIC · MP4 · MOV · WEBM'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="h-9 shrink-0 rounded-lg border border-[#EAEAEA] bg-white px-3 text-[13px] font-medium text-[#171717] transition hover:border-[#D4D4D4] hover:bg-[#FAFAFA]"
            >
              Parcourir
            </button>
          </motion.div>
          <AnimatePresence initial={false}>
            {uploads.length > 0 && (
              <motion.ul
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: calm ? 0 : 0.24, ease: EASE }}
                className="mt-3 space-y-1.5 overflow-hidden"
              >
                {uploads.map((u) => (
                  <li
                    key={u.localId}
                    className="flex items-center gap-3 rounded-lg border border-[#EAEAEA] bg-white px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-[12px] text-[#171717]">{u.name}</span>
                    {u.state === 'error' ? (
                      <span className="font-mono text-[11px] text-[#E5484D]">{u.message}</span>
                    ) : (
                      <>
                        <span className="h-1 w-32 overflow-hidden rounded-full bg-[#F4F4F5]">
                          <span
                            className="block h-full rounded-full bg-[#171717] transition-[width] duration-200"
                            style={{ width: `${Math.round(u.progress * 100)}%` }}
                          />
                        </span>
                        <span className="w-9 text-right font-mono text-[11px] tabular-nums text-[#8F8F8F]">
                          {Math.round(u.progress * 100)}%
                        </span>
                      </>
                    )}
                    {u.state === 'error' && (
                      <button
                        type="button"
                        onClick={() => setUploads((p) => p.filter((x) => x.localId !== u.localId))}
                        className="font-mono text-[11px] text-[#8F8F8F] transition hover:text-[#171717]"
                      >
                        Fermer
                      </button>
                    )}
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
          <div className="mt-6 flex items-center gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setFilter(f.key);
                  setSelected(new Set());
                }}
                aria-pressed={filter === f.key}
                className={`h-8 rounded-lg px-3 text-[12px] font-medium transition ${filter === f.key
                    ? 'bg-[#171717] text-white'
                    : 'text-[#8F8F8F] hover:bg-[#FAFAFA] hover:text-[#171717]'
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {error && (
            <p className="mt-6 rounded-lg border border-[#FCE8E8] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#E5484D]">
              {error}
            </p>
          )}

          {loading && (
            <div className={`mt-8 grid gap-1.5 ${DENSITY[density]}`}>
              {Array.from({ length: 24 }, (_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-md bg-[#F4F4F5]" />
              ))}
            </div>
          )}

          {!loading && !items.length && !error && (
            <div className="mt-16 text-center">
              <p className="text-[15px] font-medium text-[#171717]">
                {filter === 'all' ? 'Rien ici pour l’instant' : 'Aucun élément dans ce filtre'}
              </p>
              <p className="mt-1 text-[13px] text-[#8F8F8F]">
                {filter === 'all'
                  ? 'Dépose une première photo pour démarrer ta bibliothèque.'
                  : 'Change de filtre pour retrouver le reste de ta bibliothèque.'}
              </p>
              {filter === 'all' && (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="mt-4 h-9 rounded-lg bg-[#171717] px-4 text-[13px] font-medium text-white transition hover:bg-[#383838]"
                >
                  Choisir des fichiers
                </button>
              )}
            </div>
          )}

          {groups.map((g, gi) => {
            const full = g.items.every((i) => selected.has(i.id));
            return (
              <motion.section
                key={g.month}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: calm ? 0 : 0.45, delay: calm ? 0 : Math.min(0.05 * gi, 0.2), ease: EASE }}
                className="mt-8"
              >
                <div className="sticky top-0 z-10 -mx-1 flex items-center gap-3 bg-white/85 px-1 py-2 backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => selectGroup(g.items)}
                    aria-label={`Sélectionner ${monthLabel(g.month)}`}
                    className={`grid size-4.5 shrink-0 place-items-center rounded-full border transition ${full
                        ? 'border-[#171717] bg-[#171717] text-white'
                        : 'border-[#D4D4D4] bg-white text-transparent hover:border-[#171717]'
                      }`}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <h2 className="text-[14px] font-medium tracking-[-0.01em] text-[#171717]">
                    {monthLabel(g.month)}
                  </h2>
                  <span className="font-mono text-[10px] tabular-nums text-[#A1A1A1]">
                    {g.total} élément{g.total > 1 ? 's' : ''}
                  </span>
                  <span aria-hidden className="ml-1 h-px flex-1 bg-[#EAEAEA]" />
                </div>

                <div className={`mt-2 grid gap-1.5 ${DENSITY[density]}`}>
                  {g.items.map((it) => {
                    const on = selected.has(it.id);
                    const ready = it.status === 'ready';
                    const broken = it.status === 'failed' || it.status === 'rejected';
                    const src = it.kind === 'video' ? it.poster : it.srcSet ? `${it.base}/720.webp` : null;
                    return (
                      <div
                        key={it.id}
                        className={`group relative aspect-square overflow-hidden rounded-md border bg-[#FAFAFA] transition ${on ? 'border-[#171717] ring-2 ring-[#171717]/15' : 'border-[#EAEAEA]'
                          }`}
                      >
                        {ready && src ? (
                          <picture>
                            {it.kind === 'image' && it.srcSet && (
                              <>
                                <source type="image/avif" srcSet={it.srcSet.avif} sizes="(min-width:1024px) 15vw, 33vw" />
                                <source type="image/webp" srcSet={it.srcSet.webp} sizes="(min-width:1024px) 15vw, 33vw" />
                              </>
                            )}
                            <img
                              src={src}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              draggable={false}
                              className="size-full object-cover"
                            />
                          </picture>
                        ) : broken ? (
                          <span className="grid size-full place-items-center px-2 text-center font-mono text-[9px] leading-tight text-[#E5484D]">
                            {say(it.errorCode)}
                          </span>
                        ) : (
                          <span className="grid size-full animate-pulse place-items-center bg-[#F4F4F5] font-mono text-[9px] text-[#A1A1A1]">
                            Traitement
                          </span>
                        )}

                        {it.kind === 'video' && duration(it.durationMs) && (
                          <span className="absolute bottom-1.5 right-1.5 rounded bg-[#171717]/70 px-1 py-px font-mono text-[9px] tabular-nums text-white backdrop-blur">
                            {duration(it.durationMs)}
                          </span>
                        )}
                        {it.visibility === 'public' && !on && (
                          <span
                            title="Visible sur ta vitrine"
                            className="absolute bottom-1.5 left-1.5 grid size-4 place-items-center rounded-full bg-[#171717] text-white"
                          >
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="2.4" />
                              <path d="M3.4 12h17.2M12 3.4a15 15 0 0 1 0 17.2M12 3.4a15 15 0 0 0 0 17.2" stroke="currentColor" strokeWidth="2.4" />
                            </svg>
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => toggle(it.id)}
                          aria-pressed={on}
                          aria-label="Sélectionner"
                          className={`absolute left-1.5 top-1.5 grid size-4.5 place-items-center rounded-full border transition ${on
                              ? 'border-[#171717] bg-[#171717] text-white opacity-100'
                              : 'border-white/70 bg-black/20 text-transparent opacity-0 backdrop-blur group-hover:opacity-100 focus-visible:opacity-100'
                            }`}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </motion.section>
            );
          })}

          <div ref={sentinel} aria-hidden className="h-px" />

          {loadingMore && (
            <p className="mt-6 text-center font-mono text-[11px] text-[#A1A1A1]">Chargement…</p>
          )}

          {!loading && !cursor && items.length > 0 && (
            <p className="mt-10 text-center font-mono text-[11px] text-[#A1A1A1]">
              Début de ta bibliothèque
              {summary?.firstAt
                ? ` · ${new Date(summary.firstAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : ''}
            </p>
          )}
        </div>
      </div>
      <AnimatePresence>
        {selected.size > 0 && (
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
                onClick={() => setPicker((v) => !v)}
                aria-expanded={picker}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#171717] px-2.5 text-[12px] font-medium text-white transition hover:bg-[#383838] disabled:opacity-40"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M7 5.5V4M17 5.5V4M12 9.5v5.5M9.25 12.25h5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                Ajouter à un album
              </button>

              {canUnpublish && !canPublish ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => applyVisibility('unpublish')}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#EAEAEA] px-2.5 text-[12px] font-medium text-[#171717] transition hover:bg-[#FAFAFA] disabled:opacity-40"
                >
                  Retirer de la vitrine
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy || !canPublish}
                  onClick={() => applyVisibility('publish')}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#EAEAEA] px-2.5 text-[12px] font-medium text-[#171717] transition hover:bg-[#FAFAFA] disabled:opacity-40"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M3.4 12h17.2M12 3.4a15 15 0 0 1 0 17.2M12 3.4a15 15 0 0 0 0 17.2" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                  Publier
                </button>
              )}

              <button type="button" disabled={busy} onClick={copyLinks} className={ICON} aria-label="Copier le lien">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M20.5 4 3.5 10.4l6.7 2.5 2.5 6.6L20.5 4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                </svg>
              </button>
              <button type="button" disabled={busy} onClick={download} className={ICON} aria-label="Télécharger">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 4.5V15M8 11l4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4.5 16v2.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={trash}
                className="grid size-8 place-items-center rounded-lg text-[#666] transition hover:bg-[#FEF2F2] hover:text-[#E5484D] disabled:opacity-40"
                aria-label="Supprimer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4.5 6.5h15M9.5 6.5V4.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7M6.5 6.5l.8 13a1.3 1.3 0 0 0 1.3 1.2h6.8a1.3 1.3 0 0 0 1.3-1.2l.8-13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <span aria-hidden className="mx-1 h-5 w-px bg-[#EAEAEA]" />
              <button
                type="button"
                onClick={() => {
                  setSelected(new Set());
                  setPicker(false);
                }}
                className="rounded-lg px-2.5 py-1.5 text-[12px] text-[#8F8F8F] transition hover:text-[#171717]"
              >
                Annuler
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {picker && selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: calm ? 0 : 0.2, ease: EASE }}
            className="absolute inset-x-0 bottom-20 z-30 flex justify-center px-4"
          >
            <div className="w-full max-w-sm rounded-xl border border-[#EAEAEA] bg-white/95 p-2 shadow-[0_1px_2px_rgba(9,9,11,0.04),0_16px_40px_-16px_rgba(9,9,11,0.22)] backdrop-blur-xl">
              <p className="px-2 pb-1.5 pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">
                Ajouter {selected.size} élément{selected.size > 1 ? 's' : ''} à
              </p>

              <div className="max-h-56 overflow-y-auto">
                {albums.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    disabled={busy}
                    onClick={() => addToAlbum(a)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-[#FAFAFA] disabled:opacity-40"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] text-[#171717]">{a.title}</span>
                    {a.visibility === 'public' && (
                      <span className="rounded bg-[#171717] px-1.5 py-px font-mono text-[9px] text-white">
                        publié
                      </span>
                    )}
                    <span className="font-mono text-[11px] tabular-nums text-[#A1A1A1]">{a.total}</span>
                  </button>
                ))}
                {!albums.length && (
                  <p className="px-2 py-3 text-[12px] text-[#8F8F8F]">
                    Aucun album pour l’instant. Donne-lui le nom que tu veux.
                  </p>
                )}
              </div>

              <div className="mt-1 flex items-center gap-1.5 border-t border-[#EAEAEA] pt-2">
                <input
                  value={newAlbum}
                  onChange={(e) => setNewAlbum(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createAlbum()}
                  maxLength={60}
                  placeholder="Nouvel album…"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-[#EAEAEA] px-2.5 text-[13px] text-[#171717] outline-none transition placeholder:text-[#A1A1A1] focus:border-[#171717]"
                />
                <button
                  type="button"
                  disabled={busy || !newAlbum.trim()}
                  onClick={createAlbum}
                  className="h-9 shrink-0 rounded-lg bg-[#171717] px-3 text-[12px] font-medium text-white transition hover:bg-[#383838] disabled:opacity-40"
                >
                  Créer
                </button>
              </div>
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
            className={`pointer-events-none absolute inset-x-0 z-30 mx-auto w-fit rounded-lg bg-[#171717] px-3 py-1.5 text-[12px] text-white ${selected.size > 0 || sending.length ? 'bottom-20' : 'bottom-4'
              }`}
          >
            {toast}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}