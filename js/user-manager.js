/**
 * User Manager - 用户管理系统
 * 支持多用户、管理员分配账号、数据隔离
 */
class UserManager {
    constructor() {
        this.currentUser = null;
        this.API_BASE = '';
        // 认证结果缓存：一次页面加载内 /api/users/check-auth 只请求一次，登录/登出后失效
        this.authChecked = false;
        this.authResult = null;
        this.authInflight = null;
    }

    async login(username, password) {
        try {
            const response = await fetch(`${this.API_BASE}/api/users/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (data.success) {
                this.currentUser = data.user;
                this.authChecked = true;
                this.authResult = { isLoggedIn: true, user: data.user };
                return { success: true, user: data.user };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('[UserManager] Login error:', error);
            return { success: false, error: error.message };
        }
    }

    async logout() {
        try {
            await fetch(`${this.API_BASE}/api/users/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            this.currentUser = null;
            this.authChecked = false;
            this.authResult = null;
            return { success: true };
        } catch (error) {
            console.error('[UserManager] Logout error:', error);
            return { success: false, error: error.message };
        }
    }

    async checkAuth() {
        if (this.authChecked) {
            return this.authResult;
        }
        if (this.authInflight) return this.authInflight;

        this.authInflight = (async () => {
        try {
            const response = await fetch(`${this.API_BASE}/api/users/check-auth`, {
                credentials: 'include'
            });
            const data = await response.json();
            if (data.isLoggedIn) {
                this.currentUser = data.user;
            }
            this.authChecked = true;
            this.authResult = data;
            return data;
        } catch (error) {
            console.error('[UserManager] Check auth error:', error);
            return { isLoggedIn: false };
        }
        })();
        try { return await this.authInflight; } finally { this.authInflight = null; }
    }

    async createUser(username, password, role = 'user') {
        try {
            const response = await fetch(`${this.API_BASE}/api/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password, role })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('[UserManager] Create user error:', error);
            return { success: false, error: error.message };
        }
    }

    async listUsers() {
        try {
            const response = await fetch(`${this.API_BASE}/api/users`, {
                credentials: 'include'
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('[UserManager] List users error:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteUser(userId) {
        try {
            const response = await fetch(`${this.API_BASE}/api/users/${userId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('[UserManager] Delete user error:', error);
            return { success: false, error: error.message };
        }
    }

    async updateUser(userId, updates) {
        try {
            const response = await fetch(`${this.API_BASE}/api/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updates)
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('[UserManager] Update user error:', error);
            return { success: false, error: error.message };
        }
    }

    // 修改当前或指定用户密码（普通用户只能修改自己的密码）
    async changePassword(userId, oldPassword, newPassword) {
        try {
            if (!newPassword) {
                return { success: false, error: '新密码不能为空' };
            }

            const response = await fetch(`${this.API_BASE}/api/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                // Server validates oldPassword when changing the current user's password
                body: JSON.stringify({ password: newPassword, oldPassword })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('[UserManager] Change password error:', error);
            return { success: false, error: error.message };
        }
    }

    getCurrentUser() {
        return this.currentUser;
    }

    isAdmin() {
        return this.currentUser && this.currentUser.role === 'admin';
    }
}

const userManager = new UserManager();
window.userManager = userManager;
