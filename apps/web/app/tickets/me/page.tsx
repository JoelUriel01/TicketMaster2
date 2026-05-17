'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Ticket {
  id: string;
  eventId: string;
  orderId: string;
  ownerId: string;
  quantity: number;
  status: string;
  createdAt: string;
  price: string;
  currency: string;
  event?: {
    id: string;
    title: string;
    venueName: string;
    venueCity: string;
    startsAt: string;
  };
  order?: {
    id: string;
    totalAmount: string;
    currency: string;
    status: string;
  };
}

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

const PALETTE = ['#00c2b3', '#f5a623', '#e05c5c', '#7c3aed', '#2563eb', '#16a34a', '#db2777', '#ea580c'];

function colorFor(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function initials(t: string) {
  return t
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadTickets() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setError('Tu sesión expiró. Inicia sesión nuevamente.');
          return;
        }

        const res = await fetch('http://localhost:3001/tickets/me', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || 'No se pudieron cargar tus boletos');
        }

        const data = await res.json();
        setTickets(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setError(e.message ?? 'Ocurrió un error al cargar tus boletos.');
      } finally {
        setLoading(false);
      }
    }

    loadTickets();
  }, []);

  return (
    <>
      <style>{CSS}</style>

      <div className="page-root">
        <nav className="top-nav">
          <div className="nav-inner">
            <Link href="/discover" className="back-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Descubrir
            </Link>
            <span className="nav-title">Mis boletos</span>
          </div>
        </nav>

        <main className="tickets-layout">
          <header className="tickets-header">
            <h1 className="tickets-title">Mis boletos</h1>
            <p className="tickets-subtitle">Aquí verás todos los boletos que has adquirido.</p>
          </header>

          {loading ? (
            <div className="loading-state">
              <div className="spinner" />
            </div>
          ) : error ? (
            <div className="error-state">
              <p>{error}</p>
              <Link href="/discover" className="back-link">
                ← Volver a descubrir eventos
              </Link>
            </div>
          ) : tickets.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V9z" />
                  <path d="M13 5v2" />
                  <path d="M13 17v2" />
                  <path d="M13 11v2" />
                </svg>
              </div>
              <h2>Sin boletos todavía</h2>
              <p>Cuando adquieras un boleto, aparecerá aquí.</p>
              <Link href="/discover" className="discover-btn">
                Descubrir eventos
              </Link>
            </div>
          ) : (
            <section className="tickets-grid" aria-label="Lista de boletos">
              {tickets.map((ticket) => {
                const title = ticket.event?.title ?? 'Evento';
                const color = colorFor(title);
                const abbr = initials(title);
                const shortId = ticket.id.slice(0, 8).toUpperCase();

                return (
                  <Link key={ticket.id} href={`/tickets/${ticket.id}`} className="ticket-card">
                    <div
                      className="ticket-top"
                      style={{ background: `linear-gradient(135deg, ${color}28 0%, #17171a 100%)` }}
                    >
                      <div className="ticket-avatar" style={{ background: color }}>
                        {abbr}
                      </div>

                      <div className="ticket-top-info">
                        <h2>{title}</h2>
                        {ticket.event && (
                          <p>
                            {fmtDate(ticket.event.startsAt)}, {fmtTime(ticket.event.startsAt)}
                          </p>
                        )}
                      </div>

                      <span className={`status-badge status-${(ticket.status ?? 'active').toLowerCase()}`}>
                        {ticket.status}
                      </span>
                    </div>

                    <div className="ticket-body">
                      <div className="ticket-row">
                        <span>Recinto</span>
                        <strong>{ticket.event?.venueName ?? '—'}</strong>
                      </div>

                      <div className="ticket-row">
                        <span>Ciudad</span>
                        <strong>{ticket.event?.venueCity ?? '—'}</strong>
                      </div>

                      <div className="ticket-row">
                        <span>Precio</span>
                        <strong>
                          ${Number(ticket.price).toLocaleString('es-MX')} {ticket.currency}
                        </strong>
                      </div>

                      <div className="ticket-row">
                        <span>Código</span>
                        <strong>#{shortId}</strong>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </section>
          )}
        </main>
      </div>
    </>
  );
}

const CSS = `
:root{
  --bg:#050507;
  --panel:#101014;
  --panel-2:#15151b;
  --border:#23232c;
  --text:#f4f4f5;
  --muted:#9a9aa5;
  --soft:#6f6f78;
  --accent:#7c3aed;
  --accent-2:#9333ea;
  --success:#22c55e;
  --danger:#ef4444;
}

*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,sans-serif}
a{text-decoration:none;color:inherit}

.page-root{
  min-height:100vh;
  background:
    radial-gradient(circle at top, rgba(124,58,237,.10), transparent 28%),
    linear-gradient(180deg, #050507 0%, #09090c 100%);
}

.top-nav{
  position:sticky;
  top:0;
  z-index:20;
  backdrop-filter:blur(18px);
  background:rgba(5,5,7,.72);
  border-bottom:1px solid rgba(255,255,255,.05);
}

.nav-inner{
  max-width:1120px;
  margin:0 auto;
  padding:18px 20px;
  display:flex;
  align-items:center;
  justify-content:space-between;
}

.back-btn{
  display:inline-flex;
  align-items:center;
  gap:8px;
  color:var(--muted);
  font-size:14px;
  transition:.2s ease;
}
.back-btn:hover{color:#fff}

.nav-title{
  font-size:14px;
  color:#d4d4d8;
  font-weight:600;
}

.tickets-layout{
  max-width:1120px;
  margin:0 auto;
  padding:32px 20px 80px;
}

.tickets-header{
  margin-bottom:28px;
}

.tickets-title{
  margin:0;
  font-size:40px;
  line-height:1;
  letter-spacing:-.03em;
}

.tickets-subtitle{
  margin:10px 0 0;
  color:var(--muted);
  font-size:15px;
}

.loading-state,
.error-state,
.empty-state{
  min-height:52vh;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  text-align:center;
}

.spinner{
  width:44px;
  height:44px;
  border-radius:999px;
  border:3px solid rgba(255,255,255,.08);
  border-top-color:var(--accent);
  animation:spin .8s linear infinite;
}
@keyframes spin{to{transform:rotate(360deg)}}

.error-state p,
.empty-state p{
  color:var(--muted);
  margin:10px 0 0;
}

.back-link,
.discover-btn{
  margin-top:18px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-height:44px;
  padding:0 18px;
  border-radius:999px;
  border:1px solid rgba(124,58,237,.35);
  color:#e9d5ff;
  transition:.2s ease;
}
.back-link:hover,
.discover-btn:hover{
  background:rgba(124,58,237,.12);
}

.empty-icon{
  width:64px;
  height:64px;
  border-radius:999px;
  display:grid;
  place-items:center;
  color:#b9b9c3;
  border:1px solid rgba(255,255,255,.06);
  background:linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.01));
  margin-bottom:16px;
}

.empty-state h2{
  margin:0;
  font-size:30px;
  letter-spacing:-.03em;
}

.tickets-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));
  gap:20px;
}

.ticket-card{
  border-radius:24px;
  overflow:hidden;
  border:1px solid var(--border);
  background:linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.01));
  box-shadow:0 12px 40px rgba(0,0,0,.28);
  transition:transform .2s ease, border-color .2s ease, box-shadow .2s ease;
}
.ticket-card:hover{
  transform:translateY(-3px);
  border-color:rgba(124,58,237,.4);
  box-shadow:0 18px 48px rgba(0,0,0,.36);
}

.ticket-top{
  display:flex;
  align-items:flex-start;
  gap:14px;
  padding:18px;
  border-bottom:1px dashed rgba(255,255,255,.08);
}

.ticket-avatar{
  width:54px;
  height:54px;
  border-radius:16px;
  display:grid;
  place-items:center;
  font-weight:800;
  color:#fff;
  flex-shrink:0;
  box-shadow:inset 0 -10px 18px rgba(0,0,0,.18);
}

.ticket-top-info{
  min-width:0;
  flex:1;
}

.ticket-top-info h2{
  margin:0;
  font-size:20px;
  line-height:1.1;
  letter-spacing:-.03em;
}

.ticket-top-info p{
  margin:6px 0 0;
  color:var(--muted);
  font-size:14px;
}

.ticket-body{
  padding:18px;
  display:grid;
  gap:12px;
}

.ticket-row{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px;
  font-size:14px;
}

.ticket-row span{
  color:var(--muted);
}

.ticket-row strong{
  color:#fff;
  font-weight:700;
  text-align:right;
}

.status-badge{
  flex-shrink:0;
  border-radius:999px;
  padding:8px 12px;
  font-size:11px;
  font-weight:800;
  letter-spacing:.08em;
  text-transform:uppercase;
  border:1px solid rgba(255,255,255,.08);
}

.status-active{
  color:#86efac;
  background:rgba(34,197,94,.10);
}

.status-used{
  color:#93c5fd;
  background:rgba(59,130,246,.10);
}

.status-revoked{
  color:#fca5a5;
  background:rgba(239,68,68,.10);
}

@media (max-width:640px){
  .nav-inner{padding:16px}
  .tickets-layout{padding:24px 16px 64px}
  .tickets-title{font-size:32px}
  .ticket-top{flex-wrap:wrap}
  .status-badge{margin-left:auto}
}
`;