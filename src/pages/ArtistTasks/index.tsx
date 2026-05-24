import { useState, useEffect, useCallback } from 'react';
import { Button, Card, Tag, message, Space, Input, Modal, Image, Empty, Typography, Spin } from 'antd';
import { PlusOutlined, LinkOutlined, ClockCircleOutlined, CheckCircleOutlined, EditOutlined, CheckOutlined, UserOutlined, DownloadOutlined, ShopOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AythContext';
import { getArtistTasks, claimTask, completeTask, updateTaskFilePath, type ArtistTask } from '../../api/artistTasks';
import './style.css';

const { Text, Paragraph } = Typography;

const priorityConfig: Record<string, { color: string; label: string }> = {
  low: { color: '#94a3b8', label: '低' },
  medium: { color: '#3b82f6', label: '中' },
  high: { color: '#f59e0b', label: '高' },
  urgent: { color: '#ef4444', label: '紧急' },
};

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: '#f59e0b', icon: <ClockCircleOutlined />, label: '待处理' },
  in_progress: { color: '#3b82f6', icon: <EditOutlined />, label: '处理中' },
  completed: { color: '#10b981', icon: <CheckCircleOutlined />, label: '已完成' },
};

export default function ArtistTasksPage() {
  const { user, selectedStoreId } = useAuth();
  const [items, setItems] = useState<ArtistTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [filePaths, setFilePaths] = useState<Record<number, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [counts, setCounts] = useState({ pending: 0, in_progress: 0, completed: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getArtistTasks({
        status: statusFilter,
        store_id: selectedStoreId ?? undefined,
      });
      setItems(result.items);
      if (result.counts) setCounts(result.counts);
    } catch {
      message.error('加载任务列表失败');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedStoreId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleClaim = async (id: number) => {
    setClaimingId(id);
    try {
      await claimTask(id);
      message.success('已认领任务');
      fetchData();
    } catch {
      message.error('认领失败');
    } finally {
      setClaimingId(null);
    }
  };

  const handleComplete = async (id: number) => {
    const fileUrl = filePaths[id];
    if (!fileUrl?.trim()) {
      message.warning('请填写设计稿文件路径');
      return;
    }
    setCompletingId(id);
    try {
      await completeTask(id, fileUrl.trim());
      message.success('任务已完成');
      setFilePaths((prev) => { const n = { ...prev }; delete n[id]; return n; });
      fetchData();
    } catch {
      message.error('操作失败');
    } finally {
      setCompletingId(null);
    }
  };

  const handleUpdateFilePath = async (id: number) => {
    const fileUrl = filePaths[id];
    if (!fileUrl?.trim()) {
      message.warning('请填写设计稿文件路径');
      return;
    }
    setCompletingId(id);
    try {
      await updateTaskFilePath(id, fileUrl.trim());
      message.success('文件路径已更新');
      fetchData();
    } catch {
      message.error('更新失败');
    } finally {
      setCompletingId(null);
    }
  };

  const canClaim = (task: ArtistTask) => {
    return task.status === 'pending' && !task.assignee_id;
  };

  const canEdit = (task: ArtistTask) => {
    if (user?.role === 'admin') return true;
    return task.assignee_id === user?.id;
  };

  const canComplete = (task: ArtistTask) => {
    if (task.status !== 'in_progress') return false;
    return canEdit(task);
  };

  const statusTabs = [
    { key: '', label: '全部', color: '#3b82f6', count: counts.pending + counts.in_progress + counts.completed },
    { key: 'pending', label: '待处理', color: '#f59e0b', count: counts.pending },
    { key: 'in_progress', label: '处理中', color: '#3b82f6', count: counts.in_progress },
    { key: 'completed', label: '已完成', color: '#10b981', count: counts.completed },
  ];

  return (
    <div className="artist-tasks-page">
      <div className="at-bg" />
      <div className="at-inner">
        {/* Header */}
        <div className="at-header">
          <div>
            <h1 className="at-title">美工师任务</h1>
            <p className="at-subtitle">
              管理设计任务 ·{' '}
              <span className="at-subtitle-strong">待处理: {counts.pending}</span>
              {' · '}
              <span style={{ color: '#3b82f6' }}>处理中: {counts.in_progress}</span>
            </p>
          </div>
        </div>

        {/* Status tabs */}
        <div className="at-filters-card">
          <div className="at-tabs">
            {statusTabs.map((tab) => (
              <div
                key={tab.key}
                className={`at-tab ${statusFilter === tab.key ? 'at-tab-active' : ''}`}
                onClick={() => setStatusFilter(tab.key || undefined)}
              >
                <span className="at-tab-dot" style={{ background: tab.color }} />
                {tab.label}
                <span className="at-tab-count">{tab.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card grid */}
        <Spin spinning={loading}>
          {items.length === 0 ? (
            <div className="at-empty">
              <Empty description={statusFilter ? '暂无该状态的任务' : '暂无任务'} />
            </div>
          ) : (
            <div className="at-card-grid">
              {items.map((task) => {
                const priCfg = priorityConfig[task.priority] || priorityConfig.medium;
                const stCfg = statusConfig[task.status] || statusConfig.pending;
                return (
                  <Card key={task.id} className="at-card" hoverable>
                    {/* Priority badge */}
                    <div className="at-card-badge" style={{ background: priCfg.color }}>
                      {priCfg.label}
                    </div>

                    {/* Status tag */}
                    <Tag icon={stCfg.icon} color={stCfg.color} className="at-card-status">
                      {stCfg.label}
                    </Tag>

                    {/* Product info */}
                    <div className="at-card-body">
                      <div className="at-card-product">{task.product_name}</div>
                      <div className="at-card-sku">{task.product_sku}</div>

                      {/* Description */}
                      {task.description && (
                        <Paragraph ellipsis={{ rows: 3 }} className="at-card-desc">
                          {task.description}
                        </Paragraph>
                      )}

                      {/* Links */}
                      <div className="at-card-links">
                        {task.links && task.links.length > 0 ? (
                          <>
                            {task.links.slice(0, 3).map((link, i) => (
                              <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="at-link-item">
                                <LinkOutlined /> 参考{i + 1}
                              </a>
                            ))}
                            {task.links.length > 3 && <Text type="secondary" style={{ fontSize: 11 }}>+{task.links.length - 3}</Text>}
                          </>
                        ) : (
                          <span className="at-link-empty">暂无参考链接</span>
                        )}
                      </div>

                      {/* Creator & Assignee */}
                      <div className="at-card-meta">
                        <UserOutlined /> {task.creator_name || '未知'}
                      </div>
                      {task.assignee_name && (
                        <div className="at-card-assignee">
                          <UserOutlined /> {task.assignee_name}
                        </div>
                      )}

                      {/* Store */}
                      {task.store_name && (
                        <div className="at-card-store">
                          <ShopOutlined /> {task.store_name}
                        </div>
                      )}

                      {/* Time */}
                      <div className="at-card-time">
                        <ClockCircleOutlined /> {task.created_at?.replace('T', ' ').slice(0, 16)}
                      </div>

                    </div>

                    {/* Actions */}
                    <div className="at-card-actions">
                      {canClaim(task) && (
                        <Button
                          type="primary"
                          size="small"
                          icon={<PlusOutlined />}
                          loading={claimingId === task.id}
                          onClick={() => handleClaim(task.id)}
                          className="at-btn-claim"
                        >
                          认领任务
                        </Button>
                      )}
                      {canEdit(task) && (task.status === 'in_progress' || task.status === 'completed') && (
                        <div className="at-complete-row">
                          <Input
                            className="at-file-input"
                            placeholder="输入设计稿文件路径"
                            value={filePaths[task.id] ?? task.completion_files?.[0] ?? ''}
                            onChange={(e) => setFilePaths((prev) => ({ ...prev, [task.id]: e.target.value }))}
                          />
                          {task.status === 'in_progress' ? (
                            <Button
                              type="primary"
                              size="small"
                              icon={<CheckOutlined />}
                              loading={completingId === task.id}
                              disabled={!filePaths[task.id]?.trim() && !task.completion_files?.[0]}
                              onClick={() => handleComplete(task.id)}
                              className="at-btn-complete"
                            >
                              完成
                            </Button>
                          ) : (
                            <Button
                              type="primary"
                              size="small"
                              icon={<CheckOutlined />}
                              loading={completingId === task.id}
                              disabled={!filePaths[task.id]?.trim()}
                              onClick={() => handleUpdateFilePath(task.id)}
                              className="at-btn-complete"
                            >
                              保存
                            </Button>
                          )}
                        </div>
                      )}
                      {!canEdit(task) && task.status === 'completed' && task.completion_files?.[0] && (
                        <div className="at-complete-row">
                          <div className="at-file-path-readonly">
                            <LinkOutlined />
                            <span>{task.completion_files[0]}</span>
                          </div>
                          <Tag color="#10b981" className="at-completed-tag">已完成</Tag>
                        </div>
                      )}
                      {!canEdit(task) && task.status === 'completed' && !task.completion_files?.[0] && (
                        <Tag color="#10b981" className="at-completed-tag">已完成</Tag>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </Spin>
      </div>

      {/* Image preview */}
      <Modal
        open={!!previewUrl}
        footer={null}
        onCancel={() => setPreviewUrl(null)}
        width={800}
        centered
      >
        {previewUrl && <Image src={previewUrl} style={{ width: '100%' }} />}
      </Modal>
    </div>
  );
}
