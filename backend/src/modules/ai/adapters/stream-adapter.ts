import type { ChatMessage, ResolvedTarget, StreamOptions } from '../openai-compat.forwarder';

export type StreamChunk =
  | { type: 'content'; text: string }
  | { type: 'reasoning'; text: string };

export interface StreamRequestContext {
  target: ResolvedTarget;
  messages: ChatMessage[];
  options?: StreamOptions;
}

export interface StreamAdapter {
  readonly name: string;
  buildRequest(ctx: StreamRequestContext): { url: string; init: RequestInit };
  parseStreamChunk(payload: unknown): StreamChunk[];
}
