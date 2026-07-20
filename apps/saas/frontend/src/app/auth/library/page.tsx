// dropicture/apps/saas/frontend/src/app/auth/library/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const API = process.env.NEXT_PUBLIC_API_URL ?? '';
const PAGE_SIZE = 60;

type MediaView = {
  id: string;
  kind: 'image' | 'video';
  width: number | null;
  height: number | null;
  durationMs: number | null;
  url: string;
};

type Item = MediaView & { bytes: string; takenAt: string; published: boolean };

type Album = {
  id: string;
  title: string;
  total: number;
  published: number;
  cover: MediaView | null;
  updatedAt: string;
};

type Summary = {
  counts: { private: number; published: number };
  bytes: string;
  months: { month: string; total: number }[];
  firstAt: string | null;
  limits: { image: { maxBytes: number }; video: { maxBytes: number }; accepted: string[] };
};

type Upload = {
  localId: string;
  name: string;
  progress: number;
  state: 'sending' | 'error';
  message?: string;
};

type Bulk = { done: string[]; failed: { id: string; code: string }[] };

const DENSITY = {
  large: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  medium: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-7',
  small: 'grid-cols-4 sm:grid-cols-6 lg:grid-cols-10',
} as const;

const ICON =
  'grid size-8 place-items-center rounded-lg text-[#666] transition hover:bg-[#FAFAFA] hover:text-[#171717] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#171717]/15 disabled:opacity-40 disabled:pointer-events-none';

const ERRORS: Record<string, string> = {
  FILE_TOO_LARGE: 'Fichier trop lourd',
  FILE_REQUIRED: 'Fichier vide',
  UNSUPPORTED_MEDIA_TYPE: 'Format non accepté',
  UPLOAD_FAILED: 'Envoi interrompu',
  NETWORK: 'Connexion perdue',
  BAD_CURSOR: 'Pagination expirée',
  TITLE_REQUIRED: 'Donne un nom à l’album',
  TITLE_TOO_LONG: 'Nom trop long (60 caractères)',
  ALBUM_TITLE_TAKEN: 'Tu as déjà un album à ce nom',
  ALBUM_NOT_FOUND: 'Album introuvable',
  NOT_IN_ALBUM: 'Cet élément n’est pas dans l’album',
  NO_MEDIA: 'Aucun élément valide dans cette sélection',
  TOO_MANY_ITEMS: 'Trop d’éléments d’un coup (200 max)',
  MEDIA_NOT_FOUND: 'Élément introuvable',
  AVATAR_NOT_ALLOWED: 'La photo de profil se gère depuis ta vitrine',
  ALREADY_PUBLIC: 'Déjà en vitrine',
  ALREADY_PRIVATE: 'Déjà privé',
  PUBLISH_FAILED: 'Publication impossible',
  UNPUBLISH_FAILED: 'Retrait impossible',
  DELETE_FAILED: 'Suppression impossible',
};

const say = (code?: string | null) => (code && ERRORS[code]) || 'Une erreur est survenue';
const plural = (n: number) => (n > 1 ? 's' : '');

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

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  const name = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return name.charAt(0).toUpperCase() + name.slice(1);
};

