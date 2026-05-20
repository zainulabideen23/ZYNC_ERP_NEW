const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { URL } = require('url');
const logger = require('../utils/logger');

class BackupService {
    constructor() {
        this.backupDir = path.join(process.cwd(), 'backups');
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir);
        }
    }

    isSafeBackupFilename(filename) {
        const safeFilename = path.basename(filename || '');
        return safeFilename === filename && /^[a-zA-Z0-9._-]+\.sql$/.test(safeFilename);
    }

    getDatabaseConnectionDetails() {
        if (process.env.DATABASE_URL) {
            const parsed = new URL(process.env.DATABASE_URL);
            return {
                host: parsed.hostname,
                port: parsed.port || '5432',
                user: decodeURIComponent(parsed.username || ''),
                password: decodeURIComponent(parsed.password || ''),
                database: (parsed.pathname || '').replace(/^\//, ''),
            };
        }

        return {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || '5432',
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME,
        };
    }

    async createBackup() {
        return new Promise((resolve, reject) => {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `backup-${timestamp}.sql`;
            const filePath = path.join(this.backupDir, filename);

            const { host, port, user, password, database } = this.getDatabaseConnectionDetails();
            if (!host || !user || !database) {
                return reject(new Error('Database connection details are incomplete for backup.'));
            }

            const args = [
                '--format=plain',
                '--no-owner',
                '--no-privileges',
                '--host', host,
                '--port', String(port),
                '--username', user,
                '--file', filePath,
                database
            ];

            logger.info(`Starting database backup: ${filename}`);

            const child = spawn('pg_dump', args, {
                env: {
                    ...process.env,
                    PGPASSWORD: password || ''
                },
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let stderrOutput = '';
            child.stderr.on('data', (chunk) => {
                stderrOutput += chunk.toString();
            });

            child.on('error', (error) => {
                logger.error(`Backup failed: ${error.message}`);
                reject(error);
            });

            child.on('close', (code) => {
                if (code !== 0) {
                    const message = stderrOutput.trim() || `pg_dump exited with code ${code}`;
                    logger.error(`Backup failed: ${message}`);
                    return reject(new Error(message));
                }

                if (stderrOutput.trim()) {
                    logger.warn(`Backup stderr: ${stderrOutput.trim()}`);
                }

                logger.info(`Backup completed successfully: ${filename}`);

                const stats = fs.statSync(filePath);
                resolve({
                    filename,
                    size: stats.size,
                    createdAt: stats.birthtime,
                    path: filePath
                });
            });
        });
    }

    async listBackups() {
        const files = fs.readdirSync(this.backupDir);
        return files
            .filter(f => f.endsWith('.sql'))
            .map(f => {
                const stats = fs.statSync(path.join(this.backupDir, f));
                return {
                    filename: f,
                    size: stats.size,
                    createdAt: stats.birthtime
                };
            })
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    async deleteBackup(filename) {
        if (!this.isSafeBackupFilename(filename)) {
            throw new Error('Invalid backup filename');
        }

        const filePath = path.join(this.backupDir, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        throw new Error('File not found');
    }

    getBackupPath(filename) {
        if (!this.isSafeBackupFilename(filename)) {
            return null;
        }

        const filePath = path.join(this.backupDir, filename);
        if (fs.existsSync(filePath)) {
            return filePath;
        }
        return null;
    }
}

module.exports = new BackupService();
