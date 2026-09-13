const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to database (file-based)
const dbPath = path.resolve(__dirname, 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Could not connect to database', err);
    } else {
        console.log('Connected to SQLite database');
        initTables();
    }
});

function initTables() {
    db.serialize(() => {
        // Users Table - 用户表
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // User Data Table - 用户数据表（每个用户的数据隔离存储）
        db.run(`CREATE TABLE IF NOT EXISTS user_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            key TEXT NOT NULL,
            value TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, key),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Backup Config Table - 备份配置表
        db.run(`CREATE TABLE IF NOT EXISTS backup_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            backup_type TEXT NOT NULL,
            config TEXT NOT NULL,
            enabled INTEGER DEFAULT 1,
            schedule TEXT,
            last_backup DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Backup History Table - 备份历史表
        db.run(`CREATE TABLE IF NOT EXISTS backup_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            backup_config_id INTEGER NOT NULL,
            backup_type TEXT NOT NULL,
            status TEXT NOT NULL,
            file_path TEXT,
            file_size INTEGER,
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (backup_config_id) REFERENCES backup_configs(id) ON DELETE CASCADE
        )`);

        // Sessions Table - 会话表
        db.run(`CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Create indexes for sessions table
        db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`);

        // Original app_data table for backward compatibility
        db.run(`CREATE TABLE IF NOT EXISTS app_data (
            key TEXT PRIMARY KEY,
            value TEXT
        )`);

        // Favicon disk cache (survives server restarts; filename-free, keyed by url hash)
        db.run(`CREATE TABLE IF NOT EXISTS favicon_cache (
            url_key TEXT PRIMARY KEY,
            content_type TEXT,
            body BLOB,
            saved_at INTEGER
        )`);

        // Create default admin user if users table is empty (使用同步方式，因为db.serialize已确保顺序执行)
        db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
            if (err) {
                console.error('Error checking users table:', err);
                return;
            }
            if (row && row.count === 0) {
                // users 表为空，创建默认 admin 用户
                try {
                    const bcrypt = require('bcryptjs');
                    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin';
                    const passwordHash = bcrypt.hashSync(defaultPassword, 10);
                    db.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", 
                        ['admin', passwordHash, 'admin'], (err) => {
                            if (err) {
                                console.error('Error creating admin user:', err);
                            } else {
                                console.log('Default admin user created. Username: admin, Password: ' + defaultPassword);
                            }
                        });
                } catch (error) {
                    console.error('Error initializing admin user:', error);
                }
            } else {
                console.log('Users table already has data, skipping admin user creation');
            }
        });

        // Seed Default Data if empty (for backward compatibility)
        db.get("SELECT value FROM app_data WHERE key = 'bookmarks'", (err, row) => {
            if (!row) {
                const defaultBookmarks = [
                    {
                        category: "Daily",
                        items: [
                            { name: "Google", url: "https://google.com", icon: "🔍" },
                            { name: "GitHub", url: "https://github.com", icon: "🐙" }
                        ]
                    }
                ];
                db.run("INSERT INTO app_data (key, value) VALUES (?, ?)", ['bookmarks', JSON.stringify(defaultBookmarks)]);
            }
        });

        db.get("SELECT value FROM app_data WHERE key = 'dashboard_config'", (err, row) => {
            if (!row) {
                const defaultConfig = { showCpu: true, showRam: true, showStorage: true };
                db.run("INSERT INTO app_data (key, value) VALUES (?, ?)", ['dashboard_config', JSON.stringify(defaultConfig)]);
            }
        });
    });
}

// Helper wrappers
function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

module.exports = { db, get, all, run };
