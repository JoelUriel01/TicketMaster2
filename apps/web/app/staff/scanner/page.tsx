'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Scanner } from '@yudiel/react-qr-scanner';
import { createClient } from '@/lib/supabase/client';

type Role = 'BUYER' | 'ORGANIZER' | 'STAFF' | 'ADMIN';

type MeResponse = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  mfaEnabled?: boolean;
  createdAt?: string;
};

type ScanApiResult =
  | 'VALID'
  | 'INVALID'
  | 'EXPIRED'
  | 'ALREADY_USED'
  | 'REVOKED'
  | 'REPLAY_DETECTED';

type ScanResponse = {
  ok: boolean;
  result: ScanApiResult;
  message: string;
  ticketId?: string;
  ticket?: {
    id: string;
    status: string;
    usedAt?: string | null;
    event?: {
      id: string;
      title: string;
      startsAt: string;
      endsAt: string;
      venueName: string;
      venueCity: string;
    };
    owner?: {
      id: string;
      fullName: string;
      email: string;
    };
  };
};

function getResultTone(result?: ScanApiResult) {
  switch (result) {
    case 'VALID':
      return {
        bg: 'rgba(34,197,94,.12)',
        border: 'rgba(34,197,94,.30)',
        text: '#86efac',
        title: 'Acceso permitido',
      };
    case 'ALREADY_USED':
      return {
        bg: 'rgba(251,191,36,.10)',
        border: 'rgba(251,191,36,.28)',
        text: '#fcd34d',
        title: 'Boleto ya usado',
      };
    case 'REVOKED':
    case 'INVALID':
    case 'EXPIRED':
    case 'REPLAY_DETECTED':
      return {
        bg: 'rgba(239,68,68,.10)',
        border: 'rgba(239,68,68,.28)',
        text: '#fca5a5',
        title: 'Acceso rechazado',
      };
    default:
      return {
        bg: 'rgba(255,255,255,.03)',
        border: 'rgba(255,255,255,.08)',
        text: '#e5e7eb',
        title: 'Esperando escaneo',
      };
  }
}

function extractTicketId(raw: string): string | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.ticketId && typeof parsed.ticketId === 'string') {
      return parsed.ticketId;
    }
  } catch {}

  const trimmed = raw.trim();

  const matchJsonLike = trimmed.match(/"ticketId"\s*:\s*"([^"]+)"/);
  if (matchJsonLike?.[1]) return matchJsonLike[1];

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (uuidRegex.test(trimmed)) return trimmed;

  return null;
}

export default function StaffScannerPage() {
  const router = useRouter();

  const [bootLoading, setBootLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [me, setMe] = useState<MeResponse | null>(null);

  const [gate, setGate] = useState('Acceso principal');
  const [deviceId, setDeviceId] = useState('scanner-web-01');
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastRaw, setLastRaw] = useState('');
  const [response, setResponse] = useState<ScanResponse | null>(null);
  const [cameraPaused, setCameraPaused] = useState(false);

  const tone = useMemo(() => getResultTone(response?.result), [response]);

  useEffect(() => {
    async function guardPage() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          router.replace('/login');
          return;
        }

        const res = await fetch('http://localhost:3001/auth/me', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!res.ok) {
          router.replace('/login');
          return;
        }

        const data = (await res.json()) as MeResponse;
        const allowedRoles: Role[] = ['STAFF', 'ORGANIZER', 'ADMIN'];

        if (!allowedRoles.includes(data.role)) {
          setAuthError('No tienes permisos para acceder al scanner.');
          setTimeout(() => router.replace('/dashboard'), 1200);
          return;
        }

        setMe(data);
      } catch {
        setAuthError('No se pudo validar tu acceso.');
        setTimeout(() => router.replace('/dashboard'), 1200);
      } finally {
        setBootLoading(false);
      }
    }

    guardPage();
  }, [router]);

async function submitValidation(qrToken: string, raw?: string) {
  if (!qrToken || loading) return;

  setLoading(true);
  setLastRaw(raw ?? qrToken);

  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setResponse({
        ok: false,
        result: 'INVALID',
        message: 'Tu sesión expiró. Inicia sesión de nuevo.',
      });
      return;
    }

    const requestNonce =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const res = await fetch('http://localhost:3001/scans/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        qrToken,
        gate,
        deviceId,
        requestNonce,
      }),
    });

    const data = (await res.json().catch(() => null)) as ScanResponse | null;

    if (!res.ok || !data) {
      setResponse({
        ok: false,
        result: 'INVALID',
        message: data?.message || 'No se pudo validar el boleto.',
      });
      return;
    }

    setResponse(data);
    setCameraPaused(true);
  } catch {
    setResponse({
      ok: false,
      result: 'INVALID',
      message: 'Ocurrió un error al validar el boleto.',
    });
  } finally {
    setLoading(false);
  }
}

