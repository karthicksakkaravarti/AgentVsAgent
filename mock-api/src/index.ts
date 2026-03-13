import express from 'express';
import { loadConfig } from './config';
import { loadTranscript } from './transcript/loader';
import { SessionManager } from './transcript/session-manager';
import { createChatCompletionsRouter } from './routes/chat-completions';

const config = loadConfig();
const app = express();
const sessionManager = new SessionManager();

// Middleware
app.use(express.json({ limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  if (config.logLevel === 'debug') {
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', sessions: sessionManager.listSessions().length });
});

// Load transcript and set up routes
let transcript;
try {
  transcript = loadTranscript(config.transcriptPath);
} catch (err) {
  console.error('Failed to load transcript:', err);
  process.exit(1);
}

// Chat completions endpoint
app.use(
  '/v1/chat/completions',
  createChatCompletionsRouter(transcript, sessionManager, config)
);

// Session management endpoints
app.post('/v1/sessions', (req, res) => {
  const sessionId = req.body.sessionId ?? `session-${Date.now()}`;
  try {
    const session = sessionManager.createSession(sessionId, transcript!.steps.length);
    res.json({ sessionId: session.sessionId, totalSteps: session.totalSteps });
  } catch (err: any) {
    res.status(409).json({ error: err.message });
  }
});

app.get('/v1/sessions/:id/metrics', (req, res) => {
  const metrics = sessionManager.getMetrics(req.params.id);
  if (!metrics) {
    res.status(404).json({ error: `Session not found: ${req.params.id}` });
    return;
  }
  res.json(metrics);
});

app.delete('/v1/sessions/:id', (req, res) => {
  const deleted = sessionManager.deleteSession(req.params.id);
  res.json({ deleted });
});

// Start server
app.listen(config.port, () => {
  console.log(`Mock API server running on http://localhost:${config.port}`);
  console.log(`  Response delay: ${config.responseDelayMs}ms`);
  console.log(`  Transcript: ${transcript!.steps.length} steps`);
  console.log(`  Log level: ${config.logLevel}`);
  console.log('');
  console.log('Endpoints:');
  console.log('  POST /v1/chat/completions  - Main chat completions (OpenAI-compatible)');
  console.log('  POST /v1/sessions          - Create a new session');
  console.log('  GET  /v1/sessions/:id/metrics - Get session timing metrics');
  console.log('  DELETE /v1/sessions/:id     - Delete a session');
  console.log('  GET  /health               - Health check');
});
