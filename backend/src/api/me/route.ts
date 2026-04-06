/**
 * FILE: src/api/me/route.ts
 *
 * Handlers de autenticación y resolución de usuario/organización.
 * Es el módulo central de auth que todos los demás endpoints usan
 * para identificar quién hace cada request.
 *
 * Flujo de autenticación:
 *   1. El cliente envía Authorization: Bearer <token> (JWT de Supabase)
 *   2. getCurrentUser() verifica el token con Supabase Auth y carga
 *      el perfil del usuario + sus membresías de organización
 *   3. Si DEV_BYPASS_AUTH=true, se salta el JWT y devuelve el primer
 *      usuario de la BD (modo desarrollo local)
 *
 * resolveOrganizationId():
 *   Determina la organización activa del request en este orden:
 *   1. Header X-Organization-Id o query param org_id (explícito)
 *   2. profile.active_organization_id del usuario
 *   3. profile.default_organization_id
 *   4. Primera membresía del usuario
 *   5. Error 400 si no se puede resolver
 *
 * Exports:
 *   - requireBearerToken: extrae el token del header Authorization
 *   - getCurrentUser: verifica JWT y retorna user + profile + memberships
 *   - resolveOrganizationId: determina la org activa del request
 */

import { requireServiceSupabaseClient } from "../../modules/shared/supabase-client.js";
import { ValidationError, UnauthorizedError } from "../../modules/shared/errors.js";

type MembershipRow = {
  role: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  } | null;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
  active_organization_id: string | null;
  default_organization_id: string | null;
  created_at: string;
  updated_at: string;
} | null;

export function requireBearerToken(authorizationHeader: string | undefined) {
  if (!authorizationHeader) {
    throw new UnauthorizedError("Missing Authorization header.");
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new UnauthorizedError("Authorization header must use Bearer token.");
  }

  return token;
}

export async function getCurrentUser(authorizationHeader: string | undefined) {
  if (!authorizationHeader && isDevAuthBypassEnabled()) {
    return getDevBypassUser();
  }

  const token = requireBearerToken(authorizationHeader);
  const client = requireServiceSupabaseClient();
  const { data: authData, error: authError } = await client.auth.getUser(token);

  if (authError || !authData.user) {
    if (isDevAuthBypassEnabled()) {
      return getDevBypassUser();
    }
    throw new UnauthorizedError(authError?.message ?? "Invalid or expired access token.");
  }

  const { profile, memberships } = await loadProfileAndMemberships(client, authData.user.id);

  return {
    user: authData.user,
    profile,
    memberships,
  };
}

export async function resolveOrganizationId(authorizationHeader: string | undefined, explicitOrganizationId: string | undefined) {
  if (explicitOrganizationId) {
    return explicitOrganizationId;
  }

  const currentUser = await getCurrentUser(authorizationHeader);
  const profileOrgId = currentUser.profile?.active_organization_id ?? currentUser.profile?.default_organization_id;

  if (profileOrgId) {
    return profileOrgId;
  }

  const membershipOrgId = currentUser.memberships.find((membership) => membership.organization?.id)?.organization?.id;

  if (membershipOrgId) {
    return membershipOrgId;
  }

  throw new ValidationError("Missing organization ID and no active organization could be resolved for the current user.");
}

async function getDevBypassUser() {
  const client = requireServiceSupabaseClient();
  const configuredUserId = process.env.DEV_BYPASS_USER_ID;
  const profileQuery = client
    .from("users")
    .select("id, email, full_name, role, avatar_url, active_organization_id, default_organization_id, created_at, updated_at")
    .order("created_at", { ascending: true })
    .limit(1);

  const { data: profileData, error: profileError } = configuredUserId
    ? await profileQuery.eq("id", configuredUserId).maybeSingle()
    : await profileQuery.maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profileData) {
    throw new UnauthorizedError("DEV_BYPASS_AUTH is enabled but no user record was found in public.users.");
  }

  const { memberships } = await loadProfileAndMemberships(client, profileData.id);

  return {
    user: {
      id: profileData.id,
      email: profileData.email,
      aud: "authenticated",
      role: "authenticated",
      app_metadata: { provider: "dev-bypass" },
      user_metadata: { full_name: profileData.full_name },
    },
    profile: profileData,
    memberships,
    devBypass: true,
  };
}

async function loadProfileAndMemberships(client: ReturnType<typeof requireServiceSupabaseClient>, userId: string) {
  const [{ data: profile, error: profileError }, { data: memberships, error: membershipsError }] = await Promise.all([
    client
      .from("users")
      .select("id, email, full_name, role, avatar_url, active_organization_id, default_organization_id, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle(),
    client
      .from("org_members")
      .select("role, organization:organizations(id, name, slug, plan)")
      .eq("user_id", userId),
  ]);

  if (profileError) {
    throw profileError;
  }

  if (membershipsError) {
    throw membershipsError;
  }

  return {
    profile: profile as ProfileRow,
    memberships: normalizeMemberships(memberships),
  };
}

function isDevAuthBypassEnabled() {
  return process.env.DEV_BYPASS_AUTH === "true";
}

function normalizeMemberships(rows: Array<{ role: string; organization: MembershipRow["organization"] | MembershipRow["organization"][] }> | null): MembershipRow[] {
  return (rows ?? []).map((row) => ({
    role: row.role,
    organization: Array.isArray(row.organization) ? row.organization[0] ?? null : row.organization ?? null,
  }));
}
