import {
  SESSION_COOKIE,
  decodeSession,
  encodeSession,
  type Session,
} from "./cookie";

export function getClientSession(): Session | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${SESSION_COOKIE}=`));

  if (!cookie) {
    return null;
  }

  const value = cookie.slice(SESSION_COOKIE.length + 1);
  return decodeSession(value);
}

export function setClientSession(session: Session) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${SESSION_COOKIE}=${encodeSession(session)}; path=/; max-age=604800; samesite=lax`;
}

export function clearClientSession() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
