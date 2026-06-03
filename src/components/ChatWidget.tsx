import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Input, Badge, Grid, message as antMsg } from 'antd';
import { MessageOutlined, CloseOutlined, SendOutlined, UserOutlined, CustomerServiceOutlined, CheckOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AythContext';
import { getMessages, sendMessage as sendChatMessage, markAsReadMine, subscribeChat, type ChatMessage } from '../api/chat';

export default function ChatWidget() {
  const { user } = useAuth();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Only show for non-admin users
  if (!user || user.role === 'admin') return null;

  const fetchMessages = useCallback(async () => {
    try {
      const msgs = await getMessages();
      setMessages(msgs);
      // If chat is open, mark new admin replies as read automatically
      if (open) {
        const hasUnread = msgs.some(
          (m) => m.sender_id !== user.id && m.is_read === 0
        );
        if (hasUnread) {
          await markAsReadMine();
          // Re-fetch to get updated is_read status
          const updated = await getMessages();
          setMessages(updated);
        }
      }
      // Count unread for badge (only when chat is closed, this matters)
      const unreadCount = msgs.filter(
        (m) => m.sender_id !== user.id && m.is_read === 0
      ).length;
      setUnread(unreadCount);
    } catch { /* ignore */ }
  }, [user.id, open]);

  // Mark messages as read when opening the chat
  const handleOpen = useCallback(async () => {
    setOpen(true);
    try {
      await markAsReadMine();
    } catch { /* ignore */ }
    await fetchMessages();
  }, [fetchMessages]);

  // Subscribe to SSE + polling for reliable real-time updates
  useEffect(() => {
    fetchMessages();
    const cleanup = subscribeChat(fetchMessages);
    // Fallback polling every 3 seconds
    const polling = setInterval(fetchMessages, 3000);
    return () => {
      cleanup();
      clearInterval(polling);
    };
  }, [fetchMessages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await sendChatMessage(text.trim());
      setText('');
      await fetchMessages();
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
    <div style={{
      position: 'fixed',
      bottom: isMobile ? 12 : 24,
      right: isMobile ? 12 : 24,
      zIndex: 9999,
    }}>
      {open ? (
        <div style={{
          width: isMobile ? 'calc(100vw - 24px)' : 360,
          height: isMobile ? '60vh' : 500,
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e8e8e8',
        }}>
          {/* Header */}
          <div style={{
            background: '#1677ff',
            color: '#fff',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CustomerServiceOutlined style={{ fontSize: 20 }} />
              <span style={{ fontWeight: 600, fontSize: 15 }}>管理员咨询</span>
            </div>
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={() => setOpen(false)}
              style={{ color: '#fff' }}
            />
          </div>

          {/* Messages */}
          <div
            ref={listRef}
            style={{
              flex: 1,
              padding: 12,
              overflowY: 'auto',
              background: '#f5f5f5',
            }}
          >
            {messages.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: '#999',
                marginTop: 80,
                fontSize: 14,
              }}>
                <CustomerServiceOutlined style={{ fontSize: 40, color: '#d9d9d9', display: 'block', marginBottom: 12 }} />
                暂无消息<br />
                发消息给管理员吧
              </div>
            ) : (
              messages.map((msg) => {
                const isMine = msg.sender_id === user.id;
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMine ? 'flex-end' : 'flex-start',
                      marginBottom: 12,
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 3,
                      fontSize: 11,
                      color: '#999',
                    }}>
                      {isMine ? (
                        <><span style={{ color: '#1677ff' }}>我</span><UserOutlined /></>
                      ) : (
                        <><span style={{ color: '#52c41a' }}>管理员</span><CustomerServiceOutlined /></>
                      )}
                      <span>{new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div style={{
                      maxWidth: '80%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: isMine ? '#1677ff' : '#fff',
                      color: isMine ? '#fff' : '#333',
                      fontSize: 14,
                      lineHeight: 1.5,
                      wordBreak: 'break-word',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                    }}>
                      {msg.message}
                    </div>
                    {/* Read/unread indicator for my sent messages */}
                    {isMine && (
                      <div style={{
                        fontSize: 10,
                        color: msg.is_read ? '#52c41a' : '#bbb',
                        marginTop: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                      }}>
                        <CheckOutlined style={{ fontSize: 10 }} />
                        {msg.is_read ? '已读' : '未读'}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 12px',
            borderTop: '1px solid #f0f0f0',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}>
            <Input.TextArea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              rows={1}
              autoSize={{ minRows: 1, maxRows: 3 }}
              style={{ flex: 1, borderRadius: 6 }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={sending}
              disabled={!text.trim()}
              style={{ borderRadius: 6 }}
            >
              发送
            </Button>
          </div>
        </div>
      ) : (
        <Badge count={unread} offset={[-4, 4]} size="small">
          <Button
            type="primary"
            shape="circle"
            size="large"
            icon={<MessageOutlined style={{ fontSize: isMobile ? 18 : 22 }} />}
            onClick={handleOpen}
            style={{
              width: isMobile ? 44 : 52,
              height: isMobile ? 44 : 52,
              boxShadow: '0 4px 12px rgba(22,119,255,0.4)',
            }}
          />
        </Badge>
      )}
    </div>
  );
}
