import * as fs from 'fs';
import { GoldenTranscript } from '../types';

export function loadTranscript(filePath: string): GoldenTranscript {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Transcript file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const transcript: GoldenTranscript = JSON.parse(raw);

  // Basic validation
  if (!transcript.version) throw new Error('Transcript missing version');
  if (!transcript.steps || !Array.isArray(transcript.steps)) {
    throw new Error('Transcript missing steps array');
  }
  if (transcript.steps.length === 0) {
    throw new Error('Transcript has no steps');
  }

  // Verify steps are in order
  for (let i = 0; i < transcript.steps.length; i++) {
    if (transcript.steps[i].stepNumber !== i + 1) {
      throw new Error(`Step ${i} has wrong stepNumber: expected ${i + 1}, got ${transcript.steps[i].stepNumber}`);
    }
  }

  console.log(`Loaded transcript: ${transcript.description}`);
  console.log(`  Version: ${transcript.version}`);
  console.log(`  Steps: ${transcript.steps.length}`);

  return transcript;
}
