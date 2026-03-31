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
