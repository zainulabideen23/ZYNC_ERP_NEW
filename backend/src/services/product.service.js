const { AppError } = require('../middleware/errorHandler');
const StockService = require('./stock.service');

class ProductService {
    constructor(db, tenantId) {
        this.db = db;
        this.tenantId = tenantId;
        this.stockService = new StockService(db, tenantId);
    }

    /**
     * Get all products with filtering and pagination
     */
    async getAll(options = {}) {
        const {
            page = 1,
            limit = 50,
            search = '',
            category_id = null,
            active_only = true,
            is_deleted = false
        } = options;

        const offset = (page - 1) * limit;

        let query = this.db('products as p')
            .leftJoin('categories as c', 'p.category_id', 'c.id')
            .leftJoin('units as u', 'p.unit_id', 'u.id')
            .leftJoin('brands as b', 'p.brand_id', 'b.id')
            .select(
                'p.*',
                'c.name as category_name',
                'u.name as unit_name',
                'u.abbreviation as unit_abbr',
                'b.name as brand_name'
            )
            .where('p.is_deleted', is_deleted)
            .where('p.tenant_id', this.tenantId);

        if (active_only) {
            query = query.where('p.is_active', true);
        }

        if (search) {
            query = query.where((builder) => {
                builder
                    .whereILike('p.name', `%${search}%`)
                    .orWhereILike('p.code', `%${search}%`)
                    .orWhereILike('p.barcode', `%${search}%`);
            });
        }

        if (category_id) {
            query = query.where('p.category_id', category_id);
        }

        const totalQuery = this.db('products').where('is_deleted', is_deleted).where('tenant_id', this.tenantId);
        if (active_only) totalQuery.where('is_active', true);
        const [{ count }] = await totalQuery.count();

        const products = await query
            .orderBy('p.name')
            .limit(limit)
            .offset(offset);

        return {
            data: products,
            pagination: {
                total: parseInt(count),
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / limit)
            }
        };
    }

    /**
     * Get single product by ID
     */
    async getById(id) {
        const product = await this.db('products as p')
            .leftJoin('categories as c', 'p.category_id', 'c.id')
            .leftJoin('units as u', 'p.unit_id', 'u.id')
            .leftJoin('brands as b', 'p.brand_id', 'b.id')
            .select(
                'p.*',
                'c.name as category_name',
                'u.name as unit_name',
                'b.name as brand_name'
            )
            .where('p.id', id)
            .where('p.is_deleted', false)
            .where('p.tenant_id', this.tenantId)
            .first();

        if (!product) {
            throw new AppError('Product not found', 404);
        }

        return product;
    }

    /**
     * Create a new product
     */
    async create(data, userId) {
        const {
            code, barcode, name, description, category_id, unit_id, brand_id,
            cost_price, retail_price, wholesale_price, tax_rate,
            min_stock_level, track_stock, weight, dimensions,
            opening_stock = 0
        } = data;

        // Retail price must be greater than cost price
        if (retail_price <= cost_price) {
            throw new AppError('Retail price must be greater than cost price', 400);
        }

        return await this.db.transaction(async (trx) => {
            const [product] = await trx('products').insert({
                code: code.toUpperCase(),
                barcode: barcode || null,
                name,
                description,
                category_id,
                unit_id,
                brand_id: brand_id || null,
                cost_price,
                retail_price,
                wholesale_price: wholesale_price || null,
                tax_rate: tax_rate || 0,
                min_stock_level: min_stock_level || 0,
                track_stock: track_stock !== false,
                weight: weight || null,
                dimensions: dimensions || null,
                created_by: userId,
                current_stock: 0,
                tenant_id: this.tenantId
            }).returning('*');

            // Handle Opening Stock
            if (opening_stock > 0) {
                await this.stockService.createMovement({
                    product_id: product.id,
                    movement_type: 'IN',
                    reference_type: 'opening',
                    quantity: opening_stock,
                    unit_cost: cost_price,
                    notes: 'Opening Stock',
                    created_by: userId,
                }, trx);

                product.current_stock = opening_stock;
            }

            return product;
        });
    }

    /**
     * Update an existing product
     */
    async update(id, data, userId) {
        const {
            code, barcode, name, description, category_id, unit_id, brand_id,
            cost_price, retail_price, wholesale_price, tax_rate,
            min_stock_level, track_stock, is_active, weight, dimensions
        } = data;

        // Helper to handle empty strings for numeric fields
        const parseNumeric = (val) => {
            if (val === '' || val === null || val === undefined) return null;
            const num = parseFloat(val);
            return isNaN(num) ? null : num;
        };

        const parseInteger = (val) => {
            if (val === '' || val === null || val === undefined) return null;
            const num = parseInt(val);
            return isNaN(num) ? null : num;
        };

        // Parse numeric values
        const parsedCostPrice = parseNumeric(cost_price);
        const parsedRetailPrice = parseNumeric(retail_price);
        const parsedWholesalePrice = parseNumeric(wholesale_price);
        const parsedTaxRate = parseNumeric(tax_rate);
        const parsedMinStockLevel = parseInteger(min_stock_level);
        const parsedWeight = parseNumeric(weight);

        // Retail price must be greater than cost price if both provided
        if (parsedRetailPrice !== null && parsedCostPrice !== null && parsedRetailPrice <= parsedCostPrice) {
            throw new AppError('Retail price must be greater than cost price', 400);
        }

        // Build update object, only including defined non-undefined values
        const updateData = {
            updated_by: userId,
            updated_at: new Date()
        };

        if (code !== undefined) updateData.code = code ? code.toUpperCase() : code;
        if (barcode !== undefined) updateData.barcode = barcode || null;
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description || null;
        if (category_id !== undefined) updateData.category_id = category_id;
        if (unit_id !== undefined) updateData.unit_id = unit_id;
        if (brand_id !== undefined) updateData.brand_id = brand_id || null;
        if (cost_price !== undefined) updateData.cost_price = parsedCostPrice;
        if (retail_price !== undefined) updateData.retail_price = parsedRetailPrice;
        if (wholesale_price !== undefined) updateData.wholesale_price = parsedWholesalePrice;
        if (tax_rate !== undefined) updateData.tax_rate = parsedTaxRate !== null ? parsedTaxRate : 0;
        if (min_stock_level !== undefined) updateData.min_stock_level = parsedMinStockLevel !== null ? parsedMinStockLevel : 0;
        if (track_stock !== undefined) updateData.track_stock = track_stock;
        if (is_active !== undefined) updateData.is_active = is_active;
        if (weight !== undefined) updateData.weight = parsedWeight;
        if (dimensions !== undefined) updateData.dimensions = dimensions || null;

        const [product] = await this.db('products')
            .where({ id, is_deleted: false, tenant_id: this.tenantId })
            .update(updateData)
            .returning('*');

        if (!product) {
            throw new AppError('Product not found', 404);
        }

        return product;
    }

    /**
     * Soft delete a product
     */
    async delete(id, userId) {
        const [product] = await this.db('products')
            .where({ id, is_deleted: false, tenant_id: this.tenantId })
            .update({
                is_deleted: true,
                deleted_at: new Date(),
                updated_by: userId,
                updated_at: new Date()
            })
            .returning('*');

        if (!product) {
            throw new AppError('Product not found or already deleted', 404);
        }

        return product;
    }

    async getCostHistory(id, options = {}) {
        const {
            limit = 100,
            from_date = null,
            to_date = null,
        } = options;

        const normalizedLimit = Number(limit) > 0 ? Math.min(Number(limit), 500) : 100;

        const product = await this.getById(id);

        const query = this.db('purchase_items as pi')
            .join('purchases as p', function joinPurchases() {
                this.on('p.id', '=', 'pi.purchase_id').andOn('p.tenant_id', '=', 'pi.tenant_id');
            })
            .leftJoin('suppliers as s', function joinSuppliers() {
                this.on('s.id', '=', 'p.supplier_id').andOn('s.tenant_id', '=', 'p.tenant_id');
            })
            .select(
                'pi.id as purchase_item_id',
                'p.id as purchase_id',
                'p.bill_number',
                'p.purchase_date',
                'p.reference_number',
                'p.status as purchase_status',
                'pi.quantity',
                'pi.unit_cost',
                this.db.raw('(COALESCE(pi.quantity, 0) * COALESCE(pi.unit_cost, 0)) as line_cost'),
                's.id as supplier_id',
                's.name as supplier_name',
                'pi.created_at'
            )
            .where('pi.tenant_id', this.tenantId)
            .where('p.tenant_id', this.tenantId)
            .where('pi.product_id', id)
            .where('p.is_deleted', false)
            .where((builder) => builder.whereNull('p.is_return').orWhere('p.is_return', false));

        if (from_date) query.where('p.purchase_date', '>=', from_date);
        if (to_date) query.where('p.purchase_date', '<=', to_date);

        const rows = await query
            .orderBy('p.purchase_date', 'desc')
            .orderBy('pi.created_at', 'desc')
            .limit(normalizedLimit);

        const summary = rows.reduce((acc, row) => {
            const qty = Number(row.quantity || 0);
            const unitCost = Number(row.unit_cost || 0);

            acc.totalLines += 1;
            acc.totalQuantity += qty;
            acc.totalLineCost += qty * unitCost;

            if (acc.minCost === null || unitCost < acc.minCost) {
                acc.minCost = unitCost;
            }
            if (acc.maxCost === null || unitCost > acc.maxCost) {
                acc.maxCost = unitCost;
            }

            return acc;
        }, {
            totalLines: 0,
            totalQuantity: 0,
            totalLineCost: 0,
            minCost: null,
            maxCost: null,
        });

        const weightedAverage = summary.totalQuantity > 0
            ? summary.totalLineCost / summary.totalQuantity
            : 0;

        return {
            product,
            history: rows,
            summary: {
                total_lines: summary.totalLines,
                total_quantity: Number(summary.totalQuantity.toFixed(2)),
                min_unit_cost: summary.minCost === null ? null : Number(summary.minCost.toFixed(2)),
                max_unit_cost: summary.maxCost === null ? null : Number(summary.maxCost.toFixed(2)),
                weighted_avg_unit_cost: Number(weightedAverage.toFixed(2)),
                latest_unit_cost: rows.length > 0 ? Number(Number(rows[0].unit_cost || 0).toFixed(2)) : null,
            },
        };
    }
}

module.exports = ProductService;