function extractQrPayload(raw: string): { qrToken?: string; ticketId?: string } | null {
  if (!raw) return null;

  const trimmed = raw.trim();

  if (trimmed.split('.').length === 3) {
    return { qrToken: trimmed };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed?.ticketId && typeof parsed.ticketId === 'string') {
      return { ticketId: parsed.ticketId };
    }
  } catch {}

  const matchJsonLike = trimmed.match(/"ticketId"\s*:\s*"([^"]+)"/);
  if (matchJsonLike?.[1]) {
    return { ticketId: matchJsonLike[1] };
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (uuidRegex.test(trimmed)) {
    return { ticketId: trimmed };
  }

  return null;
}

async function handleManualSubmit(e: React.FormEvent) {
  e.preventDefault();

  const payload = extractQrPayload(manualCode);

  if (!payload) {
    setResponse({
      ok: false,
      result: 'INVALID',
      message: 'No se pudo interpretar el contenido ingresado.',
    });
    return;
  }

  if (payload.qrToken) {
    await submitValidation(payload.qrToken, manualCode);
    return;
  }

  if (payload.ticketId) {
    await submitValidation(payload.ticketId, manualCode);
    return;
  }

  setResponse({
    ok: false,
    result: 'INVALID',
    message: 'Contenido inválido.',
  });
}

  if (bootLoading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="guard-screen">
          <div className="guard-card">
            <div className="spinner" />
            <p>Validando permisos...</p>
          </div>
        </div>
      </>
    );
  }

  if (authError && !me) {
    return (
      <>
        <style>{CSS}</style>
        <div className="guard-screen">
          <div className="guard-card">
            <h2>Acceso restringido</h2>
            <p>{authError}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{CSS}</style>

      <div className="scanner-page">
        <nav className="topbar">
          <div className="topbar-inner">
            <Link href="/dashboard" className="back-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Dashboard
            </Link>

            <div className="topbar-title">
              Scanner staff · {me?.role}
            </div>
          </div>
        </nav>

        <main className="scanner-layout">
          <section className="scanner-panel">
            <div className="panel-head">
              <div>
                <h1>Check-in de boletos</h1>
                <p>Escanea un QR o pega el contenido manualmente para validar acceso.</p>
              </div>

              <button
                type="button"
                className="ghost-btn"
                onClick={() => setCameraPaused((v) => !v)}
              >
                {cameraPaused ? 'Reanudar cámara' : 'Pausar cámara'}
              </button>
            </div>

            <div className="scanner-grid">
              <div className="camera-card">
                <div className="camera-header">
                  <span className="camera-title">Cámara</span>
                  <span className={`camera-status ${cameraPaused ? 'paused' : 'live'}`}>
                    {cameraPaused ? 'Pausada' : 'Activa'}
                  </span>
                </div>

                <div className="camera-box">
                  {cameraPaused ? (
                    <div className="camera-placeholder">
                      <p>La cámara está en pausa.</p>
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => setCameraPaused(false)}
                      >
                        Reanudar escaneo
                      </button>
                    </div>
                  ) : (
                    <Scanner
                      constraints={{ facingMode: 'environment' }}
                       onScan={(detectedCodes) => {
                        const raw = detectedCodes?.[0]?.rawValue;
                        if (!raw || loading) return;

                        const payload = extractQrPayload(raw);

                        if (!payload) {
                            setResponse({
                            ok: false,
                            result: 'INVALID',
                            message: 'El QR no contiene un payload válido.',
                            });
                            setLastRaw(raw);
                            setCameraPaused(true);
                            return;
                        }

                        if (payload.qrToken) {
                            submitValidation(payload.qrToken, raw);
                            return;
                        }

                        if (payload.ticketId) {
                            submitValidation(payload.ticketId, raw);
                            return;
                        }

                        setResponse({
                            ok: false,
                            result: 'INVALID',
                            message: 'No se pudo interpretar el QR.',
                        });
                        setLastRaw(raw);
                        setCameraPaused(true);
                        }}
                      onError={() => {
                        setResponse({
                          ok: false,
                          result: 'INVALID',
                          message: 'No se pudo acceder a la cámara o leer el QR.',
                        });
                      }}
                    />
                  )}
                </div>

                <p className="helper-text">
                  Usa preferentemente la cámara trasera del teléfono o una webcam enfocada al QR.
                </p>
              </div>

              <div className="side-panel">
                <div className="config-card">
                  <h2>Configuración</h2>

                  <label className="field">
                    <span>Gate</span>
                    <input value={gate} onChange={(e) => setGate(e.target.value)} placeholder="Ej. Acceso A" />
                  </label>

                  <label className="field">
                    <span>Device ID</span>
                    <input
                      value={deviceId}
                      onChange={(e) => setDeviceId(e.target.value)}
                      placeholder="scanner-web-01"
                    />
                  </label>
                </div>

                <form className="manual-card" onSubmit={handleManualSubmit}>
                  <h2>Validación manual</h2>
                    <p>Pega el token del QR, el JSON legado o el UUID del boleto.</p>
                  <textarea
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder='{"ticketId":"f0d3d97f-a67d-4dce-a3b2-6a45e08a2904"}'
                  />

                  <button type="submit" className="primary-btn" disabled={loading}>
                    {loading ? 'Validando...' : 'Validar boleto'}
                  </button>
                </form>
              </div>
            </div>
          </section>

          <aside className="result-panel">
            <div
              className="result-card"
              style={{
                background: tone.bg,
                borderColor: tone.border,
              }}
            >
              <div className="result-kicker" style={{ color: tone.text }}>
                {tone.title}
              </div>

              <h2>{response?.message ?? 'Esperando el próximo escaneo'}</h2>

              <p className="result-subtext">
                {response?.result
                  ? `Resultado: ${response.result}`
                  : 'Cuando se valide un boleto, el resultado aparecerá aquí.'}
              </p>

              {lastRaw ? (
                <div className="raw-box">
                  <span>Último contenido leído</span>
                  <code>{lastRaw}</code>
                </div>
              ) : null}

              {response?.ticket ? (
                <div className="ticket-info">
                  <div className="info-row">
                    <span>Boleto</span>
                    <strong>#{response.ticket.id.slice(0, 8).toUpperCase()}</strong>
                  </div>

                  <div className="info-row">
                    <span>Estado</span>
                    <strong>{response.ticket.status}</strong>
                  </div>

                  <div className="info-row">
                    <span>Titular</span>
                    <strong>{response.ticket.owner?.fullName ?? '—'}</strong>
                  </div>

                  <div className="info-row">
                    <span>Email</span>
                    <strong>{response.ticket.owner?.email ?? '—'}</strong>
                  </div>

                  <div className="info-row">
                    <span>Evento</span>
                    <strong>{response.ticket.event?.title ?? '—'}</strong>
                  </div>

                  <div className="info-row">
                    <span>Recinto</span>
                    <strong>{response.ticket.event?.venueName ?? '—'}</strong>
                  </div>

                  <div className="info-row">
                    <span>Ciudad</span>
                    <strong>{response.ticket.event?.venueCity ?? '—'}</strong>
                  </div>

                  {response.ticket.usedAt ? (
                    <div className="info-row">
                      <span>Usado en</span>
                      <strong>
                        {new Date(response.ticket.usedAt).toLocaleString('es-MX')}
                      </strong>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </aside>
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
  --soft:#191922;
  --border:#262631;
  --text:#f5f7fb;
  --muted:#9da3af;
  --purple:#7c3aed;
  --purple-2:#9333ea;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,sans-serif}
a{text-decoration:none;color:inherit}
button,input,textarea{font:inherit}
.guard-screen{
  min-height:100vh;
  display:grid;
  place-items:center;
  background:
    radial-gradient(circle at top, rgba(124,58,237,.14), transparent 30%),
    linear-gradient(180deg, #050507 0%, #09090d 100%);
}
.guard-card{
  width:min(92vw,420px);
  padding:28px;
  border-radius:24px;
  text-align:center;
  background:linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.015));
  border:1px solid rgba(255,255,255,.08);
}
.guard-card h2{margin:0 0 10px;font-size:28px}
.guard-card p{margin:0;color:var(--muted)}
.spinner{
  width:42px;height:42px;margin:0 auto 16px;border-radius:999px;
  border:3px solid rgba(255,255,255,.08);border-top-color:var(--purple);
  animation:spin .8s linear infinite;
}
@keyframes spin{to{transform:rotate(360deg)}}
.scanner-page{
  min-height:100vh;
  background:
    radial-gradient(circle at top, rgba(124,58,237,.14), transparent 30%),
    linear-gradient(180deg, #050507 0%, #09090d 100%);
}
.topbar{
  position:sticky;top:0;z-index:20;border-bottom:1px solid rgba(255,255,255,.05);
  backdrop-filter:blur(18px);background:rgba(5,5,7,.72);
}
.topbar-inner{
  max-width:1280px;margin:0 auto;padding:18px 20px;display:flex;justify-content:space-between;align-items:center;
}
.back-link{display:inline-flex;align-items:center;gap:8px;font-size:14px;color:var(--muted)}
.back-link:hover{color:#fff}
.topbar-title{font-size:14px;color:#d4d4d8;font-weight:700}
.scanner-layout{
  max-width:1280px;margin:0 auto;padding:28px 20px 64px;display:grid;
  grid-template-columns:minmax(0,1.35fr) minmax(320px,.8fr);gap:24px;
}
.scanner-panel,.result-panel{min-width:0}
.panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px}
.panel-head h1{margin:0;font-size:40px;line-height:1;letter-spacing:-.04em}
.panel-head p{margin:10px 0 0;color:var(--muted);font-size:15px}
.ghost-btn,.primary-btn{
  min-height:44px;border-radius:14px;padding:0 16px;border:1px solid rgba(255,255,255,.08);cursor:pointer;transition:.2s ease;
}
.ghost-btn{background:rgba(255,255,255,.03);color:#fff}
.ghost-btn:hover{background:rgba(255,255,255,.06)}
.primary-btn{background:linear-gradient(135deg, var(--purple), var(--purple-2));color:#fff;border:none;font-weight:700}
.primary-btn:hover{filter:brightness(1.06)}
.primary-btn:disabled{opacity:.65;cursor:not-allowed}
.scanner-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:20px}
.camera-card,.config-card,.manual-card,.result-card{
  background:linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.015));
  border:1px solid var(--border);border-radius:24px;box-shadow:0 16px 42px rgba(0,0,0,.28);
}
.camera-card{padding:16px}
.config-card,.manual-card,.result-card{padding:18px}
.camera-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.camera-title{font-size:14px;font-weight:700}
.camera-status{
  font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;border-radius:999px;padding:8px 10px;border:1px solid rgba(255,255,255,.08);
}
.camera-status.live{color:#86efac;background:rgba(34,197,94,.10)}
.camera-status.paused{color:#fcd34d;background:rgba(251,191,36,.10)}
.camera-box{
  overflow:hidden;border-radius:20px;background:#0b0b10;border:1px solid rgba(255,255,255,.05);
  min-height:420px;display:flex;align-items:center;justify-content:center;
}
.camera-box video{width:100%;height:100%;object-fit:cover}
.camera-placeholder{
  min-height:420px;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:var(--muted);
}
.helper-text{margin:12px 4px 0;font-size:13px;color:var(--muted)}
.side-panel{display:grid;gap:20px}
.config-card h2,.manual-card h2,.result-card h2{margin:0;font-size:20px;letter-spacing:-.03em}
.manual-card p{margin:8px 0 0;color:var(--muted);font-size:14px}
.field{display:grid;gap:8px;margin-top:14px}
.field span,.raw-box span{
  font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#a1a1aa;font-weight:700;
}
.field input,.manual-card textarea{
  width:100%;border:none;outline:none;border-radius:14px;background:#0d0d12;color:#fff;border:1px solid rgba(255,255,255,.07);padding:14px 15px;
}
.manual-card textarea{min-height:140px;resize:vertical;margin:14px 0 16px}
.result-card{position:sticky;top:92px}
.result-kicker{font-size:12px;text-transform:uppercase;letter-spacing:.1em;font-weight:800;margin-bottom:10px}
.result-subtext{color:var(--muted);font-size:14px;margin:8px 0 0}
.raw-box{
  margin-top:18px;padding:14px;border-radius:16px;background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.06);
}
.raw-box code{
  display:block;margin-top:10px;white-space:pre-wrap;word-break:break-word;color:#e9d5ff;font-size:13px;
}
.ticket-info{margin-top:18px;display:grid;gap:12px}
.info-row{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;font-size:14px}
.info-row span{color:var(--muted)}
.info-row strong{text-align:right;color:#fff}
@media (max-width:1080px){
  .scanner-layout{grid-template-columns:1fr}
  .result-card{position:relative;top:auto}
}
@media (max-width:860px){
  .scanner-grid{grid-template-columns:1fr}
}
@media (max-width:640px){
  .topbar-inner,.scanner-layout{padding-left:16px;padding-right:16px}
  .panel-head{flex-direction:column;align-items:stretch}
  .panel-head h1{font-size:32px}
  .camera-box,.camera-placeholder{min-height:320px}
}
`;