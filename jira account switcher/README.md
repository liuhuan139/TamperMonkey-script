# Jira 账号切换器

一个方便的油猴脚本，让您在 Jira 页面快速切换多个账号。

## 功能特性

- 🎫 **账号管理** - 添加、删除多个 Jira 账号
- 🔄 **快速切换** - 一键切换到不同账号，自动登录
- 🎨 **精美界面** - 现代化渐变 UI，美观易用
- 🖱️ **可拖拽按钮** - 悬浮按钮可自由拖动位置
- ⚡ **自动跳转** - 切换后自动返回原页面
- 🔔 **Toast 提示** - 操作反馈，友好提示

## 安装

### 前置要求

首先需要安装油猴脚本管理器：

- **Chrome/Edge**: [Tampermonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- **Firefox**: [Tampermonkey](https://addons.mozilla.org/firefox/addon/tampermonkey/)
- **Safari**: [Tampermonkey](https://apps.apple.com/app/tampermonkey/id1482490089)

### 安装脚本

1. 点击脚本管理器扩展图标
2. 选择「添加新脚本」
3. 将 `jira-account-switcher.user.js` 的内容复制粘贴进去
4. 保存（Ctrl+S 或 Cmd+S）

或者，如果你将本仓库部署到 GitHub/GitLab，也可以直接点击 raw 文件链接进行安装。

### 配置站点

脚本默认匹配 `https://tbjira.lenovo.com/*`，如需适配其他 Jira 站点，请修改脚本第 7 行的 `@match` 规则：

```javascript
// @match        https://your-jira-domain.com/*
```

同时修改第 19 行的 `JIRA_BASE` 变量：

```javascript
const JIRA_BASE = 'https://your-jira-domain.com';
```

## 使用说明

### 添加账号

1. 在 Jira 页面点击右侧的「账号切换」悬浮按钮
2. 点击「➕ 添加新账号」展开表单
3. 输入用户名和密码
4. 点击「保存账号」

### 切换账号

1. 点击悬浮按钮打开面板
2. 在已保存账号列表中，点击目标账号旁的「切换」按钮
3. 脚本会自动跳转到登录页面并完成登录
4. 登录成功后自动返回原页面

### 删除账号

1. 打开账号面板
2. 点击对应账号旁的「删除」按钮

### 清除所有账号

1. 打开账号面板
2. 点击「清除所有」按钮

### 移动按钮位置

- 直接拖拽悬浮按钮到页面任意位置，位置会自动保存

## 安全提示

⚠️ **重要**：

- 账号密码保存在浏览器本地存储（Tampermonkey 的 GM_setValue）
- 请确保您的电脑安全，不要在公共设备上使用
- 定期检查并移除不需要的账号
- 如账号密码变更，请及时更新

## 脚本原理

1. 使用 Shadow DOM 隔离 UI，避免与页面样式冲突
2. 切换时保存目标账号和当前页面 URL
3. 跳转到登录页后自动填充表单并提交
4. 登录成功后跳转回原页面
5. 检测当前登录用户，确认切换成功

## 文件结构

```
.
├── jira-account-switcher.user.js    # 主脚本文件
└── README.md                        # 本说明文件
```

## 版本历史

- **v2.7** - 当前版本，支持自动登录、拖拽按钮、Toast 提示等

## 开发

欢迎提交 Issue 和 Pull Request！

### 本地开发

1. Fork 本仓库
2. 修改脚本
3. 在浏览器中测试
4. 提交 PR

## 许可证

MIT License

## 免责声明

本脚本仅供学习和个人使用，请遵守所在组织的 IT 安全政策。使用本脚本产生的任何后果由使用者自行承担。

---

如果这个脚本对你有帮助，请给个 Star ⭐ 支持一下！
