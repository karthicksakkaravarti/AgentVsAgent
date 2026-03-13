import * as path from 'path';

export interface MockApiConfig {
  port: number;
  responseDelayMs: number;
  transcriptPath: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export function loadConfig(): MockApiConfig {
  return {
    port: parseInt(process.env.PORT ?? '8080', 10),
    responseDelayMs: parseInt(process.env.RESPONSE_DELAY_MS ?? '500', 10),
    transcriptPath: process.env.TRANSCRIPT_PATH ??
      path.join(__dirname, '..', '..', 'golden-transcript', 'transcript.json'),
    logLevel: (process.env.LOG_LEVEL as MockApiConfig['logLevel']) ?? 'info',
  };
}
