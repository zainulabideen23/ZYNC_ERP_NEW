jest.mock('uuid', () => ({
    v4: jest.fn(() => 'audit-id-1'),
}));

jest.mock('../src/utils/logger', () => ({
    error: jest.fn(),
}));

const logger = require('../src/utils/logger');
const audit = require('../src/utils/audit');

describe('audit utility', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('inserts audit log row with serialized values', async () => {
        const insert = jest.fn().mockResolvedValue(undefined);
        const db = jest.fn(() => ({ insert }));

        await audit(db, {
            userId: 'user-1',
            action: 'update',
            tableName: 'products',
            recordId: 'product-1',
            oldValues: { name: 'Old Name' },
            newValues: { name: 'New Name' },
            ip: '127.0.0.1',
            tenantId: 'tenant-1',
        });

        expect(db).toHaveBeenCalledWith('audit_logs');
        expect(insert).toHaveBeenCalledTimes(1);

        const payload = insert.mock.calls[0][0];
        expect(payload.id).toBe('audit-id-1');
        expect(payload.user_id).toBe('user-1');
        expect(payload.action).toBe('update');
        expect(payload.table_name).toBe('products');
        expect(payload.record_id).toBe('product-1');
        expect(payload.old_values).toBe(JSON.stringify({ name: 'Old Name' }));
        expect(payload.new_values).toBe(JSON.stringify({ name: 'New Name' }));
        expect(payload.ip_address).toBe('127.0.0.1');
        expect(payload.tenant_id).toBe('tenant-1');
        expect(payload.created_at).toBeInstanceOf(Date);
    });

    it('does not throw when audit write fails and logs the failure', async () => {
        const insert = jest.fn().mockRejectedValue(new Error('db write failed'));
        const db = jest.fn(() => ({ insert }));

        await expect(
            audit(db, {
                userId: null,
                action: 'login_failed',
                tableName: 'users',
                recordId: 'none',
                tenantId: 'tenant-1',
            })
        ).resolves.toBeUndefined();

        expect(logger.error).toHaveBeenCalledWith('Audit log failed:', 'db write failed');
    });
});