const {
    runWithRequestContext,
    getRequestContext,
    getRequestTransaction,
} = require('../src/config/requestContext');

describe('request context utility', () => {
    it('returns null context outside request scope', () => {
        expect(getRequestContext()).toBeNull();
        expect(getRequestTransaction()).toBeNull();
    });

    it('stores and retrieves context values inside scope', async () => {
        const trx = { id: 'trx-1' };

        await runWithRequestContext({ trx, tenantId: 'tenant-1' }, async () => {
            await Promise.resolve();
            expect(getRequestContext()).toEqual({ trx, tenantId: 'tenant-1' });
            expect(getRequestTransaction()).toBe(trx);
        });

        expect(getRequestContext()).toBeNull();
        expect(getRequestTransaction()).toBeNull();
    });
});