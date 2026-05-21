declare module 'antd' {
  import { ReactNode, ComponentType } from 'react';
  export const ConfigProvider: ComponentType<any>;
  export const Layout: ComponentType<any> & { Header: ComponentType<any>; Sider: ComponentType<any>; Content: ComponentType<any> };
  export const Menu: ComponentType<any>;
  export const Button: ComponentType<any>;
  export const Form: ComponentType<any> & { Item: ComponentType<any>; useForm: any };
  export const Input: ComponentType<any> & { Password: ComponentType<any> };
  export const Select: ComponentType<any> & { Option: ComponentType<any> };
  export const Card: ComponentType<any>;
  export const Typography: { Title: ComponentType<any>; Text: ComponentType<any> };
  export const message: any;
  export const Spin: ComponentType<any>;
  export const Row: ComponentType<any>;
  export const Col: ComponentType<any>;
  export const Dropdown: ComponentType<any>;
  export const notification: any;
  export const Table: ComponentType<any>;
  export const Tag: ComponentType<any>;
  export const Space: ComponentType<any>;
  export const Modal: ComponentType<any>;
  export const Breadcrumb: ComponentType<any>;
  export const DatePicker: ComponentType<any>;
  export const Badge: ComponentType<any>;
  export const Statistic: ComponentType<any>;
  export const Tabs: ComponentType<any>;
  export const Tooltip: ComponentType<any>;
  export const Popconfirm: ComponentType<any>;
  export const Switch: ComponentType<any>;
  export const Upload: ComponentType<any>;
  export const Image: ComponentType<any>;
  export const Descriptions: ComponentType<any>;
  export default { ConfigProvider, Layout, Menu, Button, Form, Input, Select, Card, Typography, message, Spin, Row, Col, Dropdown, notification, Table, Tag, Space, Modal, Breadcrumb, DatePicker, Badge, Tabs, Tooltip, Popconfirm, Switch, Upload, Image, Descriptions };
}

declare module 'antd/locale/zh_CN' {
  const zhCN: any;
  export default zhCN;
}

declare module 'echarts' {
  const echarts: any;
  export default echarts;
  export function use(components: any[]): void;
  export function init(dom: HTMLElement, theme?: any, opts?: any): any;
}

declare module '@ant-design/icons' {
  import { ComponentType } from 'react';
  export const UserOutlined: ComponentType<any>;
  export const LockOutlined: ComponentType<any>;
  export const MailOutlined: ComponentType<any>;
  export const SmileOutlined: ComponentType<any>;
  export const DashboardOutlined: ComponentType<any>;
  export const ShoppingOutlined: ComponentType<any>;
  export const ShoppingCartOutlined: ComponentType<any>;
  export const FileAddOutlined: ComponentType<any>;
  export const PictureOutlined: ComponentType<any>;
  export const LinkOutlined: ComponentType<any>;
  export const HistoryOutlined: ComponentType<any>;
  export const MoneyCollectOutlined: ComponentType<any>;
  export const LogoutOutlined: ComponentType<any>;
  export const MenuFoldOutlined: ComponentType<any>;
  export const MenuUnfoldOutlined: ComponentType<any>;
  export const ExclamationCircleOutlined: ComponentType<any>;
  export const DollarOutlined: ComponentType<any>;
}

// ECharts subpath modules
declare module 'echarts/core' {
  export function use(components: any[]): void;
  export function init(...args: any[]): any;
  export function registerTheme(...args: any[]): void;
  export function connect(...args: any[]): void;
  export function disconnect(...args: any[]): void;
  export function MapChart(...args: any[]): void;
}
declare module 'echarts/charts' {
  export const LineChart: any;
  export const BarChart: any;
  export const PieChart: any;
}
declare module 'echarts/components' {
  export const GridComponent: any;
  export const TooltipComponent: any;
  export const LegendComponent: any;
  export const TitleComponent: any;
}
declare module 'echarts/renderers' {
  export const CanvasRenderer: any;
}
