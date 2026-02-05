const { AppError } = require('../middleware/errorHandler');

class ProductService {
    constructor(db) {
        this.db = db;
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
            .select(
                'p.*',
                'c.name as category_name',
                'u.name as unit_name',
                'u.abbreviation as unit_abbr'
            )
            .where('p.is_deleted', is_deleted);

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

        const totalQuery = this.db('products').where('is_deleted', is_deleted);
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
            .select(
                'p.*',
                'c.name as category_name',
                'u.name as unit_name'
            )
            .where('p.id', id)
            .where('p.is_deleted', false)
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
            code, barcode, name, description, category_id, unit_id,
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
                cost_price,
                retail_price,
                wholesale_price: wholesale_price || null,
                tax_rate: tax_rate || 0,
                min_stock_level: min_stock_level || 0,
                track_stock: track_stock !== false,
                weight: weight || null,
                dimensions: dimensions || null,
                created_by: userId,
                current_stock: 0 // Will be updated by movements
            }).returning('*');

            // Handle Opening Stock
            if (opening_stock > 0) {
                await trx('stock_movements').insert({
                    product_id: product.id,
                    movement_type: 'IN',
                    reference_type: 'opening',
                    quantity: opening_stock,
                    unit_cost: cost_price,
                    remaining_qty: opening_stock,
                    created_by: userId,
                    notes: 'Opening Stock'
                });

                // Update current_stock in products table
                await trx('products')
                    .where('id', product.id)
                    .update({ current_stock: opening_stock });

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
            code, barcode, name, description, category_id, unit_id,
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
            .where({ id, is_deleted: false })
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
            .where({ id, is_deleted: false })
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
}

module.exports = ProductService;
