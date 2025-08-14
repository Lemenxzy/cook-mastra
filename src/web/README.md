# 智能烹饪助手 Web 界面

基于React + Vite + TypeScript构建的现代化烹饪助手前端界面。

## ✨ 特性

- 🎨 **现代化UI设计** - 使用Tailwind CSS打造美观界面
- 💬 **实时流式对话** - 支持流式传输的智能对话体验
- 🚀 **快捷菜单** - 预设16个常用烹饪查询，一键体验
- 📱 **响应式布局** - 完美适配桌面和移动设备
- ⚡ **快速响应** - Vite驱动的极速开发和构建体验
- 🎯 **智能分类** - 菜谱、食材、搭配推荐三大分类

## 🏗️ 技术栈

- **前端框架**: React 18
- **构建工具**: Vite
- **类型系统**: TypeScript
- **样式方案**: Tailwind CSS
- **图标库**: Lucide React
- **API通信**: 原生Fetch + 流式传输

## 🎯 功能特点

### 智能对话
- 流式响应显示，实时查看AI思考过程
- 支持多轮对话，上下文理解
- 美观的消息气泡设计

### 快捷菜单
- **经典菜谱**: 红烧肉、麻婆豆腐、宫保鸡丁等
- **食材料理**: 豆腐、鸡蛋、土豆等食材的多种做法
- **搭配推荐**: 早餐、午餐、晚餐的营养搭配

### 用户体验
- 自适应消息输入框，支持多行输入
- 优雅的加载动画和过渡效果
- 自动滚动到最新消息
- 快捷键支持 (Enter发送, Shift+Enter换行)

## 🚀 快速开始

### 安装依赖
```bash
cd src/web
npm install
```

### 启动开发服务器
```bash
npm run dev
```
访问 http://localhost:3000

### 构建生产版本
```bash
npm run build
```

### 预览构建结果
```bash
npm run preview
```

## 📁 项目结构

```
src/web/
├── src/
│   ├── components/          # 可复用组件
│   │   ├── MessageBubble.tsx    # 消息气泡
│   │   ├── QuickActionCard.tsx  # 快捷操作卡片
│   │   ├── LoadingIndicator.tsx # 加载指示器
│   │   └── ChatInput.tsx        # 聊天输入框
│   ├── data/               # 数据配置
│   │   └── quickActions.ts     # 快捷菜单配置
│   ├── lib/                # 工具函数
│   │   ├── api.ts             # API封装
│   │   └── utils.ts           # 通用工具
│   ├── types/              # 类型定义
│   │   └── index.ts           # 接口定义
│   ├── App.tsx             # 主应用组件
│   ├── main.tsx            # 应用入口
│   └── index.css           # 全局样式
├── public/
│   └── chef.svg            # 应用图标
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 🎨 快捷菜单配置

快捷菜单分为三大类别：

### 经典菜谱
- 红烧肉怎么做
- 麻婆豆腐制作
- 宫保鸡丁做法
- 糖醋里脊

### 食材料理
- 豆腐菜谱
- 鸡蛋料理
- 土豆菜品
- 西红柿菜谱

### 搭配推荐
- 早餐吃什么
- 午餐推荐  
- 晚餐建议
- 两人晚餐

## 🔌 API集成

应用通过以下端点与后端通信：

- **工作流执行**: `POST /api/workflows/intelligent-cooking-assistant-workflow/execute`
- **健康检查**: `GET /api/health`

支持普通HTTP请求和流式传输两种模式。

## 💡 自定义快捷菜单

编辑 `src/data/quickActions.ts` 文件来添加或修改快捷菜单项：

```typescript
{
  id: 'unique-id',
  title: '显示标题',
  description: '描述信息',
  query: '发送给AI的查询内容',
  icon: '🍳',  // emoji图标
  category: 'single' | 'ingredient' | 'combination',
  color: 'bg-green-500'  // Tailwind CSS颜色类
}
```

## 🎯 开发说明

### 代理配置
开发环境下，Vite会自动将`/api`请求代理到`http://localhost:4112`，确保后端服务正在运行。

### 环境要求
- Node.js >= 18
- 后端服务运行在端口4112

### 构建优化
- 使用Vite的快速热更新
- TypeScript严格模式
- Tailwind CSS的JIT编译
- 自动代码分割和懒加载

## 🔧 配置说明

主要配置文件：
- `vite.config.ts` - Vite构建配置和代理设置
- `tailwind.config.js` - 样式系统配置
- `tsconfig.json` - TypeScript编译配置

## 📈 性能优化

- 使用React.memo优化组件渲染
- 流式传输减少首次响应时间
- CSS按需加载和提取
- 图片和静态资源优化

---

享受智能烹饪的乐趣！🍳✨