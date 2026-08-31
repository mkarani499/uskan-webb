import jwt from 'jsonwebtoken';
import { parse, serialize } from 'cookie';
import { randomUUID } from 'crypto';

const SECRET = process.env.SESSION_SECRET;
const SESSION_COOKIE = 'uskan_session';
const VISITOR_COOKIE = 'uskan_visitor';

// ===== Logged-in / admin session =====
export function createSessionCookie({ userId, isAdmin }) {
  const token = jwt.sign({ userId: userId || null, isAdmin: !!isAdmin }, SECRET, { expiresIn: '7d' });
  return serialize(SESSION_COOKIE, token, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie() {
  return serialize(SESSION_COOKIE, '', {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0,
  });
}

export function getSession(req) {
  const cookies = parse(req.headers.cookie || '');
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  try { return jwt.verify(token, SECRET); } catch { return null; }
}

// ===== Anonymous visitor token (pre-login test/payment tracking) =====
export function getVisitorToken(req) {
  const cookies = parse(req.headers.cookie || '');
  return cookies[VISITOR_COOKIE] || null;
}

export function ensureVisitorToken(req) {
  const existing = getVisitorToken(req);
  if (existing) return { token: existing, cookieHeader: null };
  const token = randomUUID();
  const cookieHeader = serialize(VISITOR_COOKIE, token, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365,
  });
  return { token, cookieHeader };
}