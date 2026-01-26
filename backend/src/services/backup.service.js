const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

class BackupService {
    constructor() {
        this.backupDir = path.join(process.cwd(), 'backups');
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir);
        }
    }

    async createBackup() {
        return new Promise((resolve, reject) => {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `backup-${timestamp}.sql`;
            const filePath = path.join(this.backupDir, filename);

            // Get DB config from process.env via connection string or individual vars
            // Assuming DATABASE_URL is available or we use components
            // For pg_dump, we usually need the connection string or environment vars set.

            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl) {
                return reject(new Error('DATABASE_URL environment variable is not set.'));
            }

            // Command: pg_dump --dbname=postgresql://user:pass@host:port/db > filePath
            const cmd = `pg_dump "${dbUrl}" > "${filePath}"`;

            logger.info(`Starting database backup: ${filename}`);

            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    logger.error(`Backup failed: ${error.message}`);
                    return reject(error);
                }
                if (stderr && !stderr.includes('dumping contents')) {
                    logger.warn(`Backup stderr: ${stderr}`);
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
        const filePath = path.join(this.backupDir, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        throw new Error('File not found');
    }

    getBackupPath(filename) {
        const filePath = path.join(this.backupDir, filename);
        if (fs.existsSync(filePath)) {
            return filePath;
        }
        return null;
    }
}

module.exports = new BackupService();
