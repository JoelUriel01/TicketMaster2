'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Organizer {
  id: string;
  fullName: string;
  email: string;
}

interface Event {
  id: string;
  title: string;
  description: string;
  venueName: string;
  venueCity: string;
  startsAt: string;
  endsAt: string;
  isPublished: boolean;
  organizer?: Organizer;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function durationHrs(start: string, end: string) {
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
  if (diff < 24) return `${diff % 1 === 0 ? diff : diff.toFixed(1)} h`;
  return `${Math.round(diff / 24)} días`;
}

const PALETTE = [
  '#00c2b3', '#f5a623', '#e05c5c', '#7c3aed',
  '#2563eb', '#16a34a', '#db2777', '#ea580c',
];

function colorFor(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function initials(t: string) {
  return t.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function Skeleton() {
  return (
    <div className="detail-skeleton">
      <div className="skel-hero skeleton" />
      <div className="skel-content">
        <div className="skeleton sh" style={{ width: '60%', height: 32 }} />
        <div className="skeleton sh" style={{ width: '40%', height: 16, marginTop: 12 }} />
        <div className="skeleton sh" style={{ width: '100%', height: 14, marginTop: 24 }} />
        <div className="skeleton sh" style={{ width: '90%', height: 14, marginTop: 8 }} />
        <div className="skeleton sh" style={{ width: '75%', height: 14, marginTop: 8 }} />
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="nf-wrap">
      <svg width="52" height="52" viewBox="0 0 48 48" fill="none" className="nf-icon" aria-hidden="true">
        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.5" />
        <path d="M16 28s2-4 8-4 8 4 8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="18" cy="20" r="2" fill="currentColor" />
        <circle cx="30" cy="20" r="2" fill="currentColor" />
      </svg>
      <h2>Evento no encontrado</h2>
      <p>El evento que buscas no existe o ya no está disponible.</p>
      <Link href="/discover" className="back-link">← Regresar a Descubrir</Link>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="info-row">
      <span className="info-icon" aria-hidden="true">{icon}</span>
      <div className="info-text">
        <span className="info-label">{label}</span>
        <span className="info-value">{value}</span>
      </div>
    </div>
  );
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNF] = useState(false);

  const router = useRouter();


  useEffect(() => {
    if (!id) return;

    fetch(`http://localhost:3001/events/${id}`)
      .then((r) => {
        if (r.status === 404) {
          setNF(true);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((data) => {
        if (data) setEvent(data);
      })
      .catch(() => setNF(true))
      .finally(() => setLoading(false));
  }, [id]);

  const color = event ? colorFor(event.title) : '#00c2b3';
  const abbr = event ? initials(event.title) : '';

  return (
    <>
      <style>{CSS}</style>
      <div className="page-root">
        <nav className="top-nav">
          <div className="nav-inner">
            <Link href="/discover" className="back-btn" aria-label="Regresar a Descubrir">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Descubrir
            </Link>
          </div>
        </nav>

        {loading ? (
          <Skeleton />
        ) : notFound || !event ? (
          <NotFound />
        ) : (
          <article className="detail-layout">
            <div
              className="detail-hero"
              style={{ background: `linear-gradient(135deg, ${color}18 0%, #0e0e0f 100%)` }}
              aria-hidden="true"
            >
              <div className="detail-grid-bg" />
              <div className="detail-hero-inner">
                <div className="detail-avatar" style={{ background: color }}>
                  {abbr}
                </div>
              </div>
            </div>

            <div className="detail-content">
              <div className="detail-main">
                <header className="detail-header">
                  <h1 className="detail-title">{event.title}</h1>
                  <div className="detail-byline">
                    {event.organizer && (
                      <span className="byline-org">
                        Organizado por <strong>{event.organizer.fullName}</strong>
                      </span>
                    )}
                  </div>
                </header>

                <section className="detail-section" aria-labelledby="desc-heading">
                  <h2 id="desc-heading" className="section-heading">Acerca de este evento</h2>
                  <p className="detail-desc">{event.description}</p>
                </section>
              </div>

              <aside className="detail-sidebar">
                <div className="info-card">
                  <h2 className="info-card-title">Detalles</h2>

                  <InfoRow
                    label="Fecha de inicio"
                    value={`${fmtDate(event.startsAt)}, ${fmtTime(event.startsAt)}`}
                    icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
                  />
                  <InfoRow
                    label="Fecha de cierre"
                    value={`${fmtDate(event.endsAt)}, ${fmtTime(event.endsAt)}`}
                    icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" /></svg>}
                  />
                  <InfoRow
                    label="Duración"
                    value={durationHrs(event.startsAt, event.endsAt)}
                    icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.73 4.27a10 10 0 1 0 2 2" /><polyline points="22,2 22,6 18,6" /></svg>}
                  />
                  <InfoRow
                    label="Recinto"
                    value={event.venueName}
                    icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9,22 9,12 15,12 15,22" /></svg>}
                  />
                  <InfoRow
                    label="Ciudad"
                    value={event.venueCity}
                    icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>}
                  />

                    <button
                    className="cta-btn"
                    style={{ ['--accent-color' as any]: color }}
                    onClick={() => router.push(`/events/${event.id}/checkout`)}
                    >
                    Obtener entradas
                    </button>

                  <p className="cta-note">Reserva tu lugar — cupo limitado</p>
                </div>

                {event.organizer && (
                  <div className="org-card">
                    <h3 className="org-card-title">Organizador</h3>
                    <div className="org-row">
                      <div className="org-avatar" style={{ background: color, color: '#0e0e0f' }}>
                        {event.organizer.fullName.slice(0, 1)}
                      </div>
                      <div>
                        <p className="org-name">{event.organizer.fullName}</p>
                        <p className="org-email">{event.organizer.email}</p>
                      </div>
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </article>
        )}
      </div>
    </>
  );
}


/* ─── Styles ─────────────────────────────────────────────── */
const CSS = `
  @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700&display=swap');

  :root {
    --bg:           #0e0e0f;
    --surface:      #141415;
    --surface-2:    #1a1a1c;
    --surface-3:    #212124;
    --border:       oklch(1 0 0 / 0.08);
    --border-hover: oklch(1 0 0 / 0.16);
    --text:         #e8e8e9;
    --text-muted:   #8a8a8e;
    --text-faint:   #4a4a50;
    --accent:       #00c2b3;
    --accent-dim:   oklch(0.6 0.12 185 / 0.15);
    --radius-sm: 6px; --radius-md: 10px; --radius-lg: 14px; --radius-xl: 18px;
    --transition: 180ms cubic-bezier(0.16, 1, 0.3, 1);
    --font: 'Satoshi', 'Inter', system-ui, sans-serif;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  .page-root {
    min-height: 100vh; background: var(--bg); color: var(--text);
    font-family: var(--font); font-size: 15px; line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Nav ── */
  .top-nav { border-bottom: 1px solid var(--border); padding: 0.85rem clamp(1rem,4vw,2.5rem); position: sticky; top: 0; background: oklch(0.1 0 0 / 0.85); backdrop-filter: blur(12px); z-index: 10; }
  .nav-inner { max-width: 1100px; margin: 0 auto; }
  .back-btn { display: inline-flex; align-items: center; gap: 0.4rem; color: var(--text-muted); font-size: 0.875rem; font-weight: 500; text-decoration: none; transition: color var(--transition); }
  .back-btn:hover { color: var(--text); }

  /* ── Detail hero ── */
  .detail-hero { position: relative; height: clamp(160px, 22vw, 260px); overflow: hidden; display: flex; align-items: flex-end; }
  .detail-grid-bg {
    position: absolute; inset: 0;
    background-image: linear-gradient(oklch(1 0 0 / 0.03) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.03) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(ellipse 80% 100% at 50% 0%, black 0%, transparent 100%);
  }
  .detail-hero-inner { position: relative; z-index: 2; padding: 0 clamp(1rem,4vw,2.5rem) 1.5rem; max-width: 1100px; width: 100%; margin: 0 auto; }
  .detail-avatar { width: 64px; height: 64px; border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 700; color: #0e0e0f; box-shadow: 0 4px 16px oklch(0 0 0 / 0.5); border: 2px solid oklch(1 0 0 / 0.1); }

  /* ── Detail layout ── */
  .detail-layout { max-width: 1100px; margin: 0 auto; }
  .detail-content {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 2rem;
    padding: 2rem clamp(1rem, 4vw, 2.5rem) 4rem;
    align-items: start;
  }
  @media (max-width: 768px) { .detail-content { grid-template-columns: 1fr; } .detail-sidebar { order: -1; } }

  /* ── Main ── */
  .detail-header { margin-bottom: 1.75rem; }
  .detail-title { font-size: clamp(1.5rem, 4vw, 2.2rem); font-weight: 700; letter-spacing: -0.03em; line-height: 1.15; color: var(--text); }
  .detail-byline { margin-top: 0.5rem; font-size: 0.875rem; color: var(--text-muted); }
  .byline-org strong { color: var(--text); font-weight: 600; }
  .detail-section { margin-bottom: 2rem; }
  .section-heading { font-size: 0.8rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-faint); margin-bottom: 0.75rem; }
  .detail-desc { font-size: 0.95rem; color: var(--text-muted); line-height: 1.75; max-width: 68ch; }

  /* ── Info card ── */
  .info-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: 1.25rem; display: flex; flex-direction: column; gap: 0.9rem; }
  .info-card-title { font-size: 0.8rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-faint); margin-bottom: 0.1rem; }
  .info-row { display: flex; align-items: flex-start; gap: 0.65rem; }
  .info-icon { color: var(--text-faint); flex-shrink: 0; margin-top: 2px; }
  .info-text { display: flex; flex-direction: column; gap: 0.1rem; }
  .info-label { font-size: 0.72rem; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-faint); }
  .info-value { font-size: 0.875rem; color: var(--text); font-weight: 500; }

  /* ── CTA ── */
  .cta-btn {
    width: 100%;
    padding: 0.8rem;
    border: none;
    border-radius: var(--radius-lg);
    background: var(--accent-color, var(--accent));
    color: #0e0e0f;
    font-family: var(--font);
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    margin-top: 0.4rem;
    transition: opacity var(--transition), transform var(--transition);
  }
  .cta-btn:hover { opacity: 0.88; transform: translateY(-1px); }
  .cta-btn:active { transform: translateY(0); }
  .cta-note { font-size: 0.72rem; color: var(--text-faint); text-align: center; }

  /* ── Organizer card ── */
  .org-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: 1.1rem; margin-top: 0.75rem; }
  .org-card-title { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-faint); margin-bottom: 0.75rem; }
  .org-row { display: flex; align-items: center; gap: 0.75rem; }
  .org-avatar { width: 38px; height: 38px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 700; flex-shrink: 0; }
  .org-name  { font-size: 0.875rem; font-weight: 600; color: var(--text); }
  .org-email { font-size: 0.78rem; color: var(--text-faint); }

  /* ── Not found ── */
  .nf-wrap { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 6rem 2rem; gap: 0.75rem; color: var(--text-muted); }
  .nf-icon { color: var(--text-faint); margin-bottom: 0.5rem; }
  .nf-wrap h2 { font-size: 1.1rem; font-weight: 600; color: var(--text); }
  .nf-wrap p { font-size: 0.875rem; max-width: 34ch; }
  .back-link { display: inline-flex; align-items: center; gap: 0.3rem; color: var(--accent); font-size: 0.875rem; font-weight: 500; text-decoration: none; margin-top: 0.5rem; }
  .back-link:hover { opacity: 0.8; }

  /* ── Skeleton ── */
  @keyframes shimmer { 0%{background-position:-200% 0}100%{background-position:200% 0} }
  .skeleton { background: linear-gradient(90deg,var(--surface-2) 25%,var(--surface-3) 50%,var(--surface-2) 75%); background-size:200% 100%; animation:shimmer 1.6s ease-in-out infinite; border-radius:var(--radius-sm); }
  .detail-skeleton { }
  .skel-hero { height: clamp(160px,22vw,260px); border-radius: 0; }
  .skel-content { max-width: 1100px; margin: 0 auto; padding: 2rem clamp(1rem,4vw,2.5rem); display: flex; flex-direction: column; gap: 12px; }
  .sh { border-radius: var(--radius-sm); }
`;
