import { Express } from 'express';
import express from 'express';
import citizenRoutes from './citizenRoutes';
import dispatchRoutes from './dispatchRoutes';
import officerRoutes from './officerRoutes';
import { addSSEClient } from './sse';
import { requireOfficerAuth } from './auth';

export function registerSafeSignalRoutes(app: Express): void {
  app.use(express.json({ limit: '10mb' }));

  // Citizen routes
  app.use('/api/citizen', citizenRoutes);

  // Dispatch routes
  app.use('/api/dispatch', dispatchRoutes);

  // Officer routes
  app.use('/api/officer', officerRoutes);

  // SSE endpoint - auth module now supports query-string token for EventSource
  app.get('/api/events', requireOfficerAuth, (req, res) => {
    addSSEClient(req, res);
  });
}import { Express } from 'express';
import express from 'express';
import citizenRoutes from './citizenRoutes';
import dispatchRoutes from './dispatchRoutes';
import { addSSEClient } from './sse';
import { requireOfficerAuth } from './auth';

export function registerSafeSignalRoutes(app: Express): void {
  app.use(express.json({ limit: '10mb' }));

  // Citizen routes
  app.use('/api/citizen', citizenRoutes);

  // Dispatch routes
  app.use('/api/dispatch', dispatchRoutes);

  // SSE endpoint - auth module now supports query-string token for EventSource
  app.get('/api/events', requireOfficerAuth, (req, res) => {
    addSSEClient(req, res);
  });
}
