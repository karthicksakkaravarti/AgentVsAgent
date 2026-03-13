import { SessionState, SessionMetrics, RequestLogEntry } from '../types';

export class SessionManager {
  private sessions = new Map<string, SessionState>();

  createSession(sessionId: string, totalSteps: number): SessionState {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session already exists: ${sessionId}`);
    }

    const session: SessionState = {
      sessionId,
      currentStep: 0,
      totalSteps,
      startedAt: Date.now(),
      requestLog: [],
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  getOrCreateSession(sessionId: string, totalSteps: number): SessionState {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;
    return this.createSession(sessionId, totalSteps);
  }

  advanceStep(sessionId: string, logEntry: RequestLogEntry): number {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.requestLog.push(logEntry);
    session.currentStep++;

    if (session.currentStep >= session.totalSteps) {
      session.completedAt = Date.now();
    }

    return session.currentStep;
  }

  getMetrics(sessionId: string): SessionMetrics | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const totalApiWaitMs = session.requestLog.reduce(
      (sum, entry) => sum + entry.configuredDelayMs,
      0
    );

    return {
      sessionId: session.sessionId,
      totalSteps: session.totalSteps,
      stepsCompleted: session.currentStep,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      totalApiWaitMs,
      requestLog: session.requestLog,
    };
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }
}
