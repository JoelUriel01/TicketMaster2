'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';

/* ─── Types ─────────────────────────────────────────────── */
interface Event {
  id: string;
  title: string;
  description: string;
  venueName: string;
  venueCity: string;
  startsAt: string;
  endsAt: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

/* ─── Animation Variants ─────────────────────────────────── */
const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.15 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', damping: 26, stiffness: 220 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
  },
};

const headerVariants = {
  hidden: { opacity: 0, y: -16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', damping: 28, stiffness: 200, delay: 0.05 },
  },
};

const formVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', damping: 28, stiffness: 200 },
  },
  exit: {
    opacity: 0,
    y: -12,
    scale: 0.97,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
  },
};

/* ─── Helpers ────────────────────────────────────────────── */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ─── Sub-components ─────────────────────────────────────── */

function StatusBadge({ published }: { published: boolean }) {
  return (
    <motion.span
      layout
      className={`status-badge ${published ? 'published' : 'draft'}`}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
    >
      <span className="status-dot" />
      {published ? 'Publicado' : 'Borrador'}
    </motion.span>
  );
}

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skel-title" />
      <div className="skeleton skel-meta" />
      <div className="skeleton skel-body" />
      <div className="skeleton skel-body short" />
      <div className="skel-footer">
        <div className="skeleton skel-badge" />
        <div className="skeleton skel-btn" />
      </div>
    </div>
  );
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <motion.div
      className="empty-state"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 24, stiffness: 180 }}
    >
      <svg className="empty-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <rect x="6" y="10" width="36" height="32" rx="4" stroke="currentColor" strokeWidth="2" />
        <path d="M16 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" stroke="currentColor" strokeWidth="2" />
        <line x1="16" y1="22" x2="32" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="16" y1="30" x2="26" y2="30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <h3>Todavía no hay eventos</h3>
      <p>Crea tu primer evento y aparecerá aquí listo para publicar.</p>
      <button className="btn btn-primary" onClick={onCreateClick}>
        Crear evento
      </button>
    </motion.div>
  );
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    venueName: '',
    venueCity: '',
    startsAt: '',
    endsAt: '',
  });

  const supabase = createClient();
  const isOrganizer = profile?.role === 'ORGANIZER';

  /* ─── Fetch profile + events ─────────────── */
  async function loadData() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const token = session.access_token;
      const headers = { Authorization: `Bearer ${token}` };

      const [profileRes, eventsRes] = await Promise.all([
        fetch('http://localhost:3001/users/me', { headers }),
        fetch('http://localhost:3001/events/me', { headers }),
      ]);

      if (profileRes.ok) setProfile(await profileRes.json());
      if (eventsRes.ok) setEvents(await eventsRes.json());
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  /* ─── Create event ───────────────────────── */
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setActionLoading('create');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('http://localhost:3001/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          ...form,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Error al crear evento');
      }
      setForm({ title: '', description: '', venueName: '', venueCity: '', startsAt: '', endsAt: '' });
      setShowForm(false);
      setSuccessMsg('Evento creado correctamente.');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  }

  /* ─── Publish / Unpublish ────────────────── */
  async function togglePublish(event: Event) {
    setActionLoading(event.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const action = event.isPublished ? 'unpublish' : 'publish';
      const res = await fetch(`http://localhost:3001/events/${event.id}/${action}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error('Error al cambiar estado');
      const updated = await res.json();
      setEvents(prev => prev.map(ev => ev.id === event.id ? { ...ev, isPublished: updated.isPublished } : ev));
      setSuccessMsg(updated.isPublished ? 'Evento publicado.' : 'Evento despublicado.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  }

  /* ─── Stats ──────────────────────────────── */
  const totalEvents = events.length;
  const publishedCount = events.filter(e => e.isPublished).length;
  const draftCount = events.filter(e => !e.isPublished).length;

  /* ─── Render ─────────────────────────────── */
  return (
    <>
      <style>{CSS}</style>

      <div className="page-root">
        {/* Header */}
        <motion.header
          className="page-header"
          variants={headerVariants}
          initial="hidden"
          animate="show"
        >
          <div className="header-inner">
            <div className="header-left">
              <svg className="logo-mark" viewBox="0 0 32 32" fill="none" aria-label="Ticket logo">
                <rect x="2" y="8" width="28" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="9" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" />
                <line x1="14" y1="12" x2="26" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="14" y1="16" x2="22" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="14" y1="20" x2="24" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <div>
                <h1 className="page-title">Mis Eventos</h1>
                {profile && (
                  <p className="page-subtitle">{profile.fullName} · {profile.role}</p>
                )}
              </div>
            </div>

            {isOrganizer && (
              <motion.button
                className="btn btn-primary"
                onClick={() => setShowForm(v => !v)}
                whileHover={{ y: -1 }}
                whileTap={{ y: 0, scale: 0.97 }}
                transition={{ type: 'spring', damping: 20, stiffness: 400 }}
              >
                {showForm ? 'Cancelar' : '+ Nuevo evento'}
              </motion.button>
            )}
          </div>
        </motion.header>

        <main className="page-main">
          {/* Notificaciones */}
          <AnimatePresence>
            {error && (
              <motion.div
                className="alert alert-error"
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: 'spring', damping: 24, stiffness: 260 }}
              >
                {error}
                <button className="alert-close" onClick={() => setError('')}>✕</button>
              </motion.div>
            )}
            {successMsg && (
              <motion.div
                className="alert alert-success"
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: 'spring', damping: 24, stiffness: 260 }}
              >
                {successMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats */}
          {!loading && events.length > 0 && (
            <motion.div
              className="stats-row"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, type: 'spring', damping: 24, stiffness: 180 }}
            >
              <div className="stat-chip">
                <span className="stat-value">{totalEvents}</span>
                <span className="stat-label">Total</span>
              </div>
              <div className="stat-chip accent-green">
                <span className="stat-value">{publishedCount}</span>
                <span className="stat-label">Publicados</span>
              </div>
              <div className="stat-chip accent-amber">
                <span className="stat-value">{draftCount}</span>
                <span className="stat-label">Borradores</span>
              </div>
            </motion.div>
          )}

          {/* Formulario */}
          <AnimatePresence>
            {showForm && (
              <motion.section
                className="form-panel"
                variants={formVariants}
                initial="hidden"
                animate="show"
                exit="exit"
              >
                <h2 className="form-title">Nuevo evento</h2>
                <form className="create-form" onSubmit={handleCreate}>
                  <div className="form-row">
                    <div className="field full">
                      <label htmlFor="title">Título</label>
                      <input
                        id="title"
                        type="text"
                        value={form.title}
                        onChange={e => setForm({ ...form, title: e.target.value })}
                        required
                        placeholder="Nombre del evento"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="field full">
                      <label htmlFor="description">Descripción</label>
                      <textarea
                        id="description"
                        value={form.description}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        rows={3}
                        placeholder="Describe el evento"
                      />
                    </div>
                  </div>
                  <div className="form-row two-col">
                    <div className="field">
                      <label htmlFor="venueName">Recinto</label>
                      <input
                        id="venueName"
                        type="text"
                        value={form.venueName}
                        onChange={e => setForm({ ...form, venueName: e.target.value })}
                        required
                        placeholder="Auditorio Nacional"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="venueCity">Ciudad</label>
                      <input
                        id="venueCity"
                        type="text"
                        value={form.venueCity}
                        onChange={e => setForm({ ...form, venueCity: e.target.value })}
                        required
                        placeholder="Ciudad de México"
                      />
                    </div>
                  </div>
                  <div className="form-row two-col">
                    <div className="field">
                      <label htmlFor="startsAt">Inicio</label>
                      <input
                        id="startsAt"
                        type="datetime-local"
                        value={form.startsAt}
                        onChange={e => setForm({ ...form, startsAt: e.target.value })}
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="endsAt">Fin</label>
                      <input
                        id="endsAt"
                        type="datetime-local"
                        value={form.endsAt}
                        onChange={e => setForm({ ...form, endsAt: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setShowForm(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={actionLoading === 'create'}
                    >
                      {actionLoading === 'create' ? 'Creando…' : 'Crear evento'}
                    </button>
                  </div>
                </form>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Lista de eventos */}
          {loading ? (
            <div className="events-grid">
              {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : !isOrganizer ? (
            <motion.div
              className="access-denied"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p>Tu cuenta tiene el rol <strong>{profile?.role ?? 'desconocido'}</strong> y no puede gestionar eventos.</p>
            </motion.div>
          ) : events.length === 0 ? (
            <EmptyState onCreateClick={() => setShowForm(true)} />
          ) : (
            <motion.div
              className="events-grid"
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              <AnimatePresence>
                {events.map(event => (
                  <motion.article
                    key={event.id}
                    className={`event-card ${event.isPublished ? 'is-published' : 'is-draft'}`}
                    variants={cardVariants}
                    layout
                    whileHover={{
                      y: -3,
                      boxShadow: '0 8px 32px oklch(0 0 0 / 0.18)',
                      transition: { duration: 0.18 }
                    }}
                  >
                    <div className="card-top">
                      <StatusBadge published={event.isPublished} />
                      <time className="card-date" dateTime={event.startsAt}>
                        {fmtDate(event.startsAt)}
                      </time>
                    </div>

                    <h2 className="card-title">{event.title}</h2>
                    <p className="card-description">{event.description}</p>

                    <div className="card-meta">
                      <span className="meta-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        {event.venueName} · {event.venueCity}
                      </span>
                      <span className="meta-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Fin: {fmtDate(event.endsAt)}
                      </span>
                    </div>

                    <div className="card-footer">
                      <motion.button
                        className={`btn ${event.isPublished ? 'btn-outline-danger' : 'btn-publish'}`}
                        onClick={() => togglePublish(event)}
                        disabled={actionLoading === event.id}
                        whileTap={{ scale: 0.96 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                      >
                        {actionLoading === event.id
                          ? 'Procesando…'
                          : event.isPublished
                          ? 'Despublicar'
                          : 'Publicar'}
                      </motion.button>
                    </div>
                  </motion.article>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </main>
      </div>
    </>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */
const CSS = `
  @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700&display=swap');

  :root {
    --bg:             #0e0e0f;
    --surface:        #141415;
    --surface-2:      #1a1a1c;
    --surface-3:      #212124;
    --border:         oklch(1 0 0 / 0.08);
    --border-hover:   oklch(1 0 0 / 0.14);
    --text:           #e8e8e9;
    --text-muted:     #8a8a8e;
    --text-faint:     #4a4a50;
    --accent:         #00c2b3;
    --accent-hover:   #00a89b;
    --accent-dim:     oklch(0.6 0.12 185 / 0.15);
    --green:          #34c473;
    --green-dim:      oklch(0.65 0.14 150 / 0.15);
    --amber:          #f5a623;
    --amber-dim:      oklch(0.75 0.15 70 / 0.15);
    --danger:         #e05c5c;
    --danger-dim:     oklch(0.6 0.15 15 / 0.15);
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;
    --radius-xl: 18px;
    --transition: 180ms cubic-bezier(0.16, 1, 0.3, 1);
    --font: 'Satoshi', 'Inter', system-ui, sans-serif;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .page-root {
    min-height: 100vh;
    background: var(--bg);
    color: var(--text);
    font-family: var(--font);
    font-size: 15px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Header ── */
  .page-header {
    position: sticky;
    top: 0;
    z-index: 40;
    background: oklch(from #0e0e0f l c h / 0.85);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--border);
    padding: 0 clamp(1rem, 4vw, 2.5rem);
  }
  .header-inner {
    max-width: 1100px;
    margin: 0 auto;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .header-left { display: flex; align-items: center; gap: 0.75rem; }
  .logo-mark { width: 28px; height: 28px; color: var(--accent); flex-shrink: 0; }
  .page-title { font-size: 1.05rem; font-weight: 600; letter-spacing: -0.01em; color: var(--text); }
  .page-subtitle { font-size: 0.78rem; color: var(--text-muted); margin-top: 1px; }

  /* ── Main ── */
  .page-main {
    max-width: 1100px;
    margin: 0 auto;
    padding: clamp(1.5rem, 4vw, 2.5rem) clamp(1rem, 4vw, 2.5rem);
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* ── Alerts ── */
  .alert {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    border: 1px solid transparent;
  }
  .alert-error {
    background: var(--danger-dim);
    border-color: oklch(0.6 0.15 15 / 0.25);
    color: #f09090;
  }
  .alert-success {
    background: var(--green-dim);
    border-color: oklch(0.65 0.14 150 / 0.25);
    color: #6dda8a;
  }
  .alert-close {
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    opacity: 0.7;
    font-size: 0.8rem;
    padding: 2px 4px;
    border-radius: 4px;
    transition: opacity var(--transition);
  }
  .alert-close:hover { opacity: 1; }

  /* ── Stats ── */
  .stats-row {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .stat-chip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.9rem;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-full, 9999px);
    font-size: 0.82rem;
  }
  .stat-value { font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text); }
  .stat-label { color: var(--text-muted); }
  .stat-chip.accent-green .stat-value { color: var(--green); }
  .stat-chip.accent-amber .stat-value { color: var(--amber); }

  /* ── Form panel ── */
  .form-panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    padding: 1.75rem;
    overflow: hidden;
  }
  .form-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 1.25rem;
    letter-spacing: -0.01em;
  }
  .create-form { display: flex; flex-direction: column; gap: 1rem; }
  .form-row { display: flex; flex-direction: column; gap: 1rem; }
  .form-row.two-col { flex-direction: row; gap: 1rem; }
  @media (max-width: 600px) { .form-row.two-col { flex-direction: column; } }
  .field { display: flex; flex-direction: column; gap: 0.35rem; flex: 1; }
  .field.full { width: 100%; }
  .field label {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-muted);
    letter-spacing: 0.01em;
  }
  .field input, .field textarea, .field select {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text);
    font-family: var(--font);
    font-size: 0.9rem;
    padding: 0.6rem 0.85rem;
    outline: none;
    transition: border-color var(--transition), box-shadow var(--transition);
    resize: vertical;
  }
  .field input::placeholder, .field textarea::placeholder { color: var(--text-faint); }
  .field input:focus, .field textarea:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-dim);
  }
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    padding-top: 0.25rem;
  }

  /* ── Buttons ── */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 1.1rem;
    border-radius: var(--radius-md);
    font-family: var(--font);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    white-space: nowrap;
    transition: background var(--transition), color var(--transition),
                border-color var(--transition), box-shadow var(--transition),
                transform var(--transition);
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-primary {
    background: var(--accent);
    color: #0a1a19;
    border-color: var(--accent);
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
    box-shadow: 0 4px 16px var(--accent-dim);
  }

  .btn-publish {
    background: var(--green-dim);
    color: var(--green);
    border-color: oklch(0.65 0.14 150 / 0.3);
  }
  .btn-publish:hover:not(:disabled) {
    background: oklch(0.65 0.14 150 / 0.22);
    box-shadow: 0 2px 12px var(--green-dim);
  }

  .btn-outline-danger {
    background: var(--danger-dim);
    color: var(--danger);
    border-color: oklch(0.6 0.15 15 / 0.25);
  }
  .btn-outline-danger:hover:not(:disabled) {
    background: oklch(0.6 0.15 15 / 0.2);
  }

  .btn-ghost {
    background: transparent;
    color: var(--text-muted);
    border-color: var(--border);
  }
  .btn-ghost:hover:not(:disabled) {
    background: var(--surface-2);
    color: var(--text);
    border-color: var(--border-hover);
  }

  /* ── Status badge ── */
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.65rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.01em;
  }
  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .status-badge.published {
    background: var(--green-dim);
    color: var(--green);
    border: 1px solid oklch(0.65 0.14 150 / 0.25);
  }
  .status-badge.published .status-dot { background: var(--green); }
  .status-badge.draft {
    background: oklch(0.75 0.15 70 / 0.12);
    color: var(--amber);
    border: 1px solid oklch(0.75 0.15 70 / 0.25);
  }
  .status-badge.draft .status-dot { background: var(--amber); }

  /* ── Events grid ── */
  .events-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr));
    gap: 1rem;
  }

  /* ── Event card ── */
  .event-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    cursor: default;
    transition: border-color var(--transition);
  }
  .event-card:hover { border-color: var(--border-hover); }
  .event-card.is-published { border-color: oklch(0.65 0.14 150 / 0.18); }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .card-date {
    font-size: 0.75rem;
    color: var(--text-faint);
    white-space: nowrap;
  }

  .card-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text);
    line-height: 1.3;
    letter-spacing: -0.01em;
  }

  .card-description {
    font-size: 0.875rem;
    color: var(--text-muted);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-meta {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin-top: 0.25rem;
  }
  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: var(--text-muted);
  }
  .meta-item svg { flex-shrink: 0; color: var(--text-faint); }

  .card-footer {
    margin-top: auto;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: flex-end;
  }

  /* ── Skeleton ── */
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  .skeleton {
    background: linear-gradient(90deg,
      var(--surface-2) 25%,
      var(--surface-3) 50%,
      var(--surface-2) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.6s ease-in-out infinite;
    border-radius: var(--radius-sm);
  }
  .skeleton-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .skel-title  { height: 18px; width: 65%; }
  .skel-meta   { height: 14px; width: 40%; }
  .skel-body   { height: 13px; width: 90%; }
  .skel-body.short { width: 70%; }
  .skel-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; }
  .skel-badge  { height: 22px; width: 90px; border-radius: 9999px; }
  .skel-btn    { height: 32px; width: 100px; border-radius: var(--radius-md); }

  /* ── Empty state ── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 5rem 2rem;
    gap: 0.75rem;
    color: var(--text-muted);
  }
  .empty-icon {
    width: 48px;
    height: 48px;
    color: var(--text-faint);
    margin-bottom: 0.5rem;
  }
  .empty-state h3 { font-size: 1rem; font-weight: 600; color: var(--text); }
  .empty-state p  { font-size: 0.875rem; max-width: 34ch; }
  .empty-state .btn { margin-top: 0.5rem; }

  /* ── Access denied ── */
  .access-denied {
    padding: 3rem 1rem;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.9rem;
  }
  .access-denied strong { color: var(--text); }
`;
