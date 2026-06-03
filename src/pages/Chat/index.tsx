import { useState, useEffect, useRef, useCallback } from 'react';
import { Input, Button, Badge, message as antMsg, Empty } from 'antd';
import { SendOutlined, UserOutlined, CustomerServiceOutlined, CheckOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AythContext';
import {
  getMessages, sendMessage, getConversations, markAsRead, subscribeChat,
  type ChatMessage, type Conversation,
} from '../../api/chat';
import './style.css';

export default function ChatPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Redirect non-admin users
  if (!user || user.role !== 'admin') {
    return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>无权限访问</div>;
  }

  const fetchConversations = useCallback(async () => {
    try {
      const convs = await getConversations();
      setConversations(convs);
    } catch { /* ignore */ }
  }, []);

  const fetchMessages = useCallback(async (userId: number) => {
    try {
      const msgs = await getMessages(userId);
      setMessages(msgs);
    } catch { /* ignore */ }
  }, []);

  // Initial load
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Subscribe to SSE + polling for reliable real-time updates
  useEffect(() => {
    const onNewMessage = async () => {
      fetchConversations();
      if (selectedUser) {
        await fetchMessages(selectedUser.id);
        // Auto-mark as read when viewing this conversation
        try {
          await markAsRead(selectedUser.id);
          setConversations((prev) =>
            prev.map((c) => c.id === selectedUser.id ? { ...c, unread_count: 0 } : c)
          );
        } catch { /* ignore */ }
      }
    };
    const cleanup = subscribeChat(onNewMessage);
    // Fallback polling every 3 seconds
    const polling = setInterval(onNewMessage, 3000);
    return () => {
      cleanup();
      clearInterval(polling);
    };
  }, [fetchConversations, selectedUser, fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSelectUser = async (conv: Conversation) => {
    setSelectedUser(conv);
    await fetchMessages(conv.id);
    try {
      await markAsRead(conv.id);
      // Update local unread count
      setConversations((prev) =>
        prev.map((c) => c.id === conv.id ? { ...c, unread_count: 0 } : c)
      );
    } catch { /* ignore */ }
  };

  const handleSend = async () => {
    if (!text.trim() || !selectedUser) return;
    setSending(true);
    try {
      await sendMessage(text.trim(), selectedUser.id);
      setText('');
      await fetchMessages(selectedUser.id);
      await fetchConversations();
    } catch {
      antMsg.error('发送失败');
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-admin-page">
      <div className="chat-bg" />
      <div className="chat-inner">
        <header className="chat-header">
          <h1 className="chat-title">消息管理</h1>
          <p className="chat-subtitle">
            共 {conversations.length} 个对话 ·
            <span style={{ color: '#f59e0b', marginLeft: 4 }}>
              {conversations.reduce((s, c) => s + c.unread_count, 0)} 条未读
            </span>
          </p>
        </header>

        <div className="chat-main">
          {/* Left: conversation list */}
          <div className="chat-sidebar">
            <div className="chat-sidebar-header">
              <UserOutlined /> 用户列表
            </div>
            <div className="chat-sidebar-list">
              {conversations.length === 0 ? (
                <div className="chat-sidebar-empty">暂无对话</div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`chat-conv-item ${selectedUser?.id === conv.id ? 'chat-conv-active' : ''}`}
                    onClick={() => handleSelectUser(conv)}
                  >
                    <div className="chat-conv-avatar">
                      <UserOutlined />
                    </div>
                    <div className="chat-conv-info">
                      <div className="chat-conv-name">
                        {conv.nickname || conv.username}
                      </div>
                      <div className="chat-conv-time">
                        {conv.last_message_at
                          ? new Date(conv.last_message_at).toLocaleString('zh-CN', {
                              month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                            })
                          : ''}
                      </div>
                      {conv.unread_count > 0 && (
                        <div className="chat-conv-unread">{conv.unread_count} 条未读</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: chat panel */}
          <div className="chat-panel">
            {selectedUser ? (
              <>
                <div className="chat-panel-header">
                  <CustomerServiceOutlined style={{ marginRight: 8 }} />
                  与 {selectedUser.nickname || selectedUser.username} 的对话
                </div>
                <div className="chat-panel-messages" ref={listRef}>
                  {messages.length === 0 ? (
                    <div className="chat-panel-empty">暂无消息记录</div>
                  ) : (
                    messages.map((msg) => {
                      const isAdmin = msg.sender_id === user.id;
                      return (
                        <div
                          key={msg.id}
                          className={`chat-msg ${isAdmin ? 'chat-msg-admin' : 'chat-msg-user'}`}
                        >
                          <div className="chat-msg-meta">
                            {isAdmin ? '我 (管理员)' : selectedUser.nickname || selectedUser.username}
                            <span className="chat-msg-time">
                              {new Date(msg.created_at).toLocaleTimeString('zh-CN', {
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className={`chat-msg-group ${isAdmin ? 'chat-group-admin' : 'chat-group-user'}`}>
                            <div className={`chat-msg-bubble ${isAdmin ? 'chat-bubble-admin' : 'chat-bubble-user'}`}>
                              {msg.message}
                            </div>
                            {isAdmin && (
                              <div className={`chat-read-indicator ${msg.is_read ? 'chat-read-yes' : 'chat-read-no'}`}>
                                <CheckOutlined style={{ fontSize: 10 }} />
                                {msg.is_read ? '已读' : '未读'}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="chat-panel-input">
                  <Input.TextArea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入回复内容..."
                    rows={1}
                    autoSize={{ minRows: 1, maxRows: 3 }}
                    style={{ borderRadius: 8, minHeight: 44, paddingTop: 10, paddingBottom: 10 }}
                  />
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleSend}
                    loading={sending}
                    disabled={!text.trim()}
                    className="chat-send-btn"
                  >
                    发送
                  </Button>
                </div>
              </>
            ) : (
              <div className="chat-panel-placeholder">
                <Empty description="选择一个用户开始对话" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
