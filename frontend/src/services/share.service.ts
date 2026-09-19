import { request } from './api';
import type { ChatShareSummary, PublicShareResponse } from '../types';

export const shareService = {
  /**
   * Create or update a frozen snapshot of the conversation up to this moment
   */
  async createOrUpdateShare(conversationId: string): Promise<ChatShareSummary> {
    return request<ChatShareSummary>(`/chat/conversations/${conversationId}/share`, {
      method: 'POST',
    });
  },

  /**
   * Get active share status for the conversation owner
   */
  async getUserShare(conversationId: string): Promise<ChatShareSummary | null> {
    return request<ChatShareSummary | null>(`/chat/conversations/${conversationId}/share`);
  },

  /**
   * Revoke public share link for a conversation
   */
  async revokeShare(conversationId: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/chat/conversations/${conversationId}/share`, {
      method: 'DELETE',
    });
  },

  /**
   * Public retrieval of a frozen conversation snapshot by shareCode
   */
  async getPublicShare(shareCode: string): Promise<PublicShareResponse> {
    return request<PublicShareResponse>(`/chat/shares/${shareCode}`);
  },

  /**
   * Fork/clone a shared conversation to the authenticated user's account
   */
  async forkShare(shareCode: string): Promise<{ conversationId: string; title: string }> {
    return request<{ conversationId: string; title: string }>(`/chat/shares/${shareCode}/fork`, {
      method: 'POST',
    });
  },
};
