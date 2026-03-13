import { Router, Request, Response } from 'express';
import { GoldenTranscript, ChatCompletionRequest, RequestLogEntry } from '../types';
import { SessionManager } from '../transcript/session-manager';
import { MockApiConfig } from '../config';

export function createChatCompletionsRouter(
  transcript: GoldenTranscript,
  sessionManager: SessionManager,
  config: MockApiConfig
): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    const requestReceivedAt = Date.now();

    // Extract session ID from Authorization header or X-Session-Id
    const authHeader = req.headers.authorization;
    const sessionIdHeader = req.headers['x-session-id'] as string | undefined;
    const sessionId = sessionIdHeader ?? authHeader?.replace('Bearer ', '') ?? 'default';

    // Get or create session
    const session = sessionManager.getOrCreateSession(sessionId, transcript.steps.length);

    // Check if session is complete
    if (session.currentStep >= transcript.steps.length) {
      res.status(400).json({
        error: {
          message: `Session ${sessionId} has completed all ${transcript.steps.length} steps`,
          type: 'session_complete',
        },
      });
      return;
    }

    // Get the current step's response
    const step = transcript.steps[session.currentStep];

    if (config.logLevel === 'debug') {
      console.log(`[${sessionId}] Step ${step.stepNumber}/${transcript.steps.length}: ${step.description ?? 'no description'}`);
    }

    // Wait the configured delay
    await sleep(config.responseDelayMs);

    // Log the request
    const responseSentAt = Date.now();
    const logEntry: RequestLogEntry = {
      step: step.stepNumber,
      requestReceivedAt,
      responseSentAt,
      configuredDelayMs: config.responseDelayMs,
    };

    // Advance the session
    sessionManager.advanceStep(sessionId, logEntry);

    // Return the transcript response
    const response = {
      ...step.response,
      id: `chatcmpl-mock-${sessionId}-step-${step.stepNumber}`,
      created: Math.floor(Date.now() / 1000),
    };

    res.json(response);
  });

  return router;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
