import { useState, useEffect, useCallback } from 'react';
import { Button, Card, Tag, message, Space, Input, Typography, Spin, Empty } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, LinkOutlined, UserOutlined, DownloadOutlined, ShopOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AythContext';
import { getDeployLinks, completeDeploy, type DeployTask } from '../../api/deployLinks';
import './style.css';

const { Text, Paragraph } = Typography;

const priorityConfig: Record<string, { color: string; label: string }> = {
  low: { color: '#94a3b8', label: '低' },
  medium: { color: '#3b82f6', label: '中' },
  high: { color: '#f59e0b', label: '高' },
  urgent: { color: '#ef4444', label: '紧急' },
};

export default function DeployLinksPage() {
  const { user, selectedStoreId } = useAuth();
  const [items, setItems] = useState<DeployTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [deployLinks, setDeployLinks] = useState<Record<number, string>>({});
  const [counts, setCounts] = useState({ pending: 0, deployed: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getDeployLinks({
        status: statusFilter,
        store_id: selectedStoreId ?? undefined,
      });
      setItems(result.items);
      if (result.counts) setCounts(result.counts);
    } catch {
      message.error('加载布置链接列表失败');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedStoreId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleComplete = async (id: number) => {
    const link = deployLinks[id];
    if (!link?.trim()) {
      message.warning('请填写布置链接');
      return;
    }
    setCompletingId(id);
    try {
      await completeDeploy(id, link.trim());
      message.success('布置完成');
      setDeployLinks((prev) => { const n = { ...prev }; delete n[id]; return n; });
      fetchData();
    } catch {
      message.error('操作失败');
    } finally {
      setCompletingId(null);
    }
  };

  const canDeploy = (task: DeployTask) => {
    if (user?.role === 'admin') return true;
    return task.created_by === user?.id;
  };

  const statusTabs = [
    { key: '', label: '全部', color: '#6366f1', count: counts.pending + counts.deployed },
    { key: 'pending', label: '待布置', color: '#f59e0b', count: counts.pending },
    { key: 'deployed', label: '已布置', color: '#10b981', count: counts.deployed },
  ];

  return (
    <div className="deploy-links-page">
      <div className="dl-bg" />
      <div className="dl-inner">
        {/* Header */}
        <div className="dl-header">
          <div>
            <h1 className="dl-title">布置链接</h1>
            <p className="dl-subtitle">
              美工师已完成的设计稿，布置到电商平台 ·
              <span className="dl-subtitle-strong"> 待布置: {counts.pending}</span>
              {' · '}
              <span style={{ color: '#10b981' }}>已布置: {counts.deployed}</span>
            </p>
          </div>
        </div>

        {/* Status tabs */}
        <div className="dl-filters-card">
          <div className="dl-tabs">
            {statusTabs.map((tab) => (
              <div
                key={tab.key}
                className={`dl-tab ${statusFilter === tab.key ? 'dl-tab-active' : ''}`}
                onClick={() => setStatusFilter(tab.key || undefined)}
              >
                <span className="dl-tab-dot" style={{ background: tab.color }} />
                {tab.label}
                <span className="dl-tab-count">{tab.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card grid */}
        <Spin spinning={loading}>
          {items.length === 0 ? (
            <div className="dl-empty">
              <Empty description={statusFilter ? '暂无该状态的任务' : '暂无布置任务'} />
            </div>
          ) : (
            <div className="dl-card-grid">
              {items.map((task) => {
                const priCfg = priorityConfig[task.priority] || priorityConfig.medium;
                return (
                  <Card key={task.id} className="dl-card" hoverable>
                    {/* Priority badge */}
                    <div className="dl-card-badge" style={{ background: priCfg.color }}>
                      {priCfg.label}
                    </div>

                    {/* Dual status indicators */}
                    <div className="dl-status-row">
                      <Tag icon={<CheckCircleOutlined />} color="#10b981" className="dl-status-tag">
                        美工师已完成
                      </Tag>
                      {task.deploy_completed === 1 ? (
                        <Tag icon={<CheckCircleOutlined />} color="#10b981" className="dl-status-tag">
                          已布置
                        </Tag>
                      ) : (
                        <Tag icon={<ClockCircleOutlined />} color="#f59e0b" className="dl-status-tag">
                          待布置
                        </Tag>
                      )}
                    </div>

                    {/* Product info */}
                    <div className="dl-card-body">
                      <div className="dl-card-product">{task.product_name}</div>
                      <div className="dl-card-sku">{task.product_sku}</div>

                      {/* Description */}
                      {task.description && (
                        <Paragraph ellipsis={{ rows: 3 }} className="dl-card-desc">
                          {task.description}
                        </Paragraph>
                      )}

                      {/* Completion files */}
                      {task.completion_files && task.completion_files.length > 0 && (
                        <div className="dl-card-files">
                          <div className="dl-files-label">设计稿目录</div>
                          <div className="dl-files-list-text">
                            {task.completion_files.map((f, i) => (
                              <div key={i} className="dl-file-path-item">
                                <DownloadOutlined />
                                <span>{f}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Links */}
                      <div className="dl-card-links">
                        {task.links && task.links.length > 0 ? (
                          <>
                            {task.links.slice(0, 3).map((link, i) => (
                              <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="dl-link-item">
                                <LinkOutlined /> 参考{i + 1}
                              </a>
                            ))}
                            {task.links.length > 3 && <Text type="secondary" style={{ fontSize: 11 }}>+{task.links.length - 3}</Text>}
                          </>
                        ) : (
                          <span className="dl-link-empty">暂无参考链接</span>
                        )}
                      </div>

                      {/* Creator & Assignee */}
                      <div className="dl-card-meta">
                        <UserOutlined /> {task.creator_name || '未知'}
                      </div>
                      {task.assignee_name && (
                        <div className="dl-card-assignee">
                          <UserOutlined /> {task.assignee_name}
                        </div>
                      )}

                      {/* Store */}
                      {task.store_name && (
                        <div className="dl-card-store">
                          <ShopOutlined /> {task.store_name}
                        </div>
                      )}

                      {/* Time */}
                      <div className="dl-card-time">
                        提交时间: {task.created_at?.replace('T', ' ').slice(0, 16)}
                      </div>
                    </div>

                    {/* Action area */}
                    <div className="dl-card-actions">
                      {task.deploy_completed === 0 && canDeploy(task) && (
                        <div className="dl-deploy-row">
                          <Input
                            className="dl-link-input"
                            placeholder="输入布置链接URL"
                            value={deployLinks[task.id] ?? ''}
                            onChange={(e) => setDeployLinks((prev) => ({ ...prev, [task.id]: e.target.value }))}
                          />
                          <Button
                            type="primary"
                            size="small"
                            icon={<LinkOutlined />}
                            loading={completingId === task.id}
                            disabled={!deployLinks[task.id]?.trim()}
                            onClick={() => handleComplete(task.id)}
                            className="dl-btn-deploy"
                          >
                            完成布置
                          </Button>
                        </div>
                      )}
                      {task.deploy_completed === 0 && !canDeploy(task) && (
                        <Tag icon={<ClockCircleOutlined />} color="#f59e0b" className="dl-deploy-tag">待布置</Tag>
                      )}
                      {task.deploy_completed === 1 && (
                        <div className="dl-deploy-result">
                          <div className="dl-deploy-link-readonly">
                            <LinkOutlined />
                            <a href={task.deploy_link!} target="_blank" rel="noopener noreferrer">
                              {task.deploy_link}
                            </a>
                          </div>
                          <Tag icon={<CheckCircleOutlined />} color="#10b981" className="dl-completed-tag">已完成</Tag>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </Spin>
      </div>
    </div>
  );
}
