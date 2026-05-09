// ==UserScript==
// @name         Jira 账号切换器
// @namespace    http://tampermonkey.net/
// @version      2.7
// @description  在 Jira 页面快速切换多个账号
// @author       You
// @match        https://tbjira.lenovo.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'jira_accounts';
    const SWITCH_KEY = 'jira_switch_target';
    const POSITION_KEY = 'jira_switcher_position';
    const JIRA_BASE = 'https://tbjira.xxxx.com';

    const Toast = {
        container: null,
        init() {
            this.container = document.createElement('div');
            this.container.id = 'jira-switcher-toast-container';
            const style = document.createElement('style');
            style.textContent = `
                #jira-switcher-toast-container {
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 2147483647;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .jira-toast {
                    padding: 14px 24px;
                    border-radius: 12px;
                    font-size: 14px;
                    font-weight: 500;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    animation: toastIn 0.3s ease;
                }
                .jira-toast.success { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; }
                .jira-toast.error { background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); color: white; }
                .jira-toast.info { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
                @keyframes toastIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes toastOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-20px); } }
            `;
            document.head.appendChild(style);
            document.body.appendChild(this.container);
        },
        show(message, type = 'success', duration = 3000) {
            if (!this.container) this.init();
            const toast = document.createElement('div');
            toast.className = `jira-toast ${type}`;
            const iconMap = { success: '✅', error: '❌', info: 'ℹ️' };
            toast.innerHTML = `<span>${iconMap[type]}</span><span>${message}</span>`;
            this.container.appendChild(toast);
            setTimeout(() => {
                toast.style.animation = 'toastOut 0.3s ease forwards';
                setTimeout(() => toast.remove(), 300);
            }, duration);
            return toast;
        },
        success(message) { return this.show(message, 'success'); },
        error(message) { return this.show(message, 'error'); },
        info(message) { return this.show(message, 'info'); }
    };

    const Storage = {
        getAccounts() { return GM_getValue(STORAGE_KEY, []); },
        saveAccount(account) {
            const accounts = this.getAccounts();
            const existingIndex = accounts.findIndex(a => a.username === account.username);
            if (existingIndex >= 0) {
                accounts[existingIndex] = account;
            } else {
                accounts.push(account);
            }
            GM_setValue(STORAGE_KEY, accounts);
        },
        deleteAccount(username) {
            const accounts = this.getAccounts().filter(a => a.username !== username);
            GM_setValue(STORAGE_KEY, accounts);
        },
        setSwitchTarget(account, returnUrl) {
            GM_setValue(SWITCH_KEY, { account, returnUrl, timestamp: Date.now() });
        },
        getSwitchTarget() { return GM_getValue(SWITCH_KEY, null); },
        clearSwitchTarget() { GM_deleteValue(SWITCH_KEY); },
        getPosition() { return GM_getValue(POSITION_KEY, { top: 110, right: 10 }); },
        setPosition(pos) { GM_setValue(POSITION_KEY, pos); }
    };

    function getCurrentUser() {
        const userMeta = document.querySelector('meta[name="ajs-remote-user"]');
        if (userMeta && userMeta.content) return userMeta.content;
        const userLink = document.querySelector('#header-details-user-fullname, a[data-username]');
        if (userLink) return userLink.dataset.username || userLink.textContent.trim();
        return null;
    }

    const UI = {
        container: null,
        panel: null,
        menuBtn: null,
        isPanelOpen: false,
        isDragging: false,
        init() {
            this.createContainer();
            this.createMenuButton();
            this.createPanel();
            this.updateButtonText();
            this.setupDrag();
        },
        updateButtonText() {
            const currentUser = getCurrentUser();
            const textSpan = this.menuBtn.querySelector('.btn-text');
            if (textSpan) textSpan.textContent = currentUser || '账号切换';
        },
        createContainer() {
            this.container = document.createElement('div');
            this.container.id = 'jira-account-switcher-root';
            document.body.appendChild(this.container);
            const shadow = this.container.attachShadow({ mode: 'open' });
            const style = document.createElement('style');
            style.textContent = `
                * { box-sizing: border-box; }
                .switcher-btn {
                    position: fixed;
                    z-index: 99999;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 50px;
                    padding: 10px 16px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.3s ease;
                    user-select: none;
                }
                .switcher-btn:hover { transform: scale(1.05); box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6); }
                .switcher-btn:active { transform: scale(0.98); }
                .switcher-btn.dragging { opacity: 0.8; cursor: grabbing; }
                .btn-icon { font-size: 20px; line-height: 1; }
                .btn-text { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .panel {
                    position: fixed;
                    z-index: 99998;
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.15);
                    width: 320px;
                    max-height: 500px;
                    overflow-y: auto;
                    display: none;
                    border: 1px solid #f0f0f0;
                }
                .panel.open { display: block; }
                .panel-header {
                    padding: 16px 20px;
                    border-bottom: 1px solid #f0f0f0;
                    font-weight: 700;
                    font-size: 17px;
                    color: #333;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border-radius: 16px 16px 0 0;
                }
                .panel-content { padding: 16px 20px; }
                .account-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 14px;
                    margin-bottom: 10px;
                    background: #f8f9ff;
                    border-radius: 10px;
                    border: 2px solid transparent;
                    transition: all 0.2s ease;
                }
                .account-item.current { border-color: #667eea; background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); }
                .account-info { flex: 1; }
                .account-username { font-weight: 600; color: #333; font-size: 14px; }
                .account-actions { display: flex; gap: 6px; }
                .btn { padding: 6px 12px; border: none; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s ease; }
                .btn-switch { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
                .btn-switch:hover { transform: translateY(-1px); box-shadow: 0 3px 10px rgba(102, 126, 234, 0.4); }
                .btn-delete { background: #ff6b6b; color: white; }
                .btn-delete:hover { background: #ff5252; transform: translateY(-1px); }
                .add-form { margin-top: 20px; padding-top: 20px; border-top: 1px solid #f0f0f0; }
                .form-title { font-weight: 600; margin-bottom: 14px; color: #333; font-size: 14px; }
                .form-group { margin-bottom: 14px; }
                .form-group label { display: block; margin-bottom: 6px; font-size: 12px; color: #666; font-weight: 500; }
                .form-group input {
                    width: 100%;
                    padding: 10px 14px;
                    border: 2px solid #e8e8e8;
                    border-radius: 10px;
                    font-size: 14px;
                    transition: border-color 0.2s ease;
                }
                .form-group input:focus { outline: none; border-color: #667eea; }
                .btn-add { width: 100%; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 12px; font-weight: 600; border-radius: 10px; }
                .btn-add:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(17, 153, 142, 0.4); }
                .empty-state { text-align: center; padding: 30px 20px; color: #999; }
                .empty-icon { font-size: 40px; margin-bottom: 10px; }
                .warning { padding: 12px 14px; background: #fff9e6; border: 1px solid #ffe066; border-radius: 10px; margin-bottom: 16px; font-size: 12px; color: #856404; }
                .current-label { font-size: 11px; color: #667eea; margin-top: 4px; font-weight: 600; }
                .accounts-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }
                .accounts-title {
                    font-weight: 600;
                    font-size: 14px;
                    color: #333;
                }
                .btn-clear-all {
                    background: #ff6b6b;
                    color: white;
                    padding: 4px 10px;
                    font-size: 12px;
                    border-radius: 6px;
                    border: none;
                    cursor: pointer;
                }
                .btn-clear-all:hover {
                    background: #ff5252;
                }
                .add-form-section {
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid #f0f0f0;
                }
                .add-form-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    cursor: pointer;
                    user-select: none;
                }
                .add-form-title {
                    font-weight: 600;
                    color: #333;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .add-form-toggle {
                    color: #667eea;
                    font-size: 18px;
                    transition: transform 0.2s ease;
                }
                .add-form-toggle.collapsed {
                    transform: rotate(-90deg);
                }
                .add-form-content {
                    margin-top: 14px;
                    overflow: hidden;
                    transition: max-height 0.3s ease;
                    max-height: 500px;
                }
                .add-form-content.collapsed {
                    max-height: 0;
                    margin-top: 0;
                }
            `;
            shadow.appendChild(style);
            this.shadowRoot = shadow;
        },
        createMenuButton() {
            const pos = Storage.getPosition();
            this.menuBtn = document.createElement('button');
            this.menuBtn.className = 'switcher-btn';
            this.menuBtn.innerHTML = `<span class="btn-icon">🐼</span><span class="btn-text">账号切换</span>`;
            this.menuBtn.style.top = pos.top + 'px';
            this.menuBtn.style.right = pos.right + 'px';
            this.menuBtn.onclick = (e) => { if (!this.isDragging) this.togglePanel(); };
            this.shadowRoot.appendChild(this.menuBtn);
        },
        createPanel() {
            const pos = Storage.getPosition();
            this.panel = document.createElement('div');
            this.panel.className = 'panel';
            this.panel.style.top = (pos.top + 60) + 'px';
            this.panel.style.right = pos.right + 'px';
            this.renderPanelContent();
            this.shadowRoot.appendChild(this.panel);
            document.addEventListener('click', (e) => {
                if (!this.container.contains(e.target) && this.isPanelOpen) this.closePanel();
            });
        },
        setupDrag() {
            const btn = this.menuBtn;
            const panel = this.panel;
            btn.addEventListener('mousedown', (e) => {
                this.isDragging = false;
                const startX = e.clientX;
                const startY = e.clientY;
                const startRight = window.innerWidth - btn.getBoundingClientRect().right;
                const startTop = btn.getBoundingClientRect().top;
                const onMouseMove = (moveEvent) => {
                    const dx = startX - moveEvent.clientX;
                    const dy = moveEvent.clientY - startY;
                    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                        this.isDragging = true;
                        btn.classList.add('dragging');
                    }
                    if (this.isDragging) {
                        const newRight = Math.max(10, Math.min(startRight + dx, window.innerWidth - 100));
                        const newTop = Math.max(10, Math.min(startTop + dy, window.innerHeight - 60));
                        btn.style.right = newRight + 'px';
                        btn.style.top = newTop + 'px';
                        panel.style.right = newRight + 'px';
                        panel.style.top = (newTop + 60) + 'px';
                    }
                };
                const onMouseUp = () => {
                    btn.classList.remove('dragging');
                    if (this.isDragging) Storage.setPosition({ top: parseInt(btn.style.top), right: parseInt(btn.style.right) });
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        },
        togglePanel() {
            this.isPanelOpen = !this.isPanelOpen;
            this.panel.classList.toggle('open', this.isPanelOpen);
            if (this.isPanelOpen) this.renderPanelContent();
        },
        closePanel() { this.isPanelOpen = false; this.panel.classList.remove('open'); },
        renderPanelContent() {
            const accounts = Storage.getAccounts();
            const currentUser = getCurrentUser();
            this.panel.innerHTML = `
                <div class="panel-header">🎫 Jira 账号管理</div>
                <div class="panel-content">
                    <div class="warning">⚠️ 密码将保存在浏览器本地，请注意安全</div>
                    ${accounts.length === 0 ? `
                        <div class="empty-state">
                            <div class="empty-icon">🐾</div>
                            <div>暂无保存的账号</div>
                        </div>
                    ` : `
                        <div class="accounts-header">
                            <span class="accounts-title">已保存账号 (${accounts.length})</span>
                            <button class="btn-clear-all" id="clear-all-btn">清除所有</button>
                        </div>
                        ${accounts.map(acc => `
                            <div class="account-item ${acc.username === currentUser ? 'current' : ''}">
                                <div class="account-info">
                                    <div class="account-username">${escapeHtml(acc.username)}</div>
                                    ${acc.username === currentUser ? '<div class="current-label">✅ 当前账号</div>' : ''}
                                </div>
                                <div class="account-actions">
                                    ${acc.username !== currentUser ? `<button class="btn btn-switch" data-username="${escapeHtml(acc.username)}">切换</button>` : ''}
                                    <button class="btn btn-delete" data-username="${escapeHtml(acc.username)}">删除</button>
                                </div>
                            </div>
                        `).join('')}
                    `}
                    <div class="add-form-section">
                        <div class="add-form-header" id="add-form-header">
                            <span class="add-form-title">➕ 添加新账号</span>
                            <span class="add-form-toggle collapsed" id="add-form-toggle">▼</span>
                        </div>
                        <div class="add-form-content collapsed" id="add-form-content">
                            <div class="form-group">
                                <label>用户名</label>
                                <input type="text" id="new-username" placeholder="输入用户名">
                            </div>
                            <div class="form-group">
                                <label>密码</label>
                                <input type="password" id="new-password" placeholder="输入密码">
                            </div>
                            <button class="btn btn-add" id="add-account-btn">保存账号</button>
                        </div>
                    </div>
                </div>
            `;
            this.panel.querySelectorAll('.btn-switch').forEach(btn => {
                btn.onclick = () => switchAccount(btn.dataset.username);
            });
            this.panel.querySelectorAll('.btn-delete').forEach(btn => {
                btn.onclick = () => { Storage.deleteAccount(btn.dataset.username); this.renderPanelContent(); };
            });
            const clearAllBtn = this.panel.querySelector('#clear-all-btn');
            if (clearAllBtn) {
                clearAllBtn.onclick = () => {
                    if (confirm('确定要清除所有保存的账号吗？')) {
                        GM_setValue(STORAGE_KEY, []);
                        this.renderPanelContent();
                        Toast.success('已清除所有账号！');
                    }
                };
            }
            this.panel.querySelector('#add-account-btn').onclick = () => {
                const usernameInput = this.panel.querySelector('#new-username');
                const passwordInput = this.panel.querySelector('#new-password');
                const username = usernameInput.value.trim();
                const password = passwordInput.value;
                if (username && password) {
                    Storage.saveAccount({ username, password });
                    usernameInput.value = ''; passwordInput.value = '';
                    this.renderPanelContent();
                    Toast.success('账号保存成功！');
                }
            };
            const addFormHeader = this.panel.querySelector('#add-form-header');
            const addFormContent = this.panel.querySelector('#add-form-content');
            const addFormToggle = this.panel.querySelector('#add-form-toggle');
            addFormHeader.onclick = () => {
                addFormContent.classList.toggle('collapsed');
                addFormToggle.classList.toggle('collapsed');
            };
            const inputs = this.panel.querySelectorAll('input');
            const stopEvents = ['keydown', 'keyup', 'keypress', 'input', 'paste', 'cut', 'copy'];
            inputs.forEach(input => {
                stopEvents.forEach(evt => input.addEventListener(evt, (e) => e.stopPropagation(), true));
            });
        }
    };

    function switchAccount(username) {
        const accounts = Storage.getAccounts();
        const account = accounts.find(a => a.username === username);
        if (!account) return;
        const currentUrl = window.location.href;
        Storage.setSwitchTarget(account, currentUrl);
        Toast.info(`正在切换到 ${username}...`);
        window.location.href = `${JIRA_BASE}/issue/login.jsp`;
    }

    let loginSubmitted = false;

    function fillAndSubmit(account, returnUrl) {
        if (loginSubmitted) {
            return true;
        }

        console.log('尝试自动登录...');

        const selectors = {
            userFields: ['#login-form-username', 'input[name="os_username"]', 'input[name="username"]', '#username', 'input[type="text"]'],
            passFields: ['#login-form-password', 'input[name="os_password"]', 'input[name="password"]', '#password', 'input[type="password"]'],
            submitBtns: ['#login-form-submit', 'button[name="login"]', 'input[type="submit"]', 'button[type="submit"]', '.login-button', 'button'],
            destFields: ['input[name="os_destination"]', 'input[name="redirect_to"]', 'input[name="destination"]']
        };

        let userField = null;
        let passField = null;
        let submitBtn = null;
        let destField = null;

        for (const sel of selectors.userFields) {
            const el = document.querySelector(sel);
            if (el) { userField = el; break; }
        }

        for (const sel of selectors.passFields) {
            const el = document.querySelector(sel);
            if (el) { passField = el; break; }
        }

        for (const sel of selectors.submitBtns) {
            const el = document.querySelector(sel);
            if (el && (el.textContent?.toLowerCase().includes('login') || el.value?.toLowerCase().includes('login') || el.type === 'submit')) {
                submitBtn = el;
                break;
            }
        }

        for (const sel of selectors.destFields) {
            const el = document.querySelector(sel);
            if (el) { destField = el; break; }
        }

        console.log('找到的元素:', { userField, passField, submitBtn, destField });

        if (userField && passField) {
            userField.value = account.username;
            userField.dispatchEvent(new Event('input', { bubbles: true }));
            userField.dispatchEvent(new Event('change', { bubbles: true }));

            passField.value = account.password;
            passField.dispatchEvent(new Event('input', { bubbles: true }));
            passField.dispatchEvent(new Event('change', { bubbles: true }));

            if (destField && returnUrl) {
                destField.value = returnUrl;
            }

            // 立即提交，减少等待时间
            loginSubmitted = true;
            if (submitBtn) {
                console.log('点击登录按钮');
                submitBtn.click();
            } else {
                const form = userField.closest('form');
                if (form) {
                    console.log('提交表单');
                    form.submit();
                }
            }

            return true;
        }

        return false;
    }

    function handleLoginPage() {
        const switchData = Storage.getSwitchTarget();
        if (!switchData) return;

        const { account, returnUrl } = switchData;

        // 立即清除switchData，防止重试！
        Storage.clearSwitchTarget();

        console.log('开始登录:', account.username);

        // 检查是否有错误提示，说明已经登录失败过
        const pageText = document.body.innerText || '';
        if (pageText.toLowerCase().includes('error') ||
            pageText.toLowerCase().includes('failed') ||
            pageText.toLowerCase().includes('invalid') ||
            pageText.toLowerCase().includes('wrong')) {
            console.log('检测到登录错误，直接返回');
            handleLoginFailed(account, returnUrl);
            return;
        }

        let submitted = false;

        function doLogin() {
            if (submitted) return;

            const success = fillAndSubmit(account, returnUrl);
            if (success) {
                submitted = true;
                console.log('登录表单已提交');
            }
        }

        // 尝试登录
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', doLogin);
        } else {
            doLogin();
        }

        // 用MutationObserver再尝试一下
        const observer = new MutationObserver(() => {
            if (!submitted) {
                doLogin();
            }
            if (submitted) {
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // 5秒后强制停止
        setTimeout(() => {
            observer.disconnect();
            if (!submitted) {
                console.log('登录超时');
                handleLoginFailed(account, returnUrl);
            }
        }, 5000);
    }

    function handleLoginFailed(account, returnUrl) {
        // 保存错误信息，等跳回去后提示
        GM_setValue('jira_login_failed', { username: account.username, timestamp: Date.now() });
        // 跳转回原页面
        if (returnUrl) {
            window.location.href = returnUrl;
        } else {
            window.history.back();
        }
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    if (window.location.pathname.includes('login.jsp')) {
        // 重置登录提交标志
        loginSubmitted = false;
        handleLoginPage();
    } else {
        // 重置登录提交标志
        loginSubmitted = false;
        UI.init();

        // 检查是否有登录失败的提示
        const loginFailed = GM_getValue('jira_login_failed', null);
        if (loginFailed && Date.now() - loginFailed.timestamp < 5000) {
            GM_deleteValue('jira_login_failed');
            Toast.error(`切换${loginFailed.username}账号失败，请更新${loginFailed.username}账号密码！`);
        }

        const switchData = Storage.getSwitchTarget();
        if (switchData) {
            // 等待页面完全加载后再检查登录状态
            function checkLoginStatus() {
                const currentUser = getCurrentUser();
                if (currentUser === switchData.account.username) {
                    Storage.clearSwitchTarget();
                    Toast.success(`成功切换到 ${switchData.account.username}！`);
                    UI.updateButtonText();
                    UI.renderPanelContent();
                } else if (currentUser) {
                    Storage.clearSwitchTarget();
                    Toast.error(`切换失败！当前账号还是 ${currentUser}，请检查密码是否正确`);
                } else {
                    // 如果还没获取到用户信息，稍等一下再试，最多等5秒
                    const elapsed = Date.now() - switchData.timestamp;
                    if (elapsed < 5000) {
                        setTimeout(checkLoginStatus, 200);
                    } else {
                        Storage.clearSwitchTarget();
                        Toast.error('切换超时，请重试！');
                    }
                }
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', checkLoginStatus);
            } else {
                checkLoginStatus();
            }
        }
    }
})();
