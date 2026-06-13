// dropicture/app/frontend/src/app/auth/page.tsx
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TbAlbum, TbArchive, TbArchiveOff, TbArrowBackUp, TbCheck, TbChevronLeft, TbChevronRight, TbDots, TbHeart, TbHeartFilled, TbHeartOff, TbLink, TbPhoto, TbPlayerPlayFilled, TbPlus, TbShare2, TbShare3, TbTrash, TbUpload, TbX } from 'react-icons/tb'
import type { IconType } from 'react-icons'

type CollectionId = 'all' | 'favorites' | 'archive' | 'trash'
type View =
    | { kind: 'library' }
    | { kind: 'collections' }
    | { kind: 'collection'; id: CollectionId }
    | { kind: 'shared' }
    | { kind: 'album'; album: AlbumCard }

type Picture = {
    id: string
    filename: string
    kind: 'image' | 'video'
    durationSeconds: number | null
    favorite: boolean
    createdAt: string
    url: string
}

type AlbumCard = { id: string; name: string; count: number; coverUrl: string | null; createdAt: string }
type Share = { id: string; token: string; kind: 'album' | 'selection'; title: string; items: number; views: number; expiresAt: string | null; createdAt: string; path: string }
type CollMeta = { count: number; coverUrl: string | null }
type Collections = { all: CollMeta; favorites: CollMeta; archive: CollMeta; trash: CollMeta; shared: { count: number } }

type NameDialog = { mode: 'create' | 'rename'; albumId?: string; after?: 'addSelection' }
type ConfirmDialog = { title: string; message: string; confirmLabel: string; action: () => void }
type SelectionAction = { key: string; label: string; icon: IconType; danger?: boolean; onClick: () => void }

const COLLECTION_LABEL: Record<CollectionId, string> = {
    all: 'All Photos',
    favorites: 'Favorites',
    archive: 'Archive',
    trash: 'Recently Deleted',
}

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/70 focus-visible:ring-offset-2'
const BTN_PRIMARY = `inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-700 disabled:pointer-events-none disabled:opacity-60 ${FOCUS}`
const BTN_SECONDARY = `inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:border-stone-300 hover:text-stone-900 disabled:pointer-events-none disabled:opacity-50 ${FOCUS}`
const BTN_SECONDARY_SM = `inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-3.5 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:border-stone-300 hover:text-stone-900 disabled:pointer-events-none disabled:opacity-50 ${FOCUS}`
const BTN_GHOST_DANGER_SM = `inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-full px-3.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:pointer-events-none disabled:opacity-50 ${FOCUS}`
const ICON_BTN = `inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-900 ${FOCUS}`
const ICON_BTN_DARK = 'inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70'
const BADGE_BASE = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium'

const SEG_WRAP = 'inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white p-1 shadow-sm'
const segBtn = (active: boolean) => `inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${FOCUS} ${active ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'}`

const COL_BTN = `inline-flex h-14 w-16 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:pointer-events-none disabled:opacity-40 ${FOCUS}`
const COL_BTN_DANGER = `inline-flex h-14 w-16 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium text-red-600 transition-colors hover:bg-red-50 disabled:pointer-events-none disabled:opacity-40 ${FOCUS}`
const MENU_ROW = `flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:pointer-events-none disabled:opacity-40 ${FOCUS}`
const MENU_ROW_DANGER = `flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:pointer-events-none disabled:opacity-40 ${FOCUS}`

const SPINNER = (
    <svg viewBox="0 0 24 24" fill="none" className="size-4 animate-spin" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
)

