# PulseCoreLite

PulseCoreLite 是一个基于 Tauri + Vue 3 的桌面性能监控应用，提供悬浮窗监控与任务栏监控两种形态，实时展示 CPU、GPU、内存、磁盘与网络等指标。

## 功能特性
- 悬浮窗监控面板，支持拖拽与透明度调整
- 任务栏监控条，支持常驻置顶与快捷配置
- 实时遥测采集与刷新率调节
- 自动启动、最小化到托盘、记住位置等系统级设置
- 中英双语界面

## 技术栈
- 前端：Vue 3、Vite、Pinia、Vue I18n
- 桌面端：Tauri 2
- 后端：Rust（sysinfo、windows-sys）

## 运行与构建

### 安装依赖

```bash
npm install
```

### 前端开发（浏览器）

```bash
npm run dev
```

### Tauri 开发（桌面）

```bash
npm run tauri:dev
```

### 前端构建

```bash
npm run build
```

### Tauri 构建

```bash
npm run tauri:build
```

### Windows 一键打包

```bash
npm run pack:release
```

## 目录结构
- src：前端代码
  - pages：主悬浮窗与任务栏监控页面
  - components：监控面板与配置组件
  - composables：监控数据与窗口行为逻辑
  - stores：全局状态与设置存储
  - services：Tauri 调用封装
- src-tauri：Tauri 后端（Rust）
  - core：硬件与系统信息采集
  - ipc：命令与前端通信

## 运行环境
- Windows 桌面环境（自动启动与任务栏能力基于 Windows API）
- Node.js 与 Rust 工具链（Tauri 构建所需）

## 版本
- 前端版本：见 package.json
- Tauri 版本：见 src-tauri/Cargo.toml

