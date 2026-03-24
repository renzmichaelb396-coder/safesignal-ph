import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'safesignal-ph-secret-key-2024';

export interface CitizenPayload {
  type: 'citizen';
  id: number;
  phone: string;
}

export interface OfficerPayload {
  type: 'officer';
  id: number;
  email: string;
  role: string;
  badge_number: string;
}

export function signCitizenToken(payload: Omit<CitizenPayload, 'type'>): string {
  return jwt.sign({ type: 'citizen', ...payload }, JWT_SECRET, { expiresIn: '7d' });
}

export function signOfficerToken(payload: Omit<OfficerPayload, 'type'>): string {
  return jwt.sign({ type: 'officer', ...payload }, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): CitizenPayload | OfficerPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as CitizenPayload | OfficerPayload;
  } catch {
    return null;
  }
}

// Extracts token from Authorization header OR query string (for SSE EventSource)
function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  // Fallback: query string token for SSE (EventSource can't set headers)
  if (req.query?.token && typeof req.query.token === 'string') {
    return req.query.token;
  }
  return null;
}

export function requireCitizenAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'citizen') {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  (req as any).citizen = payload;
  next();
}

export function requireOfficerAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'officer') {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  (req as any).officer = payload;
  next();
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'officer') {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  if ((payload as OfficerPayload).role !== 'STATION_ADMIN') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  (req as any).officer = payload;
  next();
}
