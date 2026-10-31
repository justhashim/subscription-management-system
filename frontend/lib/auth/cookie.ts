import type { Role } from "@/types/api";

export const SESSION_COOKIE = "orbit_session";

export interface Session {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export function encodeSession(session: Session) {
  return encodeURIComponent(JSON.stringify(session));
}

export function decodeSession(value?: string | null): Session | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Session;

    if (!parsed.id || !parsed.email || !parsed.role) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
