const express = require('express');
const router = express.Router();
const backupService = require('../services/backup.service');
const { authorize } = require('../middleware/auth');
const db = require('../config/database');
const audit = require('../utils/audit');

const isValidBackupFilename = (filename) => /^[a-zA-Z0-9._-]+\.sql$/.test(filename || '');

// List backups
router.get('/', authorize('admin'), async (req, res, next) => {
    try {
        const backups = await backupService.listBackups();
        res.json({ success: true, data: backups });
    } catch (error) {
        next(error);
    }
});

// Create backup
router.post('/', authorize('admin'), async (req, res, next) => {
    try {
        const backup = await backupService.createBackup();

        // Audit backup creation
        try {
            await audit(db, {
                userId: req.user.id,
                action: 'create',
                tableName: 'backup',
                recordId: backup.filename || 'backup',
                newValues: { filename: backup.filename, created_at: new Date().toISOString() },
                ip: req.ip,
                tenantId: req.tenantId || req.user?.tenantId
            });
        } catch (e) { /* audit failure ok */ }

        res.status(201).json({ success: true, data: backup });
    } catch (error) {
        next(error);
    }
});

// Download backup
router.get('/:filename/download', authorize('admin'), (req, res, next) => {
    try {
        if (!isValidBackupFilename(req.params.filename)) {
            return res.status(400).json({ success: false, error: 'Invalid backup filename' });
        }

        const filePath = backupService.getBackupPath(req.params.filename);
        if (!filePath) {
            return res.status(404).json({ success: false, error: 'Backup not found' });
        }
        res.download(filePath);
    } catch (error) {
        next(error);
    }
});

// Delete backup
router.delete('/:filename', authorize('admin'), async (req, res, next) => {
    try {
        if (!isValidBackupFilename(req.params.filename)) {
            return res.status(400).json({ success: false, error: 'Invalid backup filename' });
        }

        await backupService.deleteBackup(req.params.filename);
        res.json({ success: true, message: 'Backup deleted' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
