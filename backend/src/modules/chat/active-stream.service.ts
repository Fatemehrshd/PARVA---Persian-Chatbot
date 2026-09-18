import { Injectable, Logger } from '@nestjs/common';

export type StreamStatus = 'thinking' | 'streaming' | 'completed' | 'error';

export type StreamEvent =
  | { type: 'token'; content: string }
  | { type: 'sync'; content: string }
  | { type: 'title'; title: string }
  | { type: 'done'; messageId: string }
  | { type: 'error'; message: string }
  | { type: 'sources'; sources: { title: string; url: string; snippet?: string }[] };

export interface ActiveStreamSession {
  conversationId: string;
  userId: string;
  userPrompt: string;
  accumulatedText: string;
  chunks: string[];
  status: StreamStatus;
  error?: string;
  savedMessageId?: string;
  title?: string;
  sources?: { title: string; url: string; snippet?: string }[];
  abortController: AbortController;
  subscribers: Set<(event: StreamEvent) => void>;
  startedAt: number;
  thinkingTimer?: any;
  cleanupTimer?: any;
}

export interface ActiveStreamStatus {
  active: boolean;
  status: StreamStatus;
  accumulatedText: string;
  title?: string;
  messageId?: string;
  sources?: { title: string; url: string; snippet?: string }[];
}

/**
 * Manages active LLM generation sessions in-memory, decoupled from HTTP client sockets.
 * If the user refreshes their browser or experiences a network drop, the generation
 * continues uninterrupted, allowing reconnecting clients to resume receiving tokens.
 */
@Injectable()
export class ActiveStreamService {
  private readonly logger = new Logger(ActiveStreamService.name);
  private readonly sessions = new Map<string, ActiveStreamSession>();

  /**
   * Starts or retrieves an active stream session for a conversation.
   */
  startSession(
    conversationId: string,
    userId: string,
    userPrompt: string,
  ): ActiveStreamSession {
    const existing = this.sessions.get(conversationId);
    if (existing && (existing.status === 'thinking' || existing.status === 'streaming')) {
      return existing;
    }

    if (existing?.cleanupTimer) {
      clearTimeout(existing.cleanupTimer);
    }
    if (existing?.thinkingTimer) {
      clearTimeout(existing.thinkingTimer);
    }

    const session: ActiveStreamSession = {
      conversationId,
      userId,
      userPrompt,
      accumulatedText: '',
      chunks: [],
      status: 'thinking',
      abortController: new AbortController(),
      subscribers: new Set(),
      startedAt: Date.now(),
    };

    session.thinkingTimer = setTimeout(() => {
      if (session.status === 'thinking' && !session.accumulatedText) {
        this.logger.warn(`Session ${conversationId} timed out in thinking state`);
        this.failSession(
          conversationId,
          'زمان انتظار برای پردازش پیام به پایان رسید (Timeout)',
        );
      }
    }, 35000);
    if (session.thinkingTimer && typeof session.thinkingTimer.unref === 'function') {
      session.thinkingTimer.unref();
    }

    this.sessions.set(conversationId, session);
    return session;
  }

  getSession(conversationId: string): ActiveStreamSession | undefined {
    return this.sessions.get(conversationId);
  }

  appendToken(conversationId: string, token: string): void {
    const session = this.sessions.get(conversationId);
    if (!session || session.status === 'completed' || session.status === 'error') return;

    if (session.thinkingTimer) {
      clearTimeout(session.thinkingTimer);
      session.thinkingTimer = undefined;
    }

    session.status = 'streaming';
    session.accumulatedText += token;
    session.chunks.push(token);

    const event: StreamEvent = { type: 'token', content: token };
    for (const sub of session.subscribers) {
      try {
        sub(event);
      } catch (err) {
        this.logger.warn(`Subscriber error on token emit: ${err}`);
      }
    }
  }

  setTitle(conversationId: string, title: string): void {
    const session = this.sessions.get(conversationId);
    if (!session) return;

    session.title = title;
    const event: StreamEvent = { type: 'title', title };
    for (const sub of session.subscribers) {
      try {
        sub(event);
      } catch (err) {
        this.logger.warn(`Subscriber error on title emit: ${err}`);
      }
    }
  }

