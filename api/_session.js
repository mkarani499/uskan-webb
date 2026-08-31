import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const SECRET = process.env.SESSION_SECRET;
const SESSION_COOKIE = 'uskan_session';
const VISITOR_COOKIE = 'uskan_visitor';

// ===== Minimal cookie helpers (no external package) =====
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    out[key] = decodeURIComponent(value);
  });
  return out;
}

function serializeCookie(name, value, { maxAge } = {}) {
  let str = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax`;
  if (maxAge !== undefined) str += `; Max-Age=${maxAge}`;
  return str;
}

// ===== Logged-in / admin session =====
export function createSessionCookie({ userId, isAdmin }) {
  const token = jwt.sign({ userId: userId || null, isAdmin: !!isAdmin }, SECRET, { expiresIn: '7d' });
  return serializeCookie(SESSION_COOKIE, token, { maxAge: 60 * 60 * 24 * 7 });
}

export function clearSessionCookie() {
  return serializeCookie(SESSION_COOKIE, '', { maxAge: 0 });
}

export function getSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  try { return jwt.verify(token, SECRET); } catch { return null; }
}

// ===== Anonymous visitor token (pre-login test/payment tracking) =====
export function getVisitorToken(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[VISITOR_COOKIE] || null;
}

export function ensureVisitorToken(req) {
  const existing = getVisitorToken(req);
  if (existing) return { token: existing, cookieHeader: null };
  const token = randomUUID();
  const cookieHeader = serializeCookie(VISITOR_COOKIE, token, { maxAge: 60 * 60 * 24 * 365 });
  return { token, cookieHeader };
}