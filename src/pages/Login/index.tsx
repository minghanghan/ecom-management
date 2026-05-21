import { Form, Input, Button, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AythContext';
import './style.css';

const { Title, Text } = Typography;

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form] = Form.useForm();

  const onFinish = async (values: { username: string; password: string }) => {
    try {
      await login(values);
      message.success('登录成功');
      navigate('/');
    } catch (error: any) {
      message.error(error.response?.data?.message || '登录失败');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-sidebar">
          <div className="auth-sidebar-content">
            <div className="auth-logo">
              <span className="auth-logo-icon">EC</span>
            </div>
            <Title level={2} className="auth-sidebar-title">
              电商管理系统
            </Title>
            <Text className="auth-sidebar-desc">
              高效管理您的商品、订单、美工任务
              <br />
              一站式电商后台解决方案
            </Text>
            <div className="auth-sidebar-features">
              <div className="feature-item">
                <span className="feature-dot" />
                商品管理
              </div>
              <div className="feature-item">
                <span className="feature-dot" />
                订单追踪
              </div>
              <div className="feature-item">
                <span className="feature-dot" />
                美工任务协同
              </div>
              <div className="feature-item">
                <span className="feature-dot" />
                财务分析
              </div>
            </div>
          </div>
        </div>

        <div className="auth-form-wrapper">
          <div className="auth-form-container">
            <Title level={3} className="auth-form-title">欢迎回来</Title>
            <Text className="auth-form-subtitle">请登录您的账号</Text>

            <Form form={form} onFinish={onFinish} size="large" className="auth-form" autoComplete="off">
              <Form.Item
                name="username"
                rules={[
                  { required: true, message: '请输入手机号' },
                  { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的11位手机号' },
                ]}
              >
                <Input
                  placeholder="手机号"
                  maxLength={11}
                  prefix={<UserOutlined />}
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password
                  placeholder="密码"
                  prefix={<LockOutlined />}
                />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" block className="auth-btn">
                  登 录
                </Button>
              </Form.Item>
            </Form>

            <div className="auth-footer-text">
              还没有账号？ <Link to="/register">立即注册</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
