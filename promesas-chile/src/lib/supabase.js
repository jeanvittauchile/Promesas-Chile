/* ============================================================
   supabase.js — cliente Supabase (singleton)
   Lee credenciales de variables de entorno (Vite).
   ============================================================ */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(url && anonKey);

if (!hasSupabaseConfig) {
  // No detenemos la app: funciona en modo local/offline si faltan las llaves.
  console.warn(
    '[Promesas Chile] Falta VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
    'La app correrá en modo local (sin sincronización en la nube). ' +
    'Copia .env.example a .env.local y completa tus credenciales.'
  );
}

export const supabase = hasSupabaseConfig
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
