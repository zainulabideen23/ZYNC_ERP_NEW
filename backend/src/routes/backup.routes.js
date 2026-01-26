const express = require('express');
const router = express.Router();
const backupService = require('../services/backup.service');
const { authenticate, authorize } = require('../middleware/auth');
const path = require('path');

// List backups
router.get('/', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const backups = await backupService.listBackups();
        res.json({ success: true, data: backups });
    } catch (error) {
        next(error);
    }
});

// Create backup
router.post('/', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const backup = await backupService.createBackup();
        res.status(201).json({ success: true, data: backup });
    } catch (error) {
        next(error);
    }
});

// Download backup
router.get('/:filename/download', authenticate, authorize('admin'), (req, res, next) => {
    try {
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
router.delete('/:filename', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        await backupService.deleteBackup(req.params.filename);
        res.json({ success: true, message: 'Backup deleted' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
