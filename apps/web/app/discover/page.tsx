'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

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
}

/* ─── Helpers ────────────────────────────────────────────── */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ─── Avatar de color basado en título ──────────────────── */
const PALETTE = [
  '#00c2b3', '#f5a623', '#e05c5c', '#7c3aed',
  '#2563eb', '#16a34a', '#db2777', '#ea580c',
];
function colorFor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
function initials(title: string) {
  return title.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

/* ─── Skeleton ───────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="skel-card">
      <div className="skel-banner skeleton" />
      <div className="skel-body">
        <div className="skeleton skel-title" />
        <div className="skeleton skel-meta" />
        <div className="skeleton skel-meta short" />
      </div>
    </div>
  );
}

/* ─── Event Card ─────────────────────────────────────────── */
function EventCard({ event }: { event: Event }) {
  const color = colorFor(event.title);
  const abbr  = initials(event.title);

  return (
    <Link href={`/events/${event.id}`} className="event-card" style={{ '--accent-color': color } as React.CSSProperties}>
      <div className="card-banner" style={{ background: `linear-gradient(135deg, ${color}22 0%, #0e0e0f 100%)` }}>
        <div className="card-avatar" style={{ background: color }}>
          {abbr}
        </div>
        <div className="card-city-badge">{event.venueCity}</div>
      </div>

      <div className="card-body">
        <h2 className="card-title">{event.title}</h2>
        <p className="card-desc">{event.description}</p>

        <div className="card-meta-row">
          <span className="card-meta-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {fmtDate(event.startsAt)}
          </span>
          <span className="card-meta-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
            </svg>
            {fmtTime(event.startsAt)}
          </span>
        </div>

        <div className="card-venue">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          {event.venueName}
        </div>

        <div className="card-footer">
          <span className="card-cta">Ver evento →</span>
        </div>
      </div>
    </Link>
  );
}

/* ─── Empty State ────────────────────────────────────────── */
function EmptyState({ query }: { query: string }) {
  return (
    <div className="empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="empty-icon" aria-hidden="true">
        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M16 28s2-4 8-4 8 4 8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="18" cy="20" r="2" fill="currentColor"/>
        <circle cx="30" cy="20" r="2" fill="currentColor"/>
      </svg>
      {query
        ? <><h3>Sin resultados para "{query}"</h3><p>Intenta con otra ciudad o palabra clave.</p></>
        : <><h3>No hay eventos disponibles</h3><p>Vuelve pronto, nuevos eventos se publican seguido.</p></>
      }
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function DiscoverPage() {
  const [events, setEvents]   = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [city, setCity]       = useState('');

  useEffect(() => {
    fetch('http://localhost:3001/events')
      .then(r => r.ok ? r.json() : [])
      .then(data => setEvents(data))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const cities = useMemo(() => {
    const set = new Set(events.map(e => e.venueCity));
    return Array.from(set).sort();
  }, [events]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return events.filter(e => {
      const matchText = !q || e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
      const matchCity = !city || e.venueCity === city;
      return matchText && matchCity;
    });
  }, [events, search, city]);

  const hasFilters = search || city;

  return (
    <>
      <style>{CSS}</style>
      <div className="page-root">

        {/* ── Hero ── */}
        <header className="hero">
          <div className="hero-inner">
            <div className="hero-eyebrow">Eventos en vivo</div>
            <h1 className="hero-title">Descubre tu próxima experiencia</h1>
            <p className="hero-sub">Conciertos, festivales, teatro y más — todo en un solo lugar.</p>

            {/* Search bar */}
            <div className="search-bar">
              <div className="search-input-wrap">
                <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="search"
                  className="search-input"
                  placeholder="Buscar eventos…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  aria-label="Buscar eventos"
                />
              </div>

              <select
                className="city-select"
                value={city}
                onChange={e => setCity(e.target.value)}
                aria-label="Filtrar por ciudad"
              >
                <option value="">Todas las ciudades</option>
                {cities.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {hasFilters && (
                <button
                  className="clear-btn"
                  onClick={() => { setSearch(''); setCity(''); }}
                  aria-label="Limpiar filtros"
                >
                  ✕ Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Decorative grid lines */}
          <div className="hero-grid" aria-hidden="true" />
        </header>

        {/* ── Stats bar ── */}
        {!loading && events.length > 0 && (
          <div className="stats-bar">
            <div className="stats-inner">
              <span className="stat">
                <strong>{filtered.length}</strong>
                {hasFilters ? ' resultado' + (filtered.length !== 1 ? 's' : '') : ' evento' + (events.length !== 1 ? 's' : '')}
              </span>
              {hasFilters && events.length !== filtered.length && (
                <span className="stat muted">de {events.length} totales</span>
              )}
            </div>
          </div>
        )}

        {/* ── Content ── */}
        <main className="page-main">
          {loading ? (
            <div className="events-grid">
              {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState query={search} />
          ) : (
            <div className="events-grid">
              {filtered.map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
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
    --bg:            #0e0e0f;
    --surface:       #141415;
    --surface-2:     #1a1a1c;
    --surface-3:     #212124;
    --border:        oklch(1 0 0 / 0.08);
    --border-hover:  oklch(1 0 0 / 0.16);
    --text:          #e8e8e9;
    --text-muted:    #8a8a8e;
    --text-faint:    #4a4a50;
    --accent:        #00c2b3;
    --accent-hover:  #00a89b;
    --accent-dim:    oklch(0.6 0.12 185 / 0.15);
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

  /* ── Hero ── */
  .hero {
    position: relative;
    overflow: hidden;
    padding: clamp(3.5rem, 8vw, 6rem) clamp(1rem, 4vw, 2.5rem) clamp(2.5rem, 5vw, 4rem);
    border-bottom: 1px solid var(--border);
  }
  .hero-inner {
    position: relative;
    z-index: 2;
    max-width: 960px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0;
  }
  .hero-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 1rem;
    padding: 0.3rem 0.85rem;
    border: 1px solid oklch(0.6 0.12 185 / 0.3);
    border-radius: 9999px;
    background: var(--accent-dim);
  }
  .hero-title {
    font-size: clamp(2rem, 5vw, 3.5rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.1;
    color: var(--text);
    margin-bottom: 0.75rem;
  }
  .hero-sub {
    font-size: clamp(0.95rem, 2vw, 1.1rem);
    color: var(--text-muted);
    max-width: 48ch;
    margin-bottom: 2.25rem;
  }

  /* ── Search bar ── */
  .search-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    max-width: 680px;
    flex-wrap: wrap;
  }
  @media (max-width: 600px) {
    .search-bar { flex-direction: column; align-items: stretch; }
  }
  .search-input-wrap {
    position: relative;
    flex: 1;
    min-width: 180px;
  }
  .search-icon {
    position: absolute;
    left: 0.875rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-faint);
    pointer-events: none;
  }
  .search-input {
    width: 100%;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    color: var(--text);
    font-family: var(--font);
    font-size: 0.9rem;
    padding: 0.7rem 1rem 0.7rem 2.6rem;
    outline: none;
    transition: border-color var(--transition), box-shadow var(--transition);
    appearance: none;
  }
  .search-input::placeholder { color: var(--text-faint); }
  .search-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-dim);
  }
  .search-input::-webkit-search-cancel-button { display: none; }

  .city-select {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    color: var(--text);
    font-family: var(--font);
    font-size: 0.875rem;
    padding: 0.7rem 1rem;
    outline: none;
    cursor: pointer;
    transition: border-color var(--transition), box-shadow var(--transition);
    appearance: none;
    padding-right: 2.25rem;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a8a8e' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
  }
  .city-select:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-dim);
  }
  .city-select option { background: #1a1a1c; color: var(--text); }

  .clear-btn {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    color: var(--text-muted);
    font-family: var(--font);
    font-size: 0.82rem;
    font-weight: 500;
    padding: 0.7rem 1rem;
    cursor: pointer;
    white-space: nowrap;
    transition: color var(--transition), border-color var(--transition), background var(--transition);
  }
  .clear-btn:hover { color: var(--text); border-color: var(--border-hover); background: var(--surface-2); }

  /* ── Hero grid decoration ── */
  .hero-grid {
    position: absolute;
    inset: 0;
    z-index: 1;
    background-image:
      linear-gradient(oklch(1 0 0 / 0.025) 1px, transparent 1px),
      linear-gradient(90deg, oklch(1 0 0 / 0.025) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 100%);
  }

  /* ── Stats bar ── */
  .stats-bar {
    border-bottom: 1px solid var(--border);
    padding: 0.6rem clamp(1rem, 4vw, 2.5rem);
  }
  .stats-inner {
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.82rem;
  }
  .stat { color: var(--text-muted); }
  .stat strong { color: var(--text); font-weight: 600; }
  .stat.muted { color: var(--text-faint); }

  /* ── Main ── */
  .page-main {
    max-width: 1100px;
    margin: 0 auto;
    padding: clamp(1.5rem, 4vw, 2.5rem) clamp(1rem, 4vw, 2.5rem);
  }

  /* ── Events grid ── */
  .events-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
    gap: 1rem;
  }

  /* ── Event card ── */
  .event-card {
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    overflow: hidden;
    text-decoration: none;
    color: inherit;
    transition: border-color var(--transition), transform var(--transition), box-shadow var(--transition);
  }
  .event-card:hover {
    border-color: var(--accent-color, var(--accent));
    transform: translateY(-3px);
    box-shadow:
      0 4px 16px oklch(0 0 0 / 0.25),
      0 0 0 1px var(--accent-color, var(--accent)) inset;
  }
  .event-card:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }

  .card-banner {
    position: relative;
    height: 100px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: 0.75rem 1rem;
  }
  .card-avatar {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    font-weight: 700;
    color: #0e0e0f;
    letter-spacing: 0.01em;
    flex-shrink: 0;
    box-shadow: 0 2px 8px oklch(0 0 0 / 0.4);
  }
  .card-city-badge {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
    background: oklch(0 0 0 / 0.45);
    backdrop-filter: blur(6px);
    padding: 0.2rem 0.55rem;
    border-radius: 9999px;
    border: 1px solid var(--border);
  }

  .card-body {
    padding: 1rem 1.1rem 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    flex: 1;
  }
  .card-title {
    font-size: 0.975rem;
    font-weight: 700;
    color: var(--text);
    letter-spacing: -0.01em;
    line-height: 1.3;
  }
  .card-desc {
    font-size: 0.82rem;
    color: var(--text-muted);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .card-meta-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-top: 0.2rem;
  }
  .card-meta-item {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.78rem;
    color: var(--text-muted);
  }
  .card-meta-item svg { color: var(--text-faint); flex-shrink: 0; }
  .card-venue {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.78rem;
    color: var(--text-faint);
  }
  .card-venue svg { flex-shrink: 0; }
  .card-footer {
    margin-top: auto;
    padding-top: 0.6rem;
    display: flex;
    justify-content: flex-end;
  }
  .card-cta {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--accent-color, var(--accent));
    letter-spacing: 0.01em;
    transition: letter-spacing var(--transition);
  }
  .event-card:hover .card-cta {
    letter-spacing: 0.04em;
  }

  /* ── Skeleton ── */
  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
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
  .skel-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    overflow: hidden;
  }
  .skel-banner { height: 100px; border-radius: 0; }
  .skel-body   { padding: 1rem 1.1rem 1.1rem; display: flex; flex-direction: column; gap: 0.6rem; }
  .skel-title  { height: 16px; width: 70%; }
  .skel-meta   { height: 13px; width: 55%; }
  .skel-meta.short { width: 40%; }

  /* ── Empty state ── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 5rem 2rem;
    gap: 0.75rem;
    color: var(--text-muted);
    grid-column: 1 / -1;
  }
  .empty-icon { color: var(--text-faint); margin-bottom: 0.5rem; }
  .empty-state h3 { font-size: 1rem; font-weight: 600; color: var(--text); }
  .empty-state p  { font-size: 0.875rem; max-width: 34ch; }
`;
