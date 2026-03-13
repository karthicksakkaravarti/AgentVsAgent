/**
 * HTTP client for the Mock API server.
 * Uses native Node.js http module — no external dependencies.
 */

import * as http from 'http';
import * as https from 'https';
import { Message } from './state';

export interface ChatCompletionPayload {
  model: string;
  messages: Message[];
  tools: unknown[];
}

export async function sendChatCompletion(
  apiUrl: string,
  sessionId: string,
  payload: ChatCompletionPayload
): Promise<string> {
  const url = new URL('/v1/chat/completions', apiUrl);
  const body = JSON.stringify(payload);
  const isHttps = url.protocol === 'https:';

  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${sessionId}`,
        'X-Session-Id': sessionId,
      },
    };

    const req = (isHttps ? https : http).request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const responseBody = Buffer.concat(chunks).toString('utf-8');
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`API returned ${res.statusCode}: ${responseBody}`));
        } else {
          resolve(responseBody);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
