import api from './index';

export interface ChatMessage {
  id: number;
  sender_id: number;
  receiver_id: number | null;
  message: string;
  is_read: number;
  created_at: string;
  sender_name?: string;
}

export interface Conversation {
  id: number;
  username: string;
  nickname: string | null;
  unread_count: number;
  last_message_at: string;
}

export async function getMessages(userId?: number) {
  const params = userId ? { user_id: String(userId) } : {};
  const res = await api.get<ChatMessage[]>('/chat/messages', { params });
  return res.data;
}

export async function sendMessage(message: string, receiverId?: number) {
  const res = await api.post<ChatMessage>('/chat/send', {
    message,
    receiver_id: receiverId ?? null,
  });
  return res.data;
}

export async function getConversations() {
  const res = await api.get<Conversation[]>('/chat/conversations');
  return res.data;
}

export async function markAsRead(userId: number) {
  const res = await api.put<{ message: string }>(`/chat/read/${userId}`);
  return res.data;
}

export async function getUnreadCount() {
  const res = await api.get<{ count: number }>('/chat/unread');
  return res.data.count;
}

export async function markAsReadMine() {
  const res = await api.put<{ message: string }>('/chat/read-mine');
  return res.data;
}

// SSE: subscribe to new message events (returns cleanup function)
export function subscribeChat(onNewMessage: () => void): () => void {
  let eventSource: EventSource | null = null;

  try {
    eventSource = new EventSource('/api/chat/events', { withCredentials: true });
    eventSource.addEventListener('new_message', () => { onNewMessage(); });
    eventSource.onerror = () => { /* SSE error ignored — polling fallback handles it */ };
  } catch { /* EventSource not supported */ }

  return () => { eventSource?.close(); };
}