  setSources(
    conversationId: string,
    sources: { title: string; url: string; snippet?: string }[],
  ): void {
    const session = this.sessions.get(conversationId);
    if (!session) return;
    session.sources = sources;
    this.resetThinkingTimer(conversationId);
    const event: StreamEvent = { type: 'sources', sources };
    for (const sub of session.subscribers) {
      try {
        sub(event);
      } catch (err) {
        this.logger.warn(`Subscriber error on sources emit: ${err}`);
      }
    }
  }

  /** Re-arms the 35s thinking watchdog (long search/reasoning must not trip it). */
  resetThinkingTimer(conversationId: string): void {
    const session = this.sessions.get(conversationId);
    if (!session || (session.status !== 'thinking' && session.status !== 'streaming')) return;
    if (session.thinkingTimer) clearTimeout(session.thinkingTimer);
    session.thinkingTimer = setTimeout(() => {
      if (session.status === 'thinking' && !session.accumulatedText) {
        this.logger.warn(`Session ${conversationId} timed out in thinking state`);
        this.failSession(conversationId, 'زمان انتظار برای پردازش پیام به پایان رسید (Timeout)');
      }
    }, 35000);
    if (session.thinkingTimer && typeof session.thinkingTimer.unref === 'function') {
      session.thinkingTimer.unref();
    }
  }

  completeSession(conversationId: string, messageId: string): void {
    const session = this.sessions.get(conversationId);
    if (!session) return;

    if (session.thinkingTimer) {
      clearTimeout(session.thinkingTimer);
      session.thinkingTimer = undefined;
    }

    session.status = 'completed';
    session.savedMessageId = messageId;

    const event: StreamEvent = { type: 'done', messageId };
    for (const sub of session.subscribers) {
      try {
        sub(event);
      } catch (err) {
        this.logger.warn(`Subscriber error on done emit: ${err}`);
      }
    }

    this.scheduleCleanup(conversationId, 60000);
  }

  failSession(conversationId: string, error: string): void {
    const session = this.sessions.get(conversationId);
    if (!session) return;

    if (session.thinkingTimer) {
      clearTimeout(session.thinkingTimer);
      session.thinkingTimer = undefined;
    }

    session.status = 'error';
    session.error = error;
    try {
      session.abortController.abort();
    } catch {}

    const event: StreamEvent = { type: 'error', message: error };
    for (const sub of session.subscribers) {
      try {
        sub(event);
      } catch (err) {
        this.logger.warn(`Subscriber error on error emit: ${err}`);
      }
    }

    this.scheduleCleanup(conversationId, 30000);
  }

  abortSession(conversationId: string): boolean {
    const session = this.sessions.get(conversationId);
    if (!session || session.status === 'completed' || session.status === 'error') {
      return false;
    }

    if (session.thinkingTimer) {
      clearTimeout(session.thinkingTimer);
      session.thinkingTimer = undefined;
    }

    session.abortController.abort();
    session.status = 'completed';

    const event: StreamEvent = {
      type: 'done',
      messageId: session.savedMessageId || `aborted-${Date.now()}`,
    };
    for (const sub of session.subscribers) {
      try {
        sub(event);
      } catch (err) {
        this.logger.warn(`Subscriber error on abort emit: ${err}`);
      }
    }

    this.scheduleCleanup(conversationId, 15000);
    return true;
  }

  /**
   * Subscribes to an active session. Returns an unsubscribe function.
   */
  subscribe(
    conversationId: string,
    listener: (event: StreamEvent) => void,
  ): (() => void) | null {
    const session = this.sessions.get(conversationId);
    if (!session) return null;

    session.subscribers.add(listener);
    return () => {
      session.subscribers.delete(listener);
    };
  }

  /**
   * Retrieves high-level status for client reconnection / page refresh.
   */
  getActiveStatus(conversationId: string): ActiveStreamStatus {
    const session = this.sessions.get(conversationId);
    if (!session) {
      return {
        active: false,
        status: 'completed',
        accumulatedText: '',
      };
    }

    const isActive = session.status === 'thinking' || session.status === 'streaming';
    return {
      active: isActive,
      status: session.status,
      accumulatedText: session.accumulatedText,
      title: session.title,
      messageId: session.savedMessageId,
      sources: session.sources,
    };
  }

  private scheduleCleanup(conversationId: string, delayMs: number) {
    const session = this.sessions.get(conversationId);
    if (!session) return;

    if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
    session.cleanupTimer = setTimeout(() => {
      this.sessions.delete(conversationId);
    }, delayMs);
    if (session.cleanupTimer && typeof session.cleanupTimer.unref === 'function') {
      session.cleanupTimer.unref();
    }
  }
}
