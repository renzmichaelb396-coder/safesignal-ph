import { Request, Response } from 'express';

interface SSEClient {
  id: string;
  res: Response;
}

const clients: Map<string, SSEClient> = new Map();

export function addSSEClient(req: Request, res: Response): string {
  const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`);

  clients.set(clientId, { id: clientId, res });

  req.on('close', () => {
    clients.delete(clientId);
  });

  req.on('error', () => {
    clients.delete(clientId);
  });

  // Heartbeat every 30s
  const heartbeat = setInterval(() => {
    try {
      res.write(`:heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
      clients.delete(clientId);
    }
  }, 30000);

  req.on('close', () => clearInterval(heartbeat));

  return clientId;
}

export function broadcastEvent(eventType: string, data: unknown): void {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  const deadClients: string[] = [];

  for (const [id, client] of Array.from(clients.entries())) {
    try {
      client.res.write(payload);
    } catch {
      deadClients.push(id);
    }
  }

  for (const id of deadClients) {
    clients.delete(id);
  }
}

export function getClientCount(): number {
  return clients.size;
}