async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${API}/api/library${path}`, {
    method: init?.method ?? 'GET',
    credentials: 'include',
    ...(init?.body === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(init.body) }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.code ?? String(res.status));
  }
  return res.json() as Promise<T>;
}

function sendFile<T>(url: string, file: File, onProgress: (ratio: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let body: { code?: string } | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* réponse illisible */
      }
      if (xhr.status >= 200 && xhr.status < 300 && body) resolve(body as T);
      else reject(new Error(body?.code ?? String(xhr.status)));
    };
    xhr.onerror = () => reject(new Error('NETWORK'));
    xhr.send(file);
  });
}

function probeMeta(file: File): Promise<{ width?: number; height?: number; durationMs?: number }> {
  if (file.type.startsWith('image/')) {
    return createImageBitmap(file)
      .then((bmp) => {
        const meta = { width: bmp.width, height: bmp.height };
        bmp.close();
        return meta;
      })
      .catch(() => ({}));
  }
  if (!file.type.startsWith('video/')) return Promise.resolve({});
  return new Promise((resolve) => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      const meta = {
        width: el.videoWidth || undefined,
        height: el.videoHeight || undefined,
        durationMs: Number.isFinite(el.duration) ? Math.round(el.duration * 1000) : undefined,
      };
      URL.revokeObjectURL(el.src);
      resolve(meta);
    };
    el.onerror = () => resolve({});
    el.src = URL.createObjectURL(file);
  });
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

  const [density, setDensity] = useState<keyof typeof DENSITY>('medium');
  const [album, setAlbum] = useState<string | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newAlbum, setNewAlbum] = useState('');
  const [viewer, setViewer] = useState<number | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  const current = albums.find((a) => a.id === album) ?? null;
  const accept = summary?.limits.accepted.join(',') ?? 'image/*,video/*';

  const flash = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 3200);
  }, []);

  const refreshSummary = useCallback(() => {
    api<Summary>('/summary').then(setSummary).catch(() => undefined);
  }, []);

  const refreshAlbums = useCallback(() => {
    api<{ albums: Album[] }>('/albums')
      .then((r) => setAlbums(r.albums))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshSummary();
    refreshAlbums();
  }, [refreshSummary, refreshAlbums]);

  const query = useCallback(
    (next?: string) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (album) params.set('album', album);
      if (next) params.set('cursor', next);
      return `/?${params}`;
    },
    [album],
  );

  const key = `${nonce}:${query()}`;
  const loading = loadedKey !== key;

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    requestId.current += 1;
    api<{ items: Item[]; nextCursor: string | null }>(query())
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setCursor(page.nextCursor);
        setError(null);
        scroller.current?.scrollTo({ top: 0 });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setItems([]);
        setCursor(null);
        setError(say(err.message));
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [key, query]);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    api<{ items: Item[]; nextCursor: string | null }>(query(cursor))
      .then((page) => {
        if (id !== requestId.current) return;
        setItems((prev) => {
          const seen = new Set(prev.map((i) => i.id));
          return [...prev, ...page.items.filter((i) => !seen.has(i.id))];
        });
        setCursor(page.nextCursor);
      })
      .catch((err: Error) => setError(say(err.message)))
      .finally(() => setLoadingMore(false));
  }, [cursor, loadingMore, query]);

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

  const upload = useCallback(
    async (file: File) => {
      const localId = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      setUploads((prev) => [...prev, { localId, name: file.name, progress: 0, state: 'sending' }]);
      const patch = (u: Partial<Upload>) =>
        setUploads((prev) => prev.map((x) => (x.localId === localId ? { ...x, ...u } : x)));
      try {
        const meta = await probeMeta(file);
        const params = new URLSearchParams();
        if (meta.width) params.set('w', String(meta.width));
        if (meta.height) params.set('h', String(meta.height));
        if (meta.durationMs) params.set('d', String(meta.durationMs));
        if (file.lastModified) params.set('takenAt', new Date(file.lastModified).toISOString());
        if (album) params.set('album', album);
        const media = await sendFile<Item>(
          `${API}/api/library/uploads?${params}`,
          file,
          (r) => patch({ progress: r }),
        );
        setItems((prev) => (prev.some((i) => i.id === media.id) ? prev : [media, ...prev]));
        setUploads((prev) => prev.filter((x) => x.localId !== localId));
        refreshSummary();
        refreshAlbums();
      } catch (err) {
        patch({ state: 'error', message: say((err as Error).message) });
      }
    },
    [album, refreshSummary, refreshAlbums],
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
    if (album) return [{ month: '', items, total: items.length }];
    const map = new Map<string, Item[]>();
    for (const item of items) {
      const k = item.takenAt.slice(0, 7);
      const bucket = map.get(k);
      if (bucket) bucket.push(item);
      else map.set(k, [item]);
    }
    const totals = new Map(summary?.months.map((m) => [m.month, m.total]) ?? []);
    return Array.from(map, ([month, list]) => ({
      month,
      items: list,
      total: totals.get(month) ?? list.length,
    }));
  }, [items, summary, album]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
  const chosen = useMemo(() => items.filter((i) => selected.has(i.id)), [items, selected]);
  const privateIds = chosen.filter((i) => !i.published).map((i) => i.id);
  const publicIds = chosen.filter((i) => i.published).map((i) => i.id);

  const clear = () => {
    setSelected(new Set());
    setPicker(false);
  };

  const openAlbum = (id: string | null) => {
    setAlbum(id);
    setViewer(null);
    clear();
  };

  const publish = async (target = privateIds) => {
    if (!target.length) return;
    setBusy(true);
    try {
      const { done, failed } = await api<Bulk>('/publish', { method: 'PATCH', body: { ids: target } });
      const touched = new Set(done);
      setItems((prev) =>
        album
          ? prev.map((i) => (touched.has(i.id) ? { ...i, published: true } : i))
          : prev.filter((i) => !touched.has(i.id)),
      );
      if (!album) setViewer(null);
      clear();
      refreshSummary();
      refreshAlbums();
      flash(
        failed.length
          ? `${done.length} en vitrine · ${failed.length} en échec (${say(failed[0].code)})`
          : `${done.length} élément${plural(done.length)} en vitrine`,
      );
    } catch (err) {
      flash(say((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async (target = publicIds) => {
    if (!target.length) return;
    setBusy(true);
    try {
      const { done } = await api<Bulk>('/unpublish', { method: 'PATCH', body: { ids: target } });
      const touched = new Set(done);
      setItems((prev) => prev.map((i) => (touched.has(i.id) ? { ...i, published: false } : i)));
      clear();
      refreshSummary();
      refreshAlbums();
      if (!album) reload();
      flash(`${done.length} élément${plural(done.length)} de retour en privé`);
    } catch (err) {
      flash(say((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const destroy = async (target = ids) => {
    if (!target.length) return;
    const many = target.length > 1;
    if (
      !window.confirm(
        many
          ? `Supprimer définitivement ces ${target.length} éléments ? Les fichiers seront effacés, sans récupération possible.`
          : 'Supprimer définitivement cet élément ? Le fichier sera effacé, sans récupération possible.',
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const { done, failed } = await api<Bulk>('/media', { method: 'DELETE', body: { ids: target } });
      const gone = new Set(done);
      setItems((prev) => prev.filter((i) => !gone.has(i.id)));
      setViewer(null);
      clear();
      refreshSummary();
      refreshAlbums();
      flash(
        failed.length
          ? `${done.length} supprimé${plural(done.length)} · ${failed.length} en échec (${say(failed[0].code)})`
          : `${done.length} élément${plural(done.length)} supprimé${plural(done.length)}`,
      );
    } catch (err) {
      flash(say((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const download = async (target = ids) => {
    if (!target.length) return;
    setBusy(true);
    try {
      const { items: files } = await api<{ items: { id: string; filename: string; url: string }[] }>(
        '/download',
        { method: 'POST', body: { ids: target } },
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
      flash(`${files.length} téléchargement${plural(files.length)} lancé${plural(files.length)}`);
    } catch (err) {
      flash(say((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const addToAlbum = async (target: Album) => {
    setBusy(true);
    try {
      const { added, skipped } = await api<{ added: number; skipped: number }>(
        `/albums/${target.id}/media`,
        { method: 'POST', body: { ids } },
      );
      clear();
      refreshAlbums();
      flash(
        skipped
          ? `${added} rangé${plural(added)} dans « ${target.title} » · ${skipped} déjà présent${plural(skipped)}`
          : `${added} élément${plural(added)} rangé${plural(added)} dans « ${target.title} »`,
      );
    } catch (err) {
      flash(say((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const removeFromAlbum = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const { removed } = await api<{ removed: number }>(`/albums/${current.id}/media`, {
        method: 'DELETE',
        body: { ids },
      });
      const gone = new Set(ids);
      setItems((prev) => prev.filter((i) => !gone.has(i.id)));
      clear();
      refreshAlbums();
      flash(`${removed} élément${plural(removed)} retiré${plural(removed)} de « ${current.title} »`);
    } catch (err) {
      flash(say((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const setCover = async (mediaId?: string) => {
    const target = mediaId ?? (ids.length === 1 ? ids[0] : null);
    if (!current || !target) return;
    setBusy(true);
    try {
      await api(`/albums/${current.id}/cover/${target}`, { method: 'PATCH' });
      clear();
      refreshAlbums();
      flash('Couverture mise à jour');
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
      const created = await api<Album>('/albums', { method: 'POST', body: { title, mediaIds: ids } });
      setNewAlbum('');
      setCreating(false);
      clear();
      refreshAlbums();
      flash(
        created.total
          ? `Album « ${created.title} » créé avec ${created.total} élément${plural(created.total)}`
          : `Album « ${created.title} » créé`,
      );
    } catch (err) {
      flash(say((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const renameAlbum = async () => {
    if (!current) return;
    const title = window.prompt('Nouveau nom de l’album', current.title)?.trim();
    if (!title || title === current.title) return;
    setBusy(true);
    try {
      await api(`/albums/${current.id}`, { method: 'PATCH', body: { title } });
      refreshAlbums();
      flash(`Album renommé « ${title} »`);
    } catch (err) {
      flash(say((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const deleteAlbum = async () => {
    if (!current) return;
    if (!window.confirm(`Supprimer l’album « ${current.title} » ? Les fichiers sont conservés.`)) return;
    setBusy(true);
    try {
      await api(`/albums/${current.id}`, { method: 'DELETE' });
      openAlbum(null);
      refreshAlbums();
      flash('Album supprimé · les fichiers restent dans ta bibliothèque');
    } catch (err) {
      flash(say((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const totalBytes = Number(summary?.bytes ?? 0);
  const sending = uploads.some((u) => u.state === 'sending');
  const open = viewer !== null ? items[viewer] ?? null : null;

  return (
    <div className="relative h-full">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-96 bg-[repeating-linear-gradient(to_right,rgba(9,9,11,0.05)_0_1px,transparent_1px_72px),repeating-linear-gradient(to_bottom,rgba(9,9,11,0.05)_0_1px,transparent_1px_72px)] mask-[radial-gradient(ellipse_80%_100%_at_50%_-10%,#000_30%,transparent_85%)]" />
      </div>
      <input ref={fileInput} type="file" multiple accept={accept} onChange={onPick} className="sr-only" />
      <div ref={scroller} className="relative h-full overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          <motion.header
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: calm ? 0 : 0.5, ease: EASE }}
            className="flex flex-wrap items-end justify-between gap-4"
          >
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">
                {current ? 'Album' : 'Privé'}
              </p>
              <h1 className="mt-2 text-[26px] font-semibold leading-[1.15] tracking-[-0.035em]">
                {current ? current.title : 'Ta bibliothèque'}
              </h1>
              <p className="mt-1 text-[14px] leading-relaxed text-[#666]">
                {current
                  ? 'Un album range tes fichiers sans rien exposer. Publier envoie l’élément sur ta vitrine.'
                  : 'Toi seul vois ces fichiers. Publier en envoie un sur ta vitrine.'}
              </p>
              <p className="mt-1 font-mono text-[12px] tabular-nums text-[#8F8F8F]">
                {current
                  ? `${current.total} élément${plural(current.total)} · ${current.published} en vitrine`
                  : summary
                    ? `${summary.counts.private} élément${plural(summary.counts.private)} privé${plural(summary.counts.private)} · ${bytesLabel(totalBytes)}`
                    : 'Chargement…'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!!summary?.counts.published && (
                <Link
                  href="/auth/profile"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#EAEAEA] bg-white px-2.5 font-mono text-[11px] tabular-nums text-[#666] transition hover:border-[#D4D4D4] hover:text-[#171717]"
                >
                  {summary.counts.published} en vitrine
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              )}
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
                {dragging
                  ? 'Relâche pour déposer'
                  : current
                    ? `Déposer dans « ${current.title} »`
                    : 'Dépose tes photos et tes vidéos'}
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-[#A1A1A1]">
                {summary
                  ? `Arrive en privé · jusqu'à ${bytesLabel(summary.limits.video.maxBytes)} par fichier`
                  : 'Arrive en privé'}
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
                      <>
                        <span className="font-mono text-[11px] text-[#E5484D]">{u.message}</span>
                        <button
                          type="button"
                          onClick={() => setUploads((p) => p.filter((x) => x.localId !== u.localId))}
                          className="font-mono text-[11px] text-[#8F8F8F] transition hover:text-[#171717]"
                        >
                          Fermer
                        </button>
                      </>
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
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
          <section className="mt-8">
            <div className="flex flex-wrap items-center gap-3">
              {current ? (
                <>
                  <button
                    type="button"
                    onClick={() => openAlbum(null)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#EAEAEA] bg-white px-2.5 text-[12px] font-medium text-[#171717] transition hover:border-[#D4D4D4]"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Toute la bibliothèque
                  </button>
                  <span className="ml-auto flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={renameAlbum}
                      className="h-8 rounded-lg border border-[#EAEAEA] bg-white px-2.5 text-[12px] font-medium text-[#171717] transition hover:border-[#D4D4D4] disabled:opacity-40"
                    >
                      Renommer
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={deleteAlbum}
                      className="h-8 rounded-lg border border-[#EAEAEA] bg-white px-2.5 text-[12px] font-medium text-[#666] transition hover:border-[#FCE8E8] hover:bg-[#FEF2F2] hover:text-[#E5484D] disabled:opacity-40"
                    >
                      Supprimer l’album
                    </button>
                  </span>
                </>
              ) : (
                <>
                  <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">
                    Albums · rangement privé
                  </h2>
                  {!creating && (
                    <button
                      type="button"
                      onClick={() => setCreating(true)}
                      className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#EAEAEA] bg-white px-2.5 text-[12px] font-medium text-[#171717] transition hover:border-[#D4D4D4]"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      Nouvel album
                    </button>
                  )}
                </>
              )}
            </div>
            {!current && creating && (
              <div className="mt-3 flex items-center gap-1.5">
                <input
                  autoFocus
                  value={newAlbum}
                  onChange={(e) => setNewAlbum(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void createAlbum();
                    if (e.key === 'Escape') {
                      setCreating(false);
                      setNewAlbum('');
                    }
                  }}
                  maxLength={60}
                  placeholder="Nom de l’album…"
                  className="h-9 min-w-0 max-w-xs flex-1 rounded-lg border border-[#EAEAEA] px-2.5 text-[13px] text-[#171717] outline-none transition placeholder:text-[#A1A1A1] focus:border-[#171717]"
                />
                <button
                  type="button"
                  disabled={busy || !newAlbum.trim()}
                  onClick={createAlbum}
                  className="h-9 shrink-0 rounded-lg bg-[#171717] px-3 text-[12px] font-medium text-white transition hover:bg-[#383838] disabled:opacity-40"
                >
                  Créer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setNewAlbum('');
                  }}
                  className="px-2 text-[12px] text-[#8F8F8F] transition hover:text-[#171717]"
                >
                  Annuler
                </button>
              </div>
            )}
            {!current && albums.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {albums.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => openAlbum(a.id)}
                    className="group overflow-hidden rounded-xl border border-[#EAEAEA] bg-white text-left transition hover:border-[#D4D4D4]"
                  >
                    <div className="relative aspect-4/3 bg-[#F4F4F5]">
                      {a.cover ? (
                        <>
                          <Thumb
                            item={a.cover}
                            className="absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          />
                          {a.cover.kind === 'video' && <PlayBadge />}
                        </>
                      ) : (
                        <span className="absolute inset-0 grid place-items-center font-mono text-[10px] text-[#A1A1A1]">
                          vide
                        </span>
                      )}
                      {a.published > 0 && (
                        <span className="absolute right-2 top-2 rounded bg-[#171717] px-1.5 py-px font-mono text-[9px] text-white">
                          {a.published} en vitrine
                        </span>
                      )}
                    </div>
                    <div className="px-3 py-2">
                      <p className="truncate text-[13px] font-medium text-[#171717]">{a.title}</p>
                      <p className="font-mono text-[10px] tabular-nums text-[#A1A1A1]">
                        {a.total} élément{plural(a.total)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {!current && !albums.length && !creating && (
              <p className="mt-3 text-[13px] text-[#8F8F8F]">
                Aucun album. Crées-en un pour regrouper tes fichiers, ça ne les rend pas publics.
              </p>
            )}
          </section>
          {error && (
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-[#FCE8E8] bg-[#FEF2F2] px-3 py-2.5">
              <p className="flex-1 text-[12px] text-[#E5484D]">{error}</p>
              <button
                type="button"
                onClick={reload}
                className="h-7 rounded-md border border-[#FCE8E8] bg-white px-2.5 text-[12px] font-medium text-[#E5484D] transition hover:border-[#E5484D]"
              >
                Réessayer
              </button>
            </div>
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
                {current ? 'Cet album est vide' : 'Rien en privé pour l’instant'}
              </p>
              <p className="mt-1 text-[13px] text-[#8F8F8F]">
                {current
                  ? 'Dépose des fichiers ici, ou sélectionne-les depuis la bibliothèque et range-les dans cet album.'
                  : summary?.counts.published
                    ? 'Tout ce que tu as déposé est passé en vitrine.'
                    : 'Dépose une première photo : elle restera privée tant que tu ne la publies pas.'}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="h-9 rounded-lg bg-[#171717] px-4 text-[13px] font-medium text-white transition hover:bg-[#383838]"
                >
                  Choisir des fichiers
                </button>
                {current && (
                  <button
                    type="button"
                    onClick={() => openAlbum(null)}
                    className="h-9 rounded-lg border border-[#EAEAEA] bg-white px-4 text-[13px] font-medium text-[#171717] transition hover:border-[#D4D4D4]"
                  >
                    Voir toute la bibliothèque
                  </button>
                )}
              </div>
            </div>
          )}
          {groups.map((g, gi) => {
            const full = g.items.every((i) => selected.has(i.id));
            return (
              <motion.section
                key={g.month || 'album'}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: calm ? 0 : 0.45, delay: calm ? 0 : Math.min(0.05 * gi, 0.2), ease: EASE }}
                className="mt-8"
              >
                {g.items.length > 0 && (
                  <div className="sticky top-0 z-10 -mx-1 flex items-center gap-3 bg-white/85 px-1 py-2 backdrop-blur-md">
                    <button
                      type="button"
                      onClick={() => selectGroup(g.items)}
                      aria-label="Tout sélectionner"
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
                      {g.month ? monthLabel(g.month) : 'Contenu de l’album'}
                    </h2>
                    <span className="font-mono text-[10px] tabular-nums text-[#A1A1A1]">
                      {g.total} élément{plural(g.total)}
                    </span>
                    <span aria-hidden className="ml-1 h-px flex-1 bg-[#EAEAEA]" />
                  </div>
                )}
                <div className={`mt-2 grid gap-1.5 ${DENSITY[density]}`}>
                  {g.items.map((it) => {
                    const on = selected.has(it.id);
                    return (
                      <div
                        key={it.id}
                        className={`group relative aspect-square overflow-hidden rounded-md border bg-[#FAFAFA] transition ${on ? 'border-[#171717] ring-2 ring-[#171717]/15' : 'border-[#EAEAEA]'
                          }`}
                      >
                        <button
                          type="button"
                          onClick={() => goTo(items.findIndex((x) => x.id === it.id))}
                          aria-label="Ouvrir"
                          className="absolute inset-0 size-full"
                        >
                          <Thumb item={it} className="size-full object-cover" />
                          {it.kind === 'video' && <PlayBadge />}
                        </button>
                        {it.kind === 'video' && duration(it.durationMs) && (
                          <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded bg-[#171717]/70 px-1 py-px font-mono text-[9px] tabular-nums text-white backdrop-blur">
                            {duration(it.durationMs)}
                          </span>
                        )}
                        {it.published && (
                          <span
                            title="En vitrine"
                            className="pointer-events-none absolute bottom-1.5 left-1.5 grid size-4 place-items-center rounded-full bg-[#171717] text-white"
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
            <div className={`mt-4 grid gap-1.5 ${DENSITY[density]}`}>
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-md bg-[#F4F4F5]" />
              ))}
            </div>
          )}
          {!loading && !loadingMore && !cursor && items.length > 0 && !album && (
            <p className="mt-10 text-center font-mono text-[11px] text-[#A1A1A1]">
              Début de ta bibliothèque
              {summary?.firstAt ? ` · ${dayLabel(summary.firstAt)}` : ''}
            </p>
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
                <p className="truncate text-[13px] font-medium text-white">{dayLabel(open.takenAt)}</p>
                <p className="truncate font-mono text-[11px] text-white/60">
                  {bytesLabel(Number(open.bytes))}
                  {open.width && open.height ? ` · ${open.width}×${open.height}` : ''}
                  {open.published ? ' · en vitrine' : ' · privé'}
                </p>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-1">
                {open.published ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => unpublish([open.id])}
                    className="h-8 rounded-lg border border-white/25 px-3 text-[12px] font-medium text-white/80 transition hover:text-white disabled:opacity-40"
                  >
                    Retirer de la vitrine
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => publish([open.id])}
                    className="h-8 rounded-lg border border-white bg-white px-3 text-[12px] font-medium text-[#171717] transition hover:bg-white/90 disabled:opacity-40"
                  >
                    Publier en vitrine
                  </button>
                )}
                {current && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setCover(open.id)}
                    className="h-8 rounded-lg border border-white/25 px-3 text-[12px] font-medium text-white/80 transition hover:text-white disabled:opacity-40"
                  >
                    Couverture
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => download([open.id])}
                  className="grid size-8 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                  aria-label="Télécharger"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M12 4.5V15M8 11l4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4.5 16v2.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => destroy([open.id])}
                  className="grid size-8 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-[#FF9B9B] disabled:opacity-40"
                  aria-label="Supprimer définitivement"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M4.5 6.5h15M9.5 6.5V4.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7M6.5 6.5l.8 13a1.3 1.3 0 0 0 1.3 1.2h6.8a1.3 1.3 0 0 0 1.3-1.2l.8-13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setViewer(null)}
                  aria-label="Fermer"
                  className="grid size-8 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
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
            <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1 rounded-xl border border-[#EAEAEA] bg-white/90 p-1.5 shadow-[0_1px_2px_rgba(9,9,11,0.04),0_16px_40px_-16px_rgba(9,9,11,0.22)] backdrop-blur-xl">
              <span className="px-2 font-mono text-[12px] tabular-nums text-[#171717]">{selected.size}</span>
              <span aria-hidden className="mx-1 h-5 w-px bg-[#EAEAEA]" />
              {privateIds.length > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => publish()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#171717] px-2.5 text-[12px] font-medium text-white transition hover:bg-[#383838] disabled:opacity-40"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M3.4 12h17.2M12 3.4a15 15 0 0 1 0 17.2M12 3.4a15 15 0 0 0 0 17.2" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                  Publier{privateIds.length !== selected.size ? ` (${privateIds.length})` : ''}
                </button>
              )}
              {publicIds.length > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => unpublish()}
                  className="inline-flex h-8 items-center rounded-lg border border-[#EAEAEA] px-2.5 text-[12px] font-medium text-[#171717] transition hover:bg-[#FAFAFA] disabled:opacity-40"
                >
                  Retirer de la vitrine{publicIds.length !== selected.size ? ` (${publicIds.length})` : ''}
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => setPicker((v) => !v)}
                aria-expanded={picker}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#EAEAEA] px-2.5 text-[12px] font-medium text-[#171717] transition hover:bg-[#FAFAFA] disabled:opacity-40"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M7 5.5V4M17 5.5V4M12 9.5v5.5M9.25 12.25h5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                Ranger dans un album
              </button>
              {current && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={removeFromAlbum}
                    className="inline-flex h-8 items-center rounded-lg border border-[#EAEAEA] px-2.5 text-[12px] font-medium text-[#666] transition hover:bg-[#FAFAFA] hover:text-[#171717] disabled:opacity-40"
                  >
                    Retirer de l’album
                  </button>
                  {selected.size === 1 && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setCover()}
                      className="inline-flex h-8 items-center rounded-lg border border-[#EAEAEA] px-2.5 text-[12px] font-medium text-[#666] transition hover:bg-[#FAFAFA] hover:text-[#171717] disabled:opacity-40"
                    >
                      Couverture
                    </button>
                  )}
                </>
              )}
              <button type="button" disabled={busy} onClick={() => download()} className={ICON} aria-label="Télécharger">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 4.5V15M8 11l4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4.5 16v2.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => destroy()}
                className="grid size-8 place-items-center rounded-lg text-[#666] transition hover:bg-[#FEF2F2] hover:text-[#E5484D] disabled:opacity-40"
                aria-label="Supprimer définitivement"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4.5 6.5h15M9.5 6.5V4.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7M6.5 6.5l.8 13a1.3 1.3 0 0 0 1.3 1.2h6.8a1.3 1.3 0 0 0 1.3-1.2l.8-13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <span aria-hidden className="mx-1 h-5 w-px bg-[#EAEAEA]" />
              <button
                type="button"
                onClick={clear}
                className="rounded-lg px-2.5 py-1.5 text-[12px] text-[#8F8F8F] transition hover:text-[#171717]"
              >
                Annuler
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {picker && selected.size > 0 && !open && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: calm ? 0 : 0.2, ease: EASE }}
            className="absolute inset-x-0 bottom-24 z-30 flex justify-center px-4"
          >
            <div className="w-full max-w-sm rounded-xl border border-[#EAEAEA] bg-white/95 p-2 shadow-[0_1px_2px_rgba(9,9,11,0.04),0_16px_40px_-16px_rgba(9,9,11,0.22)] backdrop-blur-xl">
              <p className="px-2 pb-1.5 pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">
                Ranger {selected.size} élément{plural(selected.size)} dans
              </p>
              <div className="max-h-56 overflow-y-auto">
                {albums.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    disabled={busy || a.id === album}
                    onClick={() => addToAlbum(a)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-[#FAFAFA] disabled:opacity-40"
                  >
                    <span className="size-8 shrink-0 overflow-hidden rounded bg-[#F4F4F5]">
                      {a.cover && <Thumb item={a.cover} className="size-full object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-[#171717]">{a.title}</span>
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
            className={`pointer-events-none fixed inset-x-0 z-60 mx-auto w-fit rounded-lg bg-[#171717] px-3 py-1.5 text-[12px] text-white ${selected.size > 0 || sending ? 'bottom-20' : 'bottom-4'
              }`}
          >
            {toast}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}