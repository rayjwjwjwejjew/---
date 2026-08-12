# 盛开在谎言之上

一个用 `React + Vite + TypeScript` 写的悬疑向视觉小说项目。  
重点是把剧情演出、本地资产库和可持续扩展的路线系统结合起来。玩家可以直接游玩，作者也能在浏览器里管理背景、立绘、BGM、音效、角色语音和视频 CG。

## 在线体验

- GitHub Pages: [https://rayjwjwjwejjew.github.io/---/](https://rayjwjwjwejjew.github.io/---/)

## 当前功能

- 标题页、章节开场、全屏 CG、结尾页的完整流程
- 对话框打字机、自动播放、仅跳过已读、历史与选择回看
- 最近 200 步真实回滚，可跨选项重新选择
- 8 个本地存档槽与继续上次，保存路线变量、章节、场景和缩略图
- 鉴赏模式：章节选择、章节回放、路线回忆、图片与视频 CG 图鉴
- 路线脚本支持：`@set`、`@inc`、`@jump`、`@if`
- 资源管理面板支持背景、立绘、视频 CG、BGM、音效和角色语音
- 上传语音优先播放，可选浏览器中文朗读，自动播放会等待语音结束
- 场景背景覆盖：可以给某个场景单独绑定背景资源
- 字体缩放、行距、高对比度、易读字体、减少动态和转场等级
- JSON 快速备份与带 SHA-256 校验的完整素材 ZIP 备份
- 资源完整性检查、PWA 安装、按需缓存和完整离线素材包
- 粒子默认关闭，普通背景直接切换，关键场景才转场

## 操作方式

- `空格 / Enter`：下一句（标题页可直接开始）
- `Backspace`：回上一句
- `L`：开关历史记录
- `S`：快速存档
- `Esc`：关闭面板 / 弹层

## 本地开发

```bash
npm install
npm run dev
```

默认开发地址：

- `http://localhost:5173/`（端口被占用时 Vite 会自动切换）

## 构建与校验

```bash
npm run test    # 核心状态、迁移、跳过、路线和回滚测试
npm run validate:vn # 剧情标签、跳转和内置资源校验
npm run check   # 类型、测试、资源校验与生产构建
npm run build   # 生产构建
npm run preview # 预览构建结果
```

## 项目结构（主工程）

```text
src/
  App.tsx                   # 页面编排与模块连接
  engine.ts                 # 剧情脚本、场景和角色解析
  script.ts                 # 正文剧情
  vnRuntime.ts              # 播放、背景、音频和存档运行时
  vnState.ts                # 稳定 ID、路线命令、永久进度和回滚内核
  vnProgress.ts             # React 剧情状态适配层
  vnVoice.ts                # 上传语音与浏览器朗读
  vnBackup.ts               # JSON / ZIP 备份与校验恢复
  vnExtras.tsx              # 懒加载鉴赏界面
  vnOffline.ts              # 完整离线素材包
  vnValidation.ts           # 浏览器内资源体检
  db.ts                     # IndexedDB 资源存取
scripts/
  validate-vn.mjs           # 剧情与资源检查脚本
```

## 数据存储说明

- 资源文件（背景/BGM/CG 等）存储在浏览器 `IndexedDB`
- 设定、存档、已读、章节/CG 解锁、路线检查点存储在 `localStorage`
- 数据格式为 v3，仍兼容旧 v1/v2 本地存档
- 清理浏览器站点数据会导致本地资源与存档丢失
- 建议定期在设置页导出完整 ZIP 备份

## GitHub Pages 部署

仓库已配置 Actions 自动部署（`main` 分支推送后自动构建并发布）：

- workflow: `.github/workflows/deploy-pages.yml`

## 说明

玩家功能和低频工具采用独立分包；鉴赏、备份、资源检查和离线管理只在打开时加载，不进入首屏常驻运行时。
