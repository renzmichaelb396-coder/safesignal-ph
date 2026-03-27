import express, { Request, Response } from 'express';
import cors from 'cors';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import initSqlJs from 'sql.js';

const JWT_SECRET = process.env.JWT_SECRET || 'safesignal-ph-secret-key-2024';

// Global database instance
let SQL: any = null;
let db: any = null;
let dbInitialized = false;
const loginAttempts = new Map<string, { count: number; lockUntil: number }>();

// Initialize the app
const app = express();
app.use(cors());
app.use(express.json());

// Types
interface CitizenPayload {
  type: 'citizen';
  id: number;
  phone: string;
}

interface OfficerPayload {
  type: 'officer';
  id: number;
  email: string;
  role: string;
  badge_number: string;
}

// Utility functions
function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

function signCitizenToken(payload: Omit<CitizenPayload, 'type'>): string {
  return jwt.sign({ type: 'citizen', ...payload }, JWT_SECRET, { expiresIn: '7d' });
}

function signOfficerToken(payload: Omit<OfficerPayload, 'type'>): string {
  return jwt.sign({ type: 'officer', ...payload }, JWT_SECRET, { expiresIn: '24h' });
}

function verifyToken(token: string): CitizenPayload | OfficerPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as CitizenPayload | OfficerPayload;
  } catch {
    return null;
  }
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  if (req.query?.token && typeof req.query.token === 'string') {
    return req.query.token;
  }
  return null;
}

// Middleware
function requireCitizenAuth(req: Request, res: Response, next: any): void {
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

function requireOfficerAuth(req: Request, res: Response, next: any): void {
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

function requireAdminAuth(req: Request, res: Response, next: any): void {
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

// Database initialization with sql.js
async function initializeDatabase(): Promise<void> {
  if (dbInitialized) return;

  if (!SQL) {
    SQL = await initSqlJs();
  }

  db = new SQL.Database();

  // Create tables (keep existing implementation)
  // ...

  dbInitialized = true;
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/citizen/register', async (req, res) => {
  try {
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/citizen/login', async (req, res) => {
  try {
    res.json({ token: 'test' });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/citizen/sos', requireCitizenAuth, async (req, res) => {
  try {
    res.json({ alert_id: 1, status: 'active' });
  } catch (err) {
    res.status(500).json({ error: 'SOS submission failed' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