function dateLabel(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return 'Unknown date'
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const that = new Date(d); that.setHours(0, 0, 0, 0)
    const diff = Math.round((start.getTime() - that.getTime()) / 86400000)
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Yesterday'
    if (diff > 1 && diff < 7) return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    const sameYear = d.getFullYear() === new Date().getFullYear()
    return d.toLocaleDateString('en-US', sameYear ? { month: 'long', day: 'numeric' } : { month: 'long', day: 'numeric', year: 'numeric' })
}
function formatDuration(s: number): string {
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
}
function shortDate(iso: string): string {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function expiryBadge(iso: string | null): { tone: string; label: string } {
    if (!iso) return { tone: 'border-stone-200 bg-stone-50 text-stone-600', label: 'No expiration' }
    const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
    if (days <= 0) return { tone: 'border-red-200 bg-red-50 text-red-700', label: 'Expired' }
    if (days <= 1) return { tone: 'border-amber-200 bg-amber-50 text-amber-700', label: 'Expires today' }
    if (days <= 7) return { tone: 'border-amber-200 bg-amber-50 text-amber-700', label: `${days} days left` }
    return { tone: 'border-stone-200 bg-stone-50 text-stone-600', label: `${days} days left` }
}
function plural(n: number): string {
    return `${n.toLocaleString('en-US')} item${n === 1 ? '' : 's'}`
}

export default function LibraryPage() {
    const [view, setView] = useState<View>({ kind: 'library' })
    const [notice, setNotice] = useState<string | null>(null)

    const [collections, setCollections] = useState<Collections | null>(null)
    const [albums, setAlbums] = useState<AlbumCard[]>([])
    const [homeLoading, setHomeLoading] = useState(true)

    const [items, setItems] = useState<Picture[]>([])
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [gridLoading, setGridLoading] = useState(false)
    const [gridError, setGridError] = useState<string | null>(null)
    const [loadingMore, setLoadingMore] = useState(false)

    const [shares, setShares] = useState<Share[]>([])
    const [sharesLoading, setSharesLoading] = useState(false)

    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [selectMode, setSelectMode] = useState(false)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [busy, setBusy] = useState(false)
    const [actionMenuOpen, setActionMenuOpen] = useState(false)

    const [pickerOpen, setPickerOpen] = useState(false)
    const [nameDialog, setNameDialog] = useState<NameDialog | null>(null)
    const [nameValue, setNameValue] = useState('')
    const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null)
    const [lightboxId, setLightboxId] = useState<string | null>(null)
    const lightboxDirty = useRef(false)

    const [dragOver, setDragOver] = useState(false)
    const dragDepth = useRef(0)

    const flash = (msg: string) => {
        setNotice(msg)
        window.setTimeout(() => setNotice(n => (n === msg ? null : n)), 3200)
    }
    const exitSelect = useCallback(() => { setSelectMode(false); setSelected(new Set()); setActionMenuOpen(false) }, [])

    const refreshCounts = useCallback(async () => {
        try {
            const res = await fetch('/api/pictures/collections', { credentials: 'same-origin' })
            if (res.ok) setCollections(await res.json())
        } catch { /* ignore */ }
    }, [])

    const refreshAlbums = useCallback(async () => {
        try {
            const res = await fetch('/api/pictures/albums', { credentials: 'same-origin' })
            if (res.ok) setAlbums((await res.json()).items as AlbumCard[])
        } catch { /* ignore */ }
    }, [])

    const loadHome = useCallback(async () => {
        setHomeLoading(true)
        try { await Promise.all([refreshCounts(), refreshAlbums()]) } finally { setHomeLoading(false) }
    }, [refreshCounts, refreshAlbums])

    const fetchPicturePage = async (cursor: string | null, filter: CollectionId) => {
        const params = new URLSearchParams({ limit: '60', filter })
        if (cursor) params.set('cursor', cursor)
        const res = await fetch(`/api/pictures?${params.toString()}`, { credentials: 'same-origin' })
        if (!res.ok) throw new Error()
        return (await res.json()) as { items: Picture[]; nextCursor: string | null }
    }

    const loadCollection = useCallback(async (id: CollectionId) => {
        setGridLoading(true); setGridError(null); setNextCursor(null)
        try {
            const data = await fetchPicturePage(null, id)
            setItems(data.items); setNextCursor(data.nextCursor)
        } catch {
            setGridError('Couldn’t load these photos. Please try again.')
        } finally { setGridLoading(false) }
    }, [])

    const loadAlbum = useCallback(async (id: string) => {
        setGridLoading(true); setGridError(null); setNextCursor(null)
        try {
            const res = await fetch(`/api/pictures/albums/${id}`, { credentials: 'same-origin' })
            if (!res.ok) throw new Error()
            const data = await res.json() as { album: AlbumCard; items: Picture[] }
            setView(v => (v.kind === 'album' ? { kind: 'album', album: data.album } : v))
            setItems(data.items)
        } catch {
            setGridError('Couldn’t load this album. Please try again.')
        } finally { setGridLoading(false) }
    }, [])

    const loadShares = useCallback(async () => {
        setSharesLoading(true)
        try {
            const res = await fetch('/api/pictures/shares', { credentials: 'same-origin' })
            setShares((await res.json()).items as Share[])
        } catch { /* ignore */ } finally { setSharesLoading(false) }
    }, [])

    useEffect(() => { void loadCollection('all'); void refreshCounts() }, [loadCollection, refreshCounts])

    const toTop = () => window.scrollTo({ top: 0 })
    const openLibrary = () => { exitSelect(); setView({ kind: 'library' }); toTop(); void loadCollection('all'); void refreshCounts() }
    const openCollections = () => { exitSelect(); setItems([]); setNextCursor(null); setView({ kind: 'collections' }); toTop(); void loadHome() }
    const openCollection = (id: CollectionId) => { exitSelect(); setView({ kind: 'collection', id }); toTop(); void loadCollection(id) }
    const openAlbum = (album: AlbumCard) => { exitSelect(); setView({ kind: 'album', album }); toTop(); void loadAlbum(album.id) }
    const openShared = () => { exitSelect(); setView({ kind: 'shared' }); toTop(); void loadShares() }

    const refreshCurrentGrid = async () => {
        if (view.kind === 'library') await loadCollection('all')
        else if (view.kind === 'collection') await loadCollection(view.id)
        else if (view.kind === 'album') { await loadAlbum(view.album.id); void refreshAlbums() }
        void refreshCounts()
    }

    const currentFilter = (): CollectionId | null => {
        if (view.kind === 'library') return 'all'
        if (view.kind === 'collection') return view.id
        return null
    }

    async function loadMore() {
        const filter = currentFilter()
        if (!filter || !nextCursor || loadingMore) return
        setLoadingMore(true)
        try {
            const data = await fetchPicturePage(nextCursor, filter)
            setItems(prev => [...prev, ...data.items]); setNextCursor(data.nextCursor)
        } catch { /* ignore */ } finally { setLoadingMore(false) }
    }

    const isLibrary = view.kind === 'library'
    const isTrash = view.kind === 'collection' && view.id === 'trash'
    const showsPhotoGrid = view.kind === 'library' || view.kind === 'collection' || view.kind === 'album'
    const canUploadHere = view.kind === 'library' || view.kind === 'collections'
    const isSubView = view.kind === 'collection' || view.kind === 'album' || view.kind === 'shared'
    const showSegmented = view.kind === 'library' || view.kind === 'collections'
    const activeTab: 'library' | 'collections' = view.kind === 'library' ? 'library' : 'collections'
    const overlayOpen = pickerOpen || !!nameDialog || !!confirmDialog || !!lightboxId

    const viewKey = view.kind === 'collection' ? `c-${view.id}` : view.kind === 'album' ? `a-${view.album.id}` : view.kind

    const headerTitle =
        view.kind === 'library' ? 'Library'
            : view.kind === 'collections' ? 'Collections'
                : view.kind === 'collection' ? COLLECTION_LABEL[view.id]
                    : view.kind === 'shared' ? 'Shared'
                        : view.album.name

    const headerSubtitle = (() => {
        if (selectMode) return `${selected.size.toLocaleString('en-US')} selected`
        if (view.kind === 'library') return plural(collections?.all.count ?? items.length)
        if (view.kind === 'collections') return 'Your albums, favorites, and shared links.'
        if (view.kind === 'shared') return 'Links you’ve created — you stay in control.'
        if (view.kind === 'album') return plural(view.album.count)
        const total = collections?.[view.id]?.count
        return plural(total ?? items.length)
    })()

    const grouped = useMemo(() => {
        if (!isLibrary) return null
        const out: { label: string; items: Picture[] }[] = []
        for (const p of items) {
            const label = dateLabel(p.createdAt)
            const last = out[out.length - 1]
            if (last && last.label === label) last.items.push(p)
            else out.push({ label, items: [p] })
        }
        return out
    }, [items, isLibrary])

    const lightboxIndex = useMemo(
        () => (lightboxId ? items.findIndex(p => p.id === lightboxId) : -1),
        [lightboxId, items],
    )
    const lightboxItem = lightboxIndex >= 0 ? items[lightboxIndex] : null

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (lightboxId) { closeLightbox(); return }
                if (confirmDialog) { setConfirmDialog(null); return }
                if (nameDialog) { setNameDialog(null); return }
                if (pickerOpen) { setPickerOpen(false); return }
                if (actionMenuOpen) { setActionMenuOpen(false); return }
                if (selectMode) exitSelect()
                return
            }
            if (lightboxId) {
                if (e.key === 'ArrowRight' && lightboxIndex < items.length - 1) setLightboxId(items[lightboxIndex + 1].id)
                if (e.key === 'ArrowLeft' && lightboxIndex > 0) setLightboxId(items[lightboxIndex - 1].id)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [lightboxId, lightboxIndex, items, confirmDialog, nameDialog, pickerOpen, actionMenuOpen, selectMode])

    useEffect(() => {
        document.body.style.overflow = overlayOpen ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [overlayOpen])

    async function uploadFiles(list: FileList | File[]) {
        const files = Array.from(list).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'))
        if (files.length === 0) { flash('Only images and videos can be imported.'); return }
        setUploading(true)
        try {
            const fd = new FormData()
            files.forEach(f => fd.append('files', f))
            const res = await fetch('/api/pictures', { method: 'POST', body: fd, credentials: 'same-origin' })
            if (!res.ok) { flash(res.status === 415 ? 'Only images and videos can be imported.' : 'Import failed. Please try again.'); return }
            flash(`${files.length.toLocaleString('en-US')} item${files.length === 1 ? '' : 's'} imported.`)
            void refreshCounts()
            if (view.kind === 'library') await loadCollection('all')
            else openLibrary()
        } catch { flash('Import failed. Please try again.') } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const canDrop = canUploadHere && !selectMode && !overlayOpen
    const onDragEnter = (e: React.DragEvent) => { if (!canDrop || !hasFiles(e)) return; dragDepth.current += 1; setDragOver(true) }
    const onDragOver = (e: React.DragEvent) => { if (!canDrop || !hasFiles(e)) return; e.preventDefault() }
    const onDragLeave = (e: React.DragEvent) => { if (!canDrop || !hasFiles(e)) return; dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setDragOver(false) }
    const onDrop = (e: React.DragEvent) => {
        if (!canDrop) return
        e.preventDefault()
        dragDepth.current = 0; setDragOver(false)
        if (e.dataTransfer?.files?.length) void uploadFiles(e.dataTransfer.files)
    }

    function toggleSelect(id: string) {
        setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
    }
    const allSelected = items.length > 0 && selected.size === items.length
    const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(items.map(p => p.id)))

    const patchEach = (ids: string[], body: Record<string, unknown>) =>
        Promise.all(ids.map(id => fetch(`/api/pictures/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' })))

    async function run(fn: () => Promise<unknown>) {
        if (!selected.size || busy) return
        setBusy(true)
        try { await fn(); exitSelect(); await refreshCurrentGrid() }
        catch { /* ignore */ } finally { setBusy(false) }
    }

    const bulkFavorite = (v: boolean) => run(() => patchEach(Array.from(selected), { favorite: v }))
    const bulkArchive = (v: boolean) => run(() => patchEach(Array.from(selected), { archived: v }))
    const doBulkTrash = () => run(() => Promise.all(Array.from(selected).map(id => fetch(`/api/pictures/${id}`, { method: 'DELETE', credentials: 'same-origin' }))))
    const doBulkDestroy = () => run(() => Promise.all(Array.from(selected).map(id => fetch(`/api/pictures/${id}/permanent`, { method: 'DELETE', credentials: 'same-origin' }))))
    const bulkRestore = () => run(() => Promise.all(Array.from(selected).map(id => fetch(`/api/pictures/${id}/restore`, { method: 'POST', credentials: 'same-origin' }))))
    const bulkRemoveFromAlbum = () => {
        if (view.kind !== 'album') return
        const albumId = view.album.id
        return run(() => Promise.all(Array.from(selected).map(id => fetch(`/api/pictures/albums/${albumId}/pictures/${id}`, { method: 'DELETE', credentials: 'same-origin' }))))
    }

    const bulkTrash = () => setConfirmDialog({
        title: 'Delete these photos?',
        message: `${plural(selected.size)} will be moved to Recently Deleted.`,
        confirmLabel: 'Delete',
        action: () => void doBulkTrash(),
    })
    const bulkDestroy = () => setConfirmDialog({
        title: 'Delete permanently?',
        message: `${plural(selected.size)} will be permanently deleted. This can’t be undone.`,
        confirmLabel: 'Delete Permanently',
        action: () => void doBulkDestroy(),
    })

    async function copyShare(share: Share) {
        try {
            const res = await fetch(`/api/pictures/shared/${share.token}`, { credentials: 'omit' })
            if (!res.ok) throw new Error()
            const data = (await res.json()) as { items: { url: string }[] }
            const url = data.items?.[0]?.url
            if (!url) throw new Error()
            await navigator.clipboard.writeText(url)
            flash('Direct link copied.')
        } catch {
            flash('Couldn’t copy link.')
        }
    }

    async function shareSelection() {
        if (!selected.size || busy) return
        setBusy(true)
        try {
            const res = await fetch('/api/pictures/shares', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
                body: JSON.stringify({ pictureIds: Array.from(selected) }),
            })
            if (!res.ok) { flash('Couldn’t create share link.'); return }
            await copyShare((await res.json()).share as Share)
            void refreshCounts()
            openShared()
        } catch { flash('Couldn’t create share link.') } finally { setBusy(false) }
    }

    async function shareAlbum(album: AlbumCard) {
        if (busy) return
        setBusy(true)
        try {
            const res = await fetch('/api/pictures/shares', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
                body: JSON.stringify({ albumId: album.id }),
            })
            if (!res.ok) { flash('Couldn’t create share link.'); return }
            await copyShare((await res.json()).share as Share)
            void refreshCounts()
            openShared()
        } catch { flash('Couldn’t create share link.') } finally { setBusy(false) }
    }

    const revokeShare = (share: Share) => setConfirmDialog({
        title: 'Revoke this link?',
        message: `“${share.title}” will stop working for anyone who has it.`,
        confirmLabel: 'Revoke',
        action: () => void (async () => {
            setBusy(true)
            try { await fetch(`/api/pictures/shares/${share.id}`, { method: 'DELETE', credentials: 'same-origin' }); await loadShares(); void refreshCounts() }
            catch { /* ignore */ } finally { setBusy(false) }
        })(),
    })

    const openCreateAlbum = (after?: 'addSelection') => { setNameValue(''); setNameDialog({ mode: 'create', after }) }
    const openRenameAlbum = (album: AlbumCard) => { setNameValue(album.name); setNameDialog({ mode: 'rename', albumId: album.id }) }

    async function submitNameDialog() {
        const dialog = nameDialog
        const name = nameValue.trim()
        if (!dialog || !name || busy) return
        setBusy(true)
        try {
            if (dialog.mode === 'create') {
                const res = await fetch('/api/pictures/albums', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
                    body: JSON.stringify({ name }),
                })
                if (!res.ok) { flash('Couldn’t create album.'); return }
                const album = (await res.json()).album as AlbumCard
                setNameDialog(null)
                await refreshAlbums()
                if (dialog.after === 'addSelection') await addSelectionToAlbum(album.id)
                else flash('Album created.')
            } else if (dialog.albumId) {
                const res = await fetch(`/api/pictures/albums/${dialog.albumId}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
                    body: JSON.stringify({ name }),
                })
                if (!res.ok) { flash('Couldn’t rename album.'); return }
                setNameDialog(null)
                setView(v => (v.kind === 'album' ? { kind: 'album', album: { ...v.album, name } } : v))
                void refreshAlbums()
                flash('Album renamed.')
            }
        } catch { flash('Something went wrong. Please try again.') } finally { setBusy(false) }
    }

    async function addSelectionToAlbum(albumId: string) {
        if (!selected.size) return
        setBusy(true)
        try {
            const res = await fetch(`/api/pictures/albums/${albumId}/pictures`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
                body: JSON.stringify({ pictureIds: Array.from(selected) }),
            })
            if (!res.ok) { flash('Couldn’t add to album.'); return }
            setPickerOpen(false); exitSelect(); flash('Added to album.')
            void refreshAlbums()
        } catch { flash('Couldn’t add to album.') } finally { setBusy(false) }
    }

    const deleteAlbum = (album: AlbumCard) => setConfirmDialog({
        title: 'Delete this album?',
        message: `“${album.name}” will be deleted. The photos themselves are kept.`,
        confirmLabel: 'Delete Album',
        action: () => void (async () => {
            setBusy(true)
            try { await fetch(`/api/pictures/albums/${album.id}`, { method: 'DELETE', credentials: 'same-origin' }); flash('Album deleted.'); openCollections() }
            catch { /* ignore */ } finally { setBusy(false) }
        })(),
    })

    function openLightbox(id: string) { lightboxDirty.current = false; setLightboxId(id) }
    function closeLightbox() {
        setLightboxId(null)
        if (lightboxDirty.current) { lightboxDirty.current = false; void refreshCurrentGrid() }
    }
    async function lightboxToggleFavorite(p: Picture) {
        const next = !p.favorite
        setItems(arr => arr.map(x => (x.id === p.id ? { ...x, favorite: next } : x)))
        lightboxDirty.current = true
        try {
            const res = await fetch(`/api/pictures/${p.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
                body: JSON.stringify({ favorite: next }),
            })
            if (!res.ok) throw new Error()
        } catch {
            setItems(arr => arr.map(x => (x.id === p.id ? { ...x, favorite: !next } : x)))
            flash('Couldn’t update photo.')
        }
    }
    async function lightboxTrash(p: Picture) {
        const idx = items.findIndex(x => x.id === p.id)
        const next = items[idx + 1] ?? items[idx - 1] ?? null
        setItems(arr => arr.filter(x => x.id !== p.id))
        lightboxDirty.current = true
        try {
            const res = await fetch(`/api/pictures/${p.id}`, { method: 'DELETE', credentials: 'same-origin' })
            if (!res.ok) throw new Error()
            if (next) setLightboxId(next.id)
            else closeLightbox()
        } catch {
            flash('Couldn’t delete photo.')
            void refreshCurrentGrid()
        }
    }

    const selection = (() => {
        const fav: SelectionAction = { key: 'fav', label: 'Favorite', icon: TbHeart, onClick: () => void bulkFavorite(true) }
        const unfav: SelectionAction = { key: 'unfav', label: 'Unfavorite', icon: TbHeartOff, onClick: () => void bulkFavorite(false) }
        const album: SelectionAction = { key: 'album', label: 'Add', icon: TbAlbum, onClick: () => { if (!albums.length) void refreshAlbums(); setActionMenuOpen(false); setPickerOpen(true) } }
        const share: SelectionAction = { key: 'share', label: 'Share', icon: TbShare3, onClick: () => void shareSelection() }
        const archive: SelectionAction = { key: 'archive', label: 'Archive', icon: TbArchive, onClick: () => void bulkArchive(true) }
        const unarchive: SelectionAction = { key: 'unarchive', label: 'Unarchive', icon: TbArchiveOff, onClick: () => void bulkArchive(false) }
        const removeFromAlbum: SelectionAction = { key: 'remove', label: 'Remove from Album', icon: TbX, onClick: () => void bulkRemoveFromAlbum() }
        const trash: SelectionAction = { key: 'trash', label: 'Delete', icon: TbTrash, danger: true, onClick: bulkTrash }
        const restore: SelectionAction = { key: 'restore', label: 'Recover', icon: TbArrowBackUp, onClick: () => void bulkRestore() }
        const destroy: SelectionAction = { key: 'destroy', label: 'Delete', icon: TbTrash, danger: true, onClick: bulkDestroy }

        const empty: SelectionAction[] = []
        if (isTrash) return { primary: [restore, destroy], secondary: empty }
        if (view.kind === 'collection' && view.id === 'archive') return { primary: [unarchive, trash], secondary: empty }
        if (view.kind === 'collection' && view.id === 'favorites') return { primary: [unfav, album, share, trash], secondary: empty }
        if (view.kind === 'album') return { primary: [fav, album, share, trash], secondary: [removeFromAlbum] }
        return { primary: [fav, album, share, trash], secondary: [archive] }
    })()

    function emptyCopy(): { title: string; hint: string; icon: IconType } {
        if (view.kind === 'album') return { title: 'This album is empty', hint: 'Open All Photos, select some pictures, then choose Add to Album.', icon: TbAlbum }
        if (view.kind === 'collection') {
            if (view.id === 'favorites') return { title: 'No favorites yet', hint: 'Select photos and tap Favorite to keep them close at hand.', icon: TbHeart }
            if (view.id === 'archive') return { title: 'Nothing in the archive', hint: 'Archived photos are hidden from your Library but kept safe.', icon: TbArchive }
            if (view.id === 'trash') return { title: 'Recently Deleted is empty', hint: 'Deleted photos wait here before they’re removed for good.', icon: TbTrash }
        }
        return { title: 'No photos yet', hint: 'Import your first photos — or just drag them anywhere on this page.', icon: TbPhoto }
    }

    const tile = (p: Picture) => {
        const isSelected = selected.has(p.id)
        return (
            <div
                key={p.id}
                role="button"
                tabIndex={0}
                aria-label={selectMode ? `${isSelected ? 'Deselect' : 'Select'} ${p.filename}` : `Open ${p.filename}`}
                onClick={() => (selectMode ? toggleSelect(p.id) : openLightbox(p.id))}
                onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        if (selectMode) toggleSelect(p.id)
                        else openLightbox(p.id)
                    }
                }}
                className={`group relative aspect-square cursor-pointer select-none overflow-hidden rounded-md bg-stone-100 transition-[transform,box-shadow] duration-150 ${FOCUS} ${isSelected ? 'scale-95 ring-2 ring-stone-900 ring-offset-1' : ''}`}
            >
                {p.kind === 'image' ? (
                    <img src={p.url} alt={p.filename} loading="lazy" draggable={false} className="absolute inset-0 size-full object-cover" />
                ) : (
                    <video src={p.url} muted playsInline preload="metadata" className="absolute inset-0 size-full object-cover" />
                )}
                <div className={`pointer-events-none absolute inset-0 transition-colors ${isSelected ? 'bg-stone-950/10' : 'bg-stone-950/0 group-hover:bg-stone-950/15'}`} />
                <button
                    type="button"
                    aria-label={isSelected ? 'Deselect' : 'Select'}
                    onClick={e => { e.stopPropagation(); if (!selectMode) setSelectMode(true); toggleSelect(p.id) }}
                    className={`absolute left-2 top-2 flex size-6 cursor-pointer items-center justify-center rounded-full border-2 shadow-sm transition-opacity ${FOCUS} ${isSelected
                        ? 'border-white bg-stone-900 text-white opacity-100'
                        : selectMode
                            ? 'border-white/90 bg-stone-950/25 text-transparent opacity-100'
                            : 'border-white/90 bg-stone-950/15 text-transparent opacity-0 group-hover:opacity-100'
                        }`}
                >
                    <TbCheck className="size-3.5" strokeWidth={3} />
                </button>

                {p.kind === 'video' && (
                    <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-stone-950/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        <TbPlayerPlayFilled className="size-2.5" />
                        {p.durationSeconds != null ? formatDuration(p.durationSeconds) : 'Video'}
                    </span>
                )}
                {p.favorite && <TbHeartFilled className="pointer-events-none absolute bottom-2 left-2 size-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" />}
            </div>
        )
    }

    const loadMoreButton = nextCursor && (
        <div className="flex justify-center pt-4">
            <button className={BTN_SECONDARY} onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore && SPINNER}{loadingMore ? 'Loading…' : 'Show More'}
            </button>
        </div>
    )

    const photoGrid = (
        gridError ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200/70 bg-white px-6 py-16 text-center shadow-sm">
                <p className="text-sm text-stone-500">{gridError}</p>
                <button onClick={() => void refreshCurrentGrid()} className={`${BTN_SECONDARY} mt-4`}>Try Again</button>
            </div>
        ) : gridLoading ? (
            <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6" aria-hidden>
                {Array.from({ length: 18 }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-md bg-stone-100" />)}
            </div>
        ) : items.length === 0 ? (
            (() => {
                const e = emptyCopy()
                return (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white/40 px-6 py-16 text-center">
                        <span className="flex size-12 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-400 shadow-sm"><e.icon className="size-6" strokeWidth={1.5} /></span>
                        <h3 className="mt-4 text-sm font-semibold text-stone-900">{e.title}</h3>
                        <p className="mt-1 max-w-sm text-sm text-stone-500">{e.hint}</p>
                        {isLibrary && (
                            <button className={`${BTN_PRIMARY} mt-5`} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                                {uploading ? SPINNER : <TbUpload className="size-4" />} Import
                            </button>
                        )}
                    </div>
                )
            })()
        ) : grouped ? (
            <div className="space-y-8">
                {grouped.map(g => (
                    <section key={g.label}>
                        <h2 className="mb-3 text-sm font-semibold tracking-tight text-stone-900">{g.label}</h2>
                        <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">{g.items.map(tile)}</div>
                    </section>
                ))}
                {loadMoreButton}
            </div>
        ) : (
            <>
                <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">{items.map(tile)}</div>
                {loadMoreButton}
            </>
        )
    )

    const albumCard = (opts: { key: string; name: string; sublabel: string; coverUrl: string | null; onClick: () => void; fallback: IconType }) => (
        <button key={opts.key} onClick={opts.onClick} className={`group block cursor-pointer rounded-xl text-left ${FOCUS}`}>
            <div className="relative aspect-square overflow-hidden rounded-xl border border-stone-200/70 bg-stone-100 shadow-sm transition-shadow group-hover:shadow-md">
                {opts.coverUrl ? (
                    <img src={opts.coverUrl} alt="" loading="lazy" draggable={false} className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-stone-300"><opts.fallback className="size-8" strokeWidth={1.5} /></span>
                )}
                <div className="pointer-events-none absolute inset-0 bg-stone-950/0 transition-colors group-hover:bg-stone-950/5" />
            </div>
            <div className="mt-2.5 px-0.5">
                <p className="truncate text-sm font-medium text-stone-900">{opts.name}</p>
                <p className="mt-0.5 text-xs text-stone-400">{opts.sublabel}</p>
            </div>
        </button>
    )

    const collectionRow = (opts: { key: string; label: string; sublabel: string; icon: IconType; onClick: () => void }) => (
        <button key={opts.key} onClick={opts.onClick} className={`flex w-full cursor-pointer items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-stone-50 ${FOCUS}`}>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-stone-600">
                <opts.icon className="size-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-stone-900">{opts.label}</span>
                <span className="block text-xs text-stone-400">{opts.sublabel}</span>
            </span>
            <TbChevronRight className="size-5 shrink-0 text-stone-300" />
        </button>
    )

    return (
        <div
            className={`relative space-y-6 ${selectMode && showsPhotoGrid ? 'pb-32' : 'pb-10'}`}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <style>{`
                @keyframes dpFadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes dpFade { from { opacity: 0; } to { opacity: 1; } }
                @keyframes dpScaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
            `}</style>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => { if (e.target.files?.length) void uploadFiles(e.target.files) }} />
            {showSegmented && (
                <div className="flex justify-center sm:justify-start">
                    <div className={SEG_WRAP} role="tablist" aria-label="Sections">
                        <button role="tab" aria-selected={activeTab === 'library'} className={segBtn(activeTab === 'library')} onClick={() => { if (view.kind !== 'library') openLibrary() }}>
                            <TbPhoto className="size-4.5" /> Library
                        </button>
                        <button role="tab" aria-selected={activeTab === 'collections'} className={segBtn(activeTab === 'collections')} onClick={() => { if (view.kind !== 'collections') openCollections() }}>
                            <TbAlbum className="size-4.5" /> Collections
                        </button>
                    </div>
                </div>
            )}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    {isSubView && (
                        <button onClick={openCollections} className={`${BTN_SECONDARY} shrink-0 pl-2.5 pr-3.5`} aria-label="Back to Collections">
                            <TbChevronLeft className="size-4.5" />
                            <span className="hidden sm:inline">Collections</span>
                        </button>
                    )}
                    <div className="min-w-0">
                        <h1 className="truncate text-2xl font-semibold tracking-tight text-stone-900">{headerTitle}</h1>
                        <p className="mt-1 truncate text-sm text-stone-500">{headerSubtitle}</p>
                    </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {selectMode ? (
                        <>
                            <button className={BTN_SECONDARY} onClick={toggleSelectAll} disabled={busy || items.length === 0}>
                                {allSelected ? 'Deselect All' : 'Select All'}
                            </button>
                            <button className={BTN_SECONDARY} onClick={exitSelect} disabled={busy}>
                                <TbX className="size-4" /> Cancel
                            </button>
                        </>
                    ) : (
                        <>
                            {showsPhotoGrid && items.length > 0 && (
                                <button className={BTN_SECONDARY} onClick={() => setSelectMode(true)}>Select</button>
                            )}
                            {view.kind === 'collections' && (
                                <button className={BTN_SECONDARY} onClick={() => openCreateAlbum()}>
                                    <TbPlus className="size-4" /> New Album
                                </button>
                            )}
                            {canUploadHere && (
                                <button className={BTN_PRIMARY} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                                    {uploading ? SPINNER : <TbUpload className="size-4" />}{uploading ? 'Importing…' : 'Import'}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
            {view.kind === 'album' && !selectMode && (
                <div className="flex flex-wrap items-center gap-2 animate-[dpFadeUp_0.25s_ease]">
                    <button className={BTN_SECONDARY_SM} onClick={() => void shareAlbum(view.album)} disabled={busy}><TbShare2 className="size-4" /> Share Album</button>
                    <button className={BTN_SECONDARY_SM} onClick={() => openRenameAlbum(view.album)} disabled={busy}>Rename</button>
                    <button className={BTN_GHOST_DANGER_SM} onClick={() => deleteAlbum(view.album)} disabled={busy}>Delete Album</button>
                </div>
            )}
            <div key={viewKey} className="animate-[dpFadeUp_0.3s_ease]">
                {view.kind === 'collections' && (
                    homeLoading ? (
                        <div className="space-y-10" aria-hidden>
                            <div className="h-64 animate-pulse rounded-2xl bg-stone-100" />
                            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-xl bg-stone-100" />)}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-10">
                            <section className="space-y-4">
                                <h2 className="text-lg font-semibold tracking-tight text-stone-900">My Collections</h2>
                                <div className="divide-y divide-stone-200/70 overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm">
                                    {collectionRow({ key: 'favorites', label: 'Favorites', sublabel: plural(collections?.favorites.count ?? 0), icon: TbHeart, onClick: () => openCollection('favorites') })}
                                    {collectionRow({ key: 'archive', label: 'Archive', sublabel: plural(collections?.archive.count ?? 0), icon: TbArchive, onClick: () => openCollection('archive') })}
                                    {collectionRow({ key: 'shared', label: 'Shared', sublabel: `${(collections?.shared.count ?? 0).toLocaleString('en-US')} link${(collections?.shared.count ?? 0) === 1 ? '' : 's'}`, icon: TbShare2, onClick: openShared })}
                                    {collectionRow({ key: 'trash', label: 'Recently Deleted', sublabel: plural(collections?.trash.count ?? 0), icon: TbTrash, onClick: () => openCollection('trash') })}
                                </div>
                            </section>
                            <section className="space-y-4">
                                <h2 className="text-lg font-semibold tracking-tight text-stone-900">My Albums</h2>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                                    {albums.map(a => albumCard({ key: a.id, name: a.name, sublabel: plural(a.count), coverUrl: a.coverUrl, onClick: () => openAlbum(a), fallback: TbAlbum }))}
                                    <button
                                        onClick={() => openCreateAlbum()}
                                        className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 bg-white/40 text-stone-400 transition-colors hover:border-stone-400 hover:bg-white hover:text-stone-600 ${FOCUS}`}
                                    >
                                        <TbPlus className="size-7" strokeWidth={1.5} />
                                        <span className="text-xs font-medium">New Album</span>
                                    </button>
                                </div>
                            </section>
                        </div>
                    )
                )}
                {showsPhotoGrid && photoGrid}
                {view.kind === 'shared' && (
                    sharesLoading ? (
                        <div className="h-40 animate-pulse rounded-2xl bg-stone-100" aria-hidden />
                    ) : shares.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white/40 px-6 py-16 text-center">
                            <span className="flex size-12 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-400 shadow-sm"><TbShare2 className="size-6" strokeWidth={1.5} /></span>
                            <h3 className="mt-4 text-sm font-semibold text-stone-900">Nothing shared</h3>
                            <p className="mt-1 max-w-sm text-sm text-stone-500">Open your Library or an album, select what you want, then tap Share to create a link.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-stone-200/70 rounded-2xl border border-stone-200/70 bg-white shadow-sm">
                            {shares.map(share => {
                                const e = expiryBadge(share.expiresAt)
                                return (
                                    <div key={share.id} className="flex items-center gap-4 p-4">
                                        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-500">
                                            {share.kind === 'album' ? <TbAlbum className="size-5" strokeWidth={1.5} /> : <TbPhoto className="size-5" strokeWidth={1.5} />}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-stone-900">{share.title}</p>
                                            <p className="mt-0.5 truncate text-xs text-stone-400">
                                                {share.kind === 'album' ? 'Album' : 'Selection'} · {plural(share.items)} · Shared {shortDate(share.createdAt)} · {share.views} view{share.views === 1 ? '' : 's'}
                                            </p>
                                        </div>
                                        <div className="hidden shrink-0 sm:block"><span className={`${BADGE_BASE} ${e.tone}`}>{e.label}</span></div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            <button className={BTN_SECONDARY_SM} onClick={() => void copyShare(share)}><TbLink className="size-4" /><span className="hidden md:inline">Copy Link</span></button>
                                            <button className={BTN_GHOST_DANGER_SM} onClick={() => revokeShare(share)} disabled={busy}>Revoke</button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )
                )}
            </div>
            {selectMode && showsPhotoGrid && (
                <>
                    {actionMenuOpen && <div aria-hidden className="fixed inset-0 z-40" onClick={() => setActionMenuOpen(false)} />}
                    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 animate-[dpFadeUp_0.25s_ease]">
                        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-3xl border border-stone-200/70 bg-white/95 px-2 py-2 shadow-xl shadow-stone-900/10 backdrop-blur">
                            {selection.primary.map(a => (
                                <button key={a.key} className={a.danger ? COL_BTN_DANGER : COL_BTN} disabled={!selected.size || busy} onClick={() => { setActionMenuOpen(false); a.onClick() }}>
                                    <a.icon className="size-6" strokeWidth={1.75} />
                                    <span className="leading-none">{a.label}</span>
                                </button>
                            ))}
                            {selection.secondary.length > 0 && (
                                <button className={COL_BTN} aria-expanded={actionMenuOpen} aria-label="More actions" disabled={!selected.size || busy} onClick={() => setActionMenuOpen(o => !o)}>
                                    <TbDots className="size-6" strokeWidth={1.75} />
                                    <span className="leading-none">More</span>
                                </button>
                            )}
                        </div>
                    </div>
                    {actionMenuOpen && selection.secondary.length > 0 && (
                        <div className="fixed inset-x-0 bottom-22 z-50 flex justify-center px-4 animate-[dpFadeUp_0.18s_ease]">
                            <div className="w-full max-w-[16rem] rounded-2xl border border-stone-200/70 bg-white p-1.5 shadow-xl shadow-stone-900/10">
                                {selection.secondary.map(a => (
                                    <button key={a.key} className={a.danger ? MENU_ROW_DANGER : MENU_ROW} disabled={!selected.size || busy} onClick={() => { setActionMenuOpen(false); a.onClick() }}>
                                        <a.icon className="size-5 shrink-0" strokeWidth={1.75} />
                                        <span>{a.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
            {notice && (
                <div className={`pointer-events-none fixed inset-x-0 z-80 flex justify-center px-4 ${selectMode && showsPhotoGrid ? 'bottom-24' : 'bottom-6'}`}>
                    <button
                        onClick={() => setNotice(null)}
                        className="pointer-events-auto cursor-pointer rounded-full bg-stone-900/95 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur animate-[dpFadeUp_0.25s_ease]"
                    >
                        {notice}
                    </button>
                </div>
            )}
            {dragOver && (
                <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-stone-50/80 backdrop-blur-sm animate-[dpFade_0.15s_ease]">
                    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-stone-400 bg-white px-12 py-10 shadow-xl">
                        <TbUpload className="size-8 text-stone-500" strokeWidth={1.5} />
                        <p className="text-sm font-semibold text-stone-900">Drop to import</p>
                        <p className="text-xs text-stone-500">Images and videos</p>
                    </div>
                </div>
            )}
            {pickerOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/25 p-4 backdrop-blur-sm sm:items-center animate-[dpFade_0.15s_ease]">
                    <div aria-hidden className="absolute inset-0 cursor-pointer" onClick={() => setPickerOpen(false)} />
                    <div role="dialog" aria-modal="true" aria-label="Add to Album" className="relative flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-stone-200/70 bg-white p-6 shadow-xl shadow-stone-900/10 animate-[dpScaleIn_0.18s_ease]">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-base font-semibold tracking-tight text-stone-900">Add to Album</h2>
                                <p className="mt-1 text-sm text-stone-500">{selected.size.toLocaleString('en-US')} selected.</p>
                            </div>
                            <button type="button" onClick={() => setPickerOpen(false)} aria-label="Close" className={ICON_BTN}><TbX className="size-4.5" /></button>
                        </div>
                        <button className={`${BTN_SECONDARY} mt-5 w-full`} disabled={busy} onClick={() => openCreateAlbum('addSelection')}>
                            <TbPlus className="size-4" /> New Album…
                        </button>
                        <div className="mt-3 -mx-1 flex-1 space-y-1 overflow-y-auto px-1">
                            {albums.length === 0 ? (
                                <p className="py-6 text-center text-sm text-stone-400">No albums yet.</p>
                            ) : albums.map(a => (
                                <button key={a.id} disabled={busy} onClick={() => void addSelectionToAlbum(a.id)} className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-stone-50 disabled:opacity-50 ${FOCUS}`}>
                                    <span className="size-10 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
                                        {a.coverUrl && <img src={a.coverUrl} alt="" loading="lazy" className="size-full object-cover" />}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-stone-900">{a.name}</span>
                                        <span className="block text-xs text-stone-400">{plural(a.count)}</span>
                                    </span>
                                    <TbChevronRight className="size-4 shrink-0 text-stone-300" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {nameDialog && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-stone-900/25 p-4 backdrop-blur-sm animate-[dpFade_0.15s_ease]">
                    <div aria-hidden className="absolute inset-0 cursor-pointer" onClick={() => setNameDialog(null)} />
                    <div role="dialog" aria-modal="true" aria-label={nameDialog.mode === 'create' ? 'New Album' : 'Rename Album'} className="relative w-full max-w-sm rounded-2xl border border-stone-200/70 bg-white p-6 shadow-xl shadow-stone-900/10 animate-[dpScaleIn_0.18s_ease]">
                        <h2 className="text-base font-semibold tracking-tight text-stone-900">{nameDialog.mode === 'create' ? 'New Album' : 'Rename Album'}</h2>
                        <p className="mt-1 text-sm text-stone-500">{nameDialog.mode === 'create' ? 'Give your album a name.' : 'Choose a new name for this album.'}</p>
                        <form
                            onSubmit={e => { e.preventDefault(); void submitNameDialog() }}
                            className="mt-4 space-y-4"
                        >
                            <input
                                autoFocus
                                value={nameValue}
                                onChange={e => setNameValue(e.target.value)}
                                maxLength={80}
                                placeholder="e.g. Summer 2026"
                                className="h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-200"
                            />
                            <div className="flex justify-end gap-2">
                                <button type="button" className={BTN_SECONDARY} onClick={() => setNameDialog(null)} disabled={busy}>Cancel</button>
                                <button type="submit" className={BTN_PRIMARY} disabled={busy || !nameValue.trim()}>
                                    {busy ? SPINNER : null}
                                    {nameDialog.mode === 'create' ? 'Create' : 'Rename'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {confirmDialog && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-stone-900/25 p-4 backdrop-blur-sm animate-[dpFade_0.15s_ease]">
                    <div aria-hidden className="absolute inset-0 cursor-pointer" onClick={() => setConfirmDialog(null)} />
                    <div role="alertdialog" aria-modal="true" aria-label={confirmDialog.title} className="relative w-full max-w-sm rounded-2xl border border-stone-200/70 bg-white p-6 shadow-xl shadow-stone-900/10 animate-[dpScaleIn_0.18s_ease]">
                        <h2 className="text-base font-semibold tracking-tight text-stone-900">{confirmDialog.title}</h2>
                        <p className="mt-1 text-sm text-stone-500">{confirmDialog.message}</p>
                        <div className="mt-5 flex justify-end gap-2">
                            <button type="button" className={BTN_SECONDARY} onClick={() => setConfirmDialog(null)} disabled={busy}>Cancel</button>
                            <button
                                type="button"
                                className={`inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full bg-red-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 disabled:pointer-events-none disabled:opacity-60 ${FOCUS}`}
                                disabled={busy}
                                onClick={() => { const a = confirmDialog.action; setConfirmDialog(null); a() }}
                            >
                                {confirmDialog.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {lightboxItem && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={lightboxItem.filename}
                    className="fixed inset-0 z-70 flex flex-col bg-stone-950/95 animate-[dpFade_0.15s_ease]"
                    onClick={closeLightbox}
                >
                    <div className="flex items-center justify-between gap-4 p-4" onClick={e => e.stopPropagation()}>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">{lightboxItem.filename}</p>
                            <p className="mt-0.5 text-xs text-white/50">{dateLabel(lightboxItem.createdAt)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            {!isTrash && (
                                <button
                                    className={ICON_BTN_DARK}
                                    aria-label={lightboxItem.favorite ? 'Remove from Favorites' : 'Add to Favorites'}
                                    onClick={() => void lightboxToggleFavorite(lightboxItem)}
                                >
                                    {lightboxItem.favorite ? <TbHeartFilled className="size-5 text-red-400" /> : <TbHeart className="size-5" />}
                                </button>
                            )}
                            {!isTrash && (
                                <button
                                    className={ICON_BTN_DARK}
                                    aria-label="Delete"
                                    onClick={() => void lightboxTrash(lightboxItem)}
                                >
                                    <TbTrash className="size-5" />
                                </button>
                            )}
                            <button className={ICON_BTN_DARK} aria-label="Close" onClick={closeLightbox}><TbX className="size-5" /></button>
                        </div>
                    </div>
                    <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6 sm:px-16">
                        {lightboxItem.kind === 'image' ? (
                            <img
                                src={lightboxItem.url}
                                alt={lightboxItem.filename}
                                draggable={false}
                                onClick={e => e.stopPropagation()}
                                className="max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl animate-[dpScaleIn_0.18s_ease]"
                            />
                        ) : (
                            <video
                                src={lightboxItem.url}
                                controls
                                autoPlay
                                playsInline
                                onClick={e => e.stopPropagation()}
                                className="max-h-full max-w-full rounded-lg shadow-2xl animate-[dpScaleIn_0.18s_ease]"
                            />
                        )}
                        {lightboxIndex > 0 && (
                            <button
                                className={`${ICON_BTN_DARK} absolute left-3 top-1/2 -translate-y-1/2 sm:left-5`}
                                aria-label="Previous"
                                onClick={e => { e.stopPropagation(); setLightboxId(items[lightboxIndex - 1].id) }}
                            >
                                <TbChevronLeft className="size-5" />
                            </button>
                        )}
                        {lightboxIndex < items.length - 1 && (
                            <button
                                className={`${ICON_BTN_DARK} absolute right-3 top-1/2 -translate-y-1/2 sm:right-5`}
                                aria-label="Next"
                                onClick={e => { e.stopPropagation(); setLightboxId(items[lightboxIndex + 1].id) }}
                            >
                                <TbChevronRight className="size-5" />
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}