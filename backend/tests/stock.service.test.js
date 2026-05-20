const StockService = require('../src/services/stock.service');

describe('StockService.adjustStock', () => {
    let service;

    beforeEach(() => {
        service = new StockService({}, 'tenant-1');
    });

    it('uses DAMAGE movement for negative damage adjustments', async () => {
        service.consumeStockFifo = jest.fn().mockResolvedValue({
            shortage: 0,
            avgCost: 45,
        });
        service.createMovement = jest.fn().mockResolvedValue({ id: 'mv-1' });

        await service.adjustStock({
            product_id: 'prod-1',
            quantity: -5,
            adjustment_reason: 'damage',
            created_by: 'u-1',
            notes: 'Damaged stock',
        });

        expect(service.consumeStockFifo).toHaveBeenCalledWith('prod-1', 5, {});
        expect(service.createMovement).toHaveBeenCalledWith(
            expect.objectContaining({
                movement_type: 'DAMAGE',
                quantity: 5,
                unit_cost: 45,
                reference_type: 'adjustment',
            }),
            {}
        );
    });

    it('throws when negative adjustment exceeds available stock', async () => {
        service.consumeStockFifo = jest.fn().mockResolvedValue({
            shortage: 2,
            avgCost: 20,
        });
        service.createMovement = jest.fn();

        await expect(service.adjustStock({
            product_id: 'prod-1',
            quantity: -5,
            adjustment_reason: 'shrinkage',
            created_by: 'u-1',
        })).rejects.toThrow('Insufficient stock to adjust. Shortage: 2');

        expect(service.createMovement).not.toHaveBeenCalled();
    });

    it('uses ADJUSTMENT movement for positive adjustments', async () => {
        service.consumeStockFifo = jest.fn();
        service.createMovement = jest.fn().mockResolvedValue({ id: 'mv-2' });

        await service.adjustStock({
            product_id: 'prod-1',
            quantity: 7,
            created_by: 'u-1',
            notes: 'Count correction',
        });

        expect(service.consumeStockFifo).not.toHaveBeenCalled();
        expect(service.createMovement).toHaveBeenCalledWith(
            expect.objectContaining({
                movement_type: 'ADJUSTMENT',
                quantity: 7,
                reference_type: 'adjustment',
            }),
            {}
        );
    });
});

describe('StockService.createMovement validations', () => {
    let service;

    beforeEach(() => {
        service = new StockService({}, 'tenant-1');
    });

    it('rejects invalid movement_type before DB access', async () => {
        await expect(service.createMovement({
            product_id: 'prod-1',
            movement_type: 'INVALID',
            reference_type: 'sale',
            quantity: 1,
            created_by: 'u-1',
        })).rejects.toThrow('Invalid stock movement_type: INVALID');
    });

    it('rejects invalid reference_type before DB access', async () => {
        await expect(service.createMovement({
            product_id: 'prod-1',
            movement_type: 'IN',
            reference_type: 'adjustment_reversal',
            quantity: 1,
            created_by: 'u-1',
        })).rejects.toThrow('Invalid stock reference_type: adjustment_reversal');
    });
});
