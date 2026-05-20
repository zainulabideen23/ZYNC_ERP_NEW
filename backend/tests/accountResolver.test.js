const { resolveSystemAccounts } = require('../src/utils/accountResolver');

const buildDbMock = (rows) => {
    const chain = {
        where: jest.fn(),
        whereIn: jest.fn(),
        select: jest.fn(),
    };

    chain.where.mockReturnValue(chain);
    chain.whereIn.mockReturnValue(chain);
    chain.select.mockResolvedValue(rows);

    const db = jest.fn(() => chain);
    return { db, chain };
};

describe('resolveSystemAccounts', () => {
    it('resolves requested account codes into a code to id map', async () => {
        const { db, chain } = buildDbMock([
            { id: 'acc-1', code: '1001' },
            { id: 'acc-2', code: '2001' },
        ]);

        const result = await resolveSystemAccounts(db, 'tenant-1', ['1001', '2001']);

        expect(db).toHaveBeenCalledWith('accounts');
        expect(chain.where).toHaveBeenCalledWith('tenant_id', 'tenant-1');
        expect(chain.whereIn).toHaveBeenCalledWith('code', ['1001', '2001']);
        expect(chain.where).toHaveBeenCalledWith('is_active', true);
        expect(chain.select).toHaveBeenCalledWith('id', 'code');
        expect(result).toEqual({
            '1001': 'acc-1',
            '2001': 'acc-2',
        });
    });

    it('throws a descriptive error when one or more codes are missing', async () => {
        const { db } = buildDbMock([{ id: 'acc-1', code: '1001' }]);

        await expect(resolveSystemAccounts(db, 'tenant-22', ['1001', '2001'])).rejects.toThrow(
            'System accounts not found for tenant tenant-22: 2001. Run pending migrations to create missing accounts.'
        );
    });
});