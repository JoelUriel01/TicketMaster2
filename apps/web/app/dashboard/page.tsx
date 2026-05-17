'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
  };
};

type AppUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);



    useEffect(() => {
    async function debugToken() {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔑 ACCESS TOKEN:', session?.access_token);
    }

    debugToken();
  }, []);
  
  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/login');
        return;
      }

      setAuthUser(user as AuthUser);

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setErrorMessage('Tu usuario existe en Auth, pero aún no tiene perfil en public.users.');
        setLoading(false);
        return;
      }

      setAppUser(data as AppUser);
      setFullName(data.fullName);
      setLoading(false);
    }

    loadData();
  }, [router, supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  async function handleUpdateProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!authUser) return;

    if (!fullName.trim()) {
      setErrorMessage('El nombre no puede estar vacío.');
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from('users')
      .update({
        fullName: fullName.trim(),
        updatedAt: new Date().toISOString(),
      })
      .eq('id', authUser.id)
      .select()
      .single();

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setAppUser(data as AppUser);
    setSuccessMessage('Perfil actualizado correctamente.');
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/5 p-8">
          <p className="text-white/70">Cargando sesión...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl">
        <p className="mb-2 text-sm text-cyan-400">Dashboard</p>
        <h1 className="text-3xl font-semibold">
          Bienvenido {appUser?.fullName ?? authUser?.user_metadata?.full_name ?? 'usuario'}
        </h1>

        {errorMessage ? (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {successMessage}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 rounded-xl border border-white/10 bg-black/20 p-5 text-sm text-white/80">
          <p>
            <span className="font-medium text-white">Auth ID:</span> {authUser?.id}
          </p>
          <p>
            <span className="font-medium text-white">Auth email:</span> {authUser?.email}
          </p>
          <p>
            <span className="font-medium text-white">Nombre en app:</span> {appUser?.fullName}
          </p>
          <p>
            <span className="font-medium text-white">Rol:</span> {appUser?.role}
          </p>
          <p>
            <span className="font-medium text-white">Email verificado en tabla:</span>{' '}
            {appUser?.emailVerified ? 'Sí' : 'No'}
          </p>
          <p>
            <span className="font-medium text-white">Teléfono verificado:</span>{' '}
            {appUser?.phoneVerified ? 'Sí' : 'No'}
          </p>
          <p>
            <span className="font-medium text-white">MFA activado:</span>{' '}
            {appUser?.mfaEnabled ? 'Sí' : 'No'}
          </p>
        </div>

        <form onSubmit={handleUpdateProfile} className="mt-6 space-y-4 rounded-xl border border-white/10 bg-black/20 p-5">
          <div>
            <label htmlFor="fullName" className="mb-2 block text-sm font-medium text-white">
              Editar nombre completo
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
              placeholder="Tu nombre completo"
              required
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-cyan-400 px-4 py-3 font-medium text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>

        

        <button
          onClick={handleLogout}
          className="mt-6 rounded-xl bg-red-500 px-4 py-3 font-medium text-white transition hover:bg-red-400"
        >
          Cerrar sesión
        </button>

        
      </div>


    </main>
  );
}