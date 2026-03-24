import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // SSE not supported in serverless - return a meaningful error
  res.status(200).json({
    error: 'SSE not available in serverless mode',
    message: 'Dashboard should use polling or WebSocket for real-time updates',
    suggestion: 'Use /api/dispatch/alerts endpoint with polling (5-10 second intervals)',
  });
}
