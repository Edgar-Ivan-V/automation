/**
 * FILE: src/modules/shared/supabase-client.ts
 *
 * Crea y expone el cliente de Supabase con la service role key,
 * que tiene acceso privilegiado ignorando las políticas RLS.
 * Se usa exclusivamente en el backend (nunca exponerlo al cliente).
 *
 * Exports:
 *   - createServiceSupabaseClient(): crea cliente o retorna null si
 *     falta configuración. Útil para el health check.
 *   - requireServiceSupabaseClient(): igual pero lanza error si no
 *     está configurado. Usado en todos los repositorios.
 *   - assertNoError(error): lanza Error si Supabase devuelve un error
 *     en una query, evitando manejo repetido en cada repositorio.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createServiceSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function requireServiceSupabaseClient() {
  const client = createServiceSupabaseClient();

  if (!client) {
    throw new Error("Supabase service client is required.");
  }

  return client;
}

export function assertNoError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}
