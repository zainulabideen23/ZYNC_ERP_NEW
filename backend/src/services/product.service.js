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
            brand_id = null,
            is_active,
            track_stock,
            low_stock = false,
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

        if (is_active !== undefined) {
            query = query.where('p.is_active', is_active);
        } else if (active_only) {
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

        if (brand_id) {
            query = query.where('p.brand_id', brand_id);
        }

        if (track_stock !== undefined) {
            query = query.where('p.track_stock', track_stock);
        }

        if (low_stock) {
            query = query.whereRaw('COALESCE(p.current_stock, 0) < COALESCE(p.min_stock_level, 0)');
        }

        const totalQuery = this.db('products').where('is_deleted', is_deleted).where('tenant_id', this.tenantId);
        if (is_active !== undefined) {
            totalQuery.where('is_active', is_active);
        } else if (active_only) {
            totalQuery.where('is_active', true);
        }
        if (category_id) totalQuery.where('category_id', category_id);
        if (brand_id) totalQuery.where('brand_id', brand_id);
        if (track_stock !== undefined) totalQuery.where('track_stock', track_stock);
        if (low_stock) totalQuery.whereRaw('COALESCE(current_stock, 0) < COALESCE(min_stock_level, 0)');
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

    async importProducts(fileBuffer, userId) {
        const XLSX = require('xlsx');

        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

        if (rows.length > 2000) {
            throw new AppError('Import file exceeds the maximum of 2000 rows', 400);
        }

        const COLUMN_MAP = {
            'product name': 'product_name',
            'sku': 'sku',
            'code': 'sku',
            'product code': 'sku',
            'item code': 'sku',
            'barcode': 'barcode',
            'category': 'category',
            'brand': 'brand',
            'unit': 'unit',
            'cost price': 'cost_price',
            'cost': 'cost_price',
            'unit cost': 'cost_price',
            'purchase price': 'cost_price',
            'retail price': 'retail_price',
            'price': 'retail_price',
            'selling price': 'retail_price',
            'mrp': 'retail_price',
            'wholesale price': 'wholesale_price',
            'tax rate': 'tax_rate',
            'tax rate %': 'tax_rate',
            'opening stock': 'opening_stock',
            'opening qty': 'opening_stock',
            'initial stock': 'opening_stock',
            'min stock level': 'min_stock_level',
            'reorder qty': 'reorder_qty',
            'track stock': 'track_stock',
            'description': 'description'
        };

        const normalizeRow = (raw) => {
            const row = {};
            for (const [key, value] of Object.entries(raw)) {
                const normalizedKey = COLUMN_MAP[key.trim().toLowerCase()];
                if (normalizedKey) {
                    row[normalizedKey] = value != null ? String(value).trim() : '';
                }
            }
            return row;
        };

        const isEmptyRow = (row) => Object.values(row).every(v => v === '' || v === null || v === undefined);

        const parseBoolean = (val) => {
            if (!val || val === '') return true;
            const s = val.toLowerCase().trim();
            if (['yes', 'true', '1', 'y'].includes(s)) return true;
            if (['no', 'false', '0', 'n'].includes(s)) return false;
            return null;
        };

        const parseNumeric = (val) => {
            if (val === null || val === undefined || val === '') return null;
            if (typeof val === 'number' && !isNaN(val)) return val;
            let s = String(val).trim();
            s = s.replace(/[₹$€£¥]/g, '').trim();
            if (!s) return null;
            if (s.includes(',') && s.includes('.')) {
                const lastComma = s.lastIndexOf(',');
                const lastDot = s.lastIndexOf('.');
                if (lastComma > lastDot) {
                    s = s.replace(/\./g, '').replace(',', '.');
                } else {
                    s = s.replace(/,/g, '');
                }
            } else if (s.includes(',')) {
                s = s.replace(',', '.');
            }
            const num = parseFloat(s);
            return isNaN(num) ? null : num;
        };

        const [existingProducts, categories, brands, units] = await Promise.all([
            this.db('products')
                .where('tenant_id', this.tenantId)
                .where('is_deleted', false)
                .select('code'),
            this.db('categories')
                .where('tenant_id', this.tenantId)
                .select('id', 'name'),
            this.db('brands')
                .where('tenant_id', this.tenantId)
                .select('id', 'name'),
            this.db('units')
                .where('tenant_id', this.tenantId)
                .select('id', 'name', 'abbreviation')
        ]);

        const existingSKUs = new Set(existingProducts.map(p => p.code.toUpperCase()));
        const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), { id: c.id, originalName: c.name, needsCreate: false }]));
        const brandMap = new Map(brands.map(b => [b.name.toLowerCase(), { id: b.id, originalName: b.name, needsCreate: false }]));
        const unitByNameMap = new Map(units.map(u => [u.name.toLowerCase(), u.id]));
        const unitByAbbrMap = new Map(units.filter(u => u.abbreviation).map(u => [u.abbreviation.toLowerCase(), u.id]));

        const skusInFile = new Set();
        const errors = [];
        const parsedRows = [];

        for (let i = 0; i < rows.length; i++) {
            const rowNum = i + 2;
            const row = normalizeRow(rows[i]);
            const rowErrors = [];

            if (isEmptyRow(row)) continue;

            if (!row.product_name) rowErrors.push('Product Name is required');

            if (!row.sku) {
                rowErrors.push('SKU is required');
            } else {
                const skuUpper = row.sku.toUpperCase();
                if (existingSKUs.has(skuUpper)) {
                    rowErrors.push(`SKU "${row.sku}" already exists in the system`);
                } else if (skusInFile.has(skuUpper)) {
                    rowErrors.push(`Duplicate SKU "${row.sku}" within the file`);
                } else {
                    skusInFile.add(skuUpper);
                }
            }

            if (!row.category) rowErrors.push('Category is required');
            if (!row.unit) rowErrors.push('Unit is required');

            if (row.category && !categoryMap.has(row.category.toLowerCase())) {
                categoryMap.set(row.category.toLowerCase(), { id: null, originalName: row.category, needsCreate: true });
            }

            if (row.brand && !brandMap.has(row.brand.toLowerCase())) {
                brandMap.set(row.brand.toLowerCase(), { id: null, originalName: row.brand, needsCreate: true });
            }

            let unitId = null;
            if (row.unit) {
                const unitKey = row.unit.toLowerCase();
                unitId = unitByNameMap.get(unitKey) || unitByAbbrMap.get(unitKey);
                if (!unitId) rowErrors.push(`Unit "${row.unit}" not found`);
            }

            const costPrice = parseNumeric(row.cost_price);
            const retailPrice = parseNumeric(row.retail_price);
            const wholesalePrice = parseNumeric(row.wholesale_price);
            const taxRate = parseNumeric(row.tax_rate);
            const openingStock = parseNumeric(row.opening_stock);
            const minStockLevel = parseNumeric(row.min_stock_level);
            const reorderQty = parseNumeric(row.reorder_qty);

            if (costPrice === null) rowErrors.push('Cost Price is required or invalid number');
            if (retailPrice === null) rowErrors.push('Retail Price is required or invalid number');
            if (costPrice !== null && costPrice < 0) rowErrors.push('Cost Price cannot be negative');
            if (retailPrice !== null && retailPrice < 0) rowErrors.push('Retail Price cannot be negative');
            if (costPrice !== null && retailPrice !== null && retailPrice <= costPrice) {
                rowErrors.push('Retail Price must be greater than Cost Price');
            }
            if (wholesalePrice !== null && wholesalePrice < 0) rowErrors.push('Wholesale Price cannot be negative');
            if (openingStock !== null && openingStock < 0) rowErrors.push('Opening Stock cannot be negative');
            if (minStockLevel !== null && minStockLevel < 0) rowErrors.push('Min Stock Level cannot be negative');
            if (reorderQty !== null && reorderQty < 0) rowErrors.push('Reorder Qty cannot be negative');
            if (taxRate !== null && (taxRate < 0 || taxRate > 100)) rowErrors.push('Tax Rate must be between 0 and 100');

            const trackStock = parseBoolean(row.track_stock);
            if (trackStock === null) rowErrors.push(`Invalid Track Stock value "${row.track_stock}". Accepted: yes/no, true/false, 1/0, y/n`);

            if (rowErrors.length > 0) {
                errors.push({
                    row: rowNum,
                    product: row.product_name || row.sku || '(unknown)',
                    errors: rowErrors
                });
            } else {
                parsedRows.push({
                    code: row.sku.toUpperCase(),
                    barcode: row.barcode || null,
                    name: row.product_name,
                    description: row.description || null,
                    category_id: null,
                    brand_id: null,
                    unit_id: unitId,
                    cost_price: costPrice,
                    retail_price: retailPrice,
                    wholesale_price: wholesalePrice,
                    tax_rate: taxRate || 0,
                    opening_stock: openingStock || 0,
                    min_stock_level: minStockLevel || 0,
                    reorder_qty: reorderQty || null,
                    track_stock: trackStock,
                    _category_name: row.category,
                    _brand_name: row.brand || null
                });
            }
        }

        if (parsedRows.length === 0) {
            return { imported: 0, total: rows.length, skipped: errors.length, errors };
        }

        const createdProducts = [];
        await this.db.transaction(async (trx) => {
            for (const [, cat] of categoryMap) {
                if (cat.needsCreate && cat.id === null) {
                    const maxSeq = await trx('categories')
                        .where('tenant_id', this.tenantId)
                        .max('sequence_order as max')
                        .first();
                    const sequence_order = (maxSeq?.max || 0) + 10;
                    const [newCat] = await trx('categories').insert({
                        name: cat.originalName,
                        parent_id: null,
                        sequence_order,
                        created_by: userId,
                        tenant_id: this.tenantId
                    }).returning('*');
                    cat.id = newCat.id;
                }
            }

            for (const [, brand] of brandMap) {
                if (brand.needsCreate && brand.id === null) {
                    const [newBrand] = await trx('brands').insert({
                        name: brand.originalName,
                        created_by: userId,
                        tenant_id: this.tenantId
                    }).returning('*');
                    brand.id = newBrand.id;
                }
            }

            for (const row of parsedRows) {
                row.category_id = categoryMap.get(row._category_name.toLowerCase())?.id;
                if (row._brand_name) {
                    const be = brandMap.get(row._brand_name.toLowerCase());
                    if (be) row.brand_id = be.id;
                }
            }

            for (const row of parsedRows) {
                const [product] = await trx('products').insert({
                    code: row.code,
                    barcode: row.barcode,
                    name: row.name,
                    description: row.description,
                    category_id: row.category_id,
                    unit_id: row.unit_id,
                    brand_id: row.brand_id,
                    cost_price: row.cost_price,
                    retail_price: row.retail_price,
                    wholesale_price: row.wholesale_price,
                    tax_rate: row.tax_rate,
                    min_stock_level: row.min_stock_level,
                    reorder_qty: row.reorder_qty,
                    track_stock: row.track_stock,
                    current_stock: 0,
                    created_by: userId,
                    tenant_id: this.tenantId
                }).returning('*');

                if (row.opening_stock > 0) {
                    await this.stockService.createMovement({
                        product_id: product.id,
                        movement_type: 'IN',
                        reference_type: 'opening',
                        quantity: row.opening_stock,
                        unit_cost: row.cost_price,
                        notes: 'Opening Stock (Import)',
                        created_by: userId,
                    }, trx);
                }

                createdProducts.push(product);
            }
        });

        return { imported: createdProducts.length, total: rows.length, skipped: errors.length, errors };
    }
}

module.exports = ProductService;
