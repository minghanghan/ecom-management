import { Form, Input, Button, message, Typography } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, SmileOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AythContext';
import '../Login/style.css';

const { Title, Text } = Typography;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form] = Form.useForm();

  const onFinish = async (values: {
    username: string;
    password: string;
    email?: string;
    nickname?: string;
  }) => {
    try {
      await register({
        username: values.username,
        password: values.password,
        email: values.email || undefined,
        nickname: values.nickname || undefined,
      });
      message.success('注册成功');
      navigate('/');
    } catch (error: any) {
      message.error(error.response?.data?.message || '注册失败');
    }
  };

  const passwordRules = [
    { required: true, message: '请输入密码' },
    {
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,20}$/,
      message: '密码需8-20位，包含大小写字母和数字',
    },
  ];

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
              创建您的账号，开始高效管理
              <br />
              商品 · 订单 · 美工任务
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
            <Title level={3} className="auth-form-title">创建账号</Title>
            <Text className="auth-form-subtitle">注册成为新用户</Text>

            <Form
              form={form}
              onFinish={onFinish}
              size="large"
              className="auth-form"
              autoComplete="off"
            >
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

              <Form.Item name="nickname">
                <Input
                  placeholder="昵称（选填）"
                  prefix={<SmileOutlined />}
                />
              </Form.Item>

              <Form.Item
                name="email"
                rules={[
                  {
                    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: '邮箱格式不正确',
                  },
                ]}
              >
                <Input
                  placeholder="邮箱（选填）"
                  prefix={<MailOutlined />}
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={passwordRules}
              >
                <Input.Password
                  placeholder="密码"
                  prefix={<LockOutlined />}
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                dependencies={['password']}
                rules={[
                  { required: true, message: '请确认密码' },
                  ({ getFieldValue }: { getFieldValue: (name: string) => string }) => ({
                    validator(_: unknown, value: string) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    },
                  }),
                ]}
              >
                <Input.Password
                  placeholder="确认密码"
                  prefix={<LockOutlined />}
                />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" block className="auth-btn">
                  注 册
                </Button>
              </Form.Item>
            </Form>

            <div className="auth-footer-text">
              已有账号？ <Link to="/login">立即登录</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
