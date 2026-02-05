const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/config/database');

// Dummy products from dummy_data/dummy_products.json
const dummyProducts = [
    { productName: "Samsung 27\" 4K Monitor", sku: "MON-SAM-27K-BLK", barcode: "8806092968641", category: "Electronics", subCategory: "Computer Monitors", description: "4K UHD resolution, 60Hz refresh rate, HDR10 support, USB-C connectivity, adjustable stand with VESA mount", tags: "electronics, monitors, 4k, premium, trending", costPrice: 18500, retailPrice: 24999, wholesalePrice: 22500, taxRate: 18, dimensions: "61 x 45 x 22 cm", weight: 6.5, baseUnit: "pcs", openingStockQuantity: 15, minimumStockAlertLevel: 5, productStatus: "active" },
    { productName: "Ergonomic Office Chair - Mesh Back", sku: "CHAIR-ERG-MESH-GRY", barcode: "7891234567890", category: "Furniture", subCategory: "Office Chairs", description: "High-back ergonomic chair with mesh backing, lumbar support, adjustable armrests, tilt mechanism, pneumatic height adjustment, 5-year warranty", tags: "furniture, office, ergonomic, bestseller, workplace", costPrice: 5500, retailPrice: 9999, wholesalePrice: 8500, taxRate: 18, dimensions: "68 x 68 x 105 cm", weight: 15.2, baseUnit: "pcs", openingStockQuantity: 25, minimumStockAlertLevel: 8, productStatus: "active" },
    { productName: "Wireless Bluetooth Headphones", sku: "HEADPHONES-WL-BT-RED", barcode: "1234567890123", category: "Electronics", subCategory: "Headphones", description: "True wireless in-ear headphones with noise cancellation, 20-hour battery life, fast charging, water-resistant, 1-year warranty", tags: "electronics, headphones, wireless, noise cancellation, bestseller", costPrice: 1200, retailPrice: 2999, wholesalePrice: 1800, taxRate: 18, dimensions: "12 x 12 x 12 cm", weight: 0.2, baseUnit: "pcs", openingStockQuantity: 30, minimumStockAlertLevel: 10, productStatus: "active" },
    { productName: "Premium Cotton T-Shirt - White", sku: "TSHIRT-COTTON-WHT-M", barcode: "4512345678901", category: "Apparel", subCategory: "T-Shirts", description: "100% organic cotton, soft and breathable fabric, comfortable fit, perfect for casual wear, machine washable at 30°C", tags: "apparel, casual, cotton, bestseller, summer", costPrice: 180, retailPrice: 499, wholesalePrice: 399, taxRate: 5, dimensions: "35 x 25 x 3 cm", weight: 0.2, baseUnit: "pcs", openingStockQuantity: 200, minimumStockAlertLevel: 50, productStatus: "active" },
    { productName: "Basmati Rice - 1kg Pack", sku: "RICE-BASMATI-1KG", barcode: "8901234512345", category: "Food & Beverage", subCategory: "Rice & Grains", description: "Premium Indian basmati rice, long grains, aromatic flavor, naturally aged for 2 years, packed in food-grade plastic", tags: "food, rice, organic, staple, bestseller", costPrice: 65, retailPrice: 150, wholesalePrice: 120, taxRate: 0, dimensions: "25 x 15 x 10 cm", weight: 1.0, baseUnit: "kg", openingStockQuantity: 500, minimumStockAlertLevel: 100, productStatus: "active" },
    { productName: "Stainless Steel Door Lock Set", sku: "LOCK-SS-LEVER-BRS", barcode: "6234567890123", category: "Hardware", subCategory: "Locks & Handles", description: "Heavy-duty stainless steel construction, brass lever handles, anti-rust coating, suitable for main doors, includes 3 keys", tags: "hardware, locks, security, premium, home-improvement", costPrice: 850, retailPrice: 1899, wholesalePrice: 1599, taxRate: 18, dimensions: "15 x 10 x 8 cm", weight: 1.2, baseUnit: "pcs", openingStockQuantity: 40, minimumStockAlertLevel: 10, productStatus: "active" },
    { productName: "USB-C Fast Charging Cable - 2m", sku: "CABLE-USBC-2M-BLK", barcode: "5678901234567", category: "Electronics", subCategory: "Cables & Adapters", description: "Premium USB-C cable, supports 65W fast charging, nylon braided outer layer, 2-meter length, compatible with all USB-C devices", tags: "electronics, cables, fast-charging, accessories, trending", costPrice: 120, retailPrice: 349, wholesalePrice: 280, taxRate: 18, dimensions: "20 x 8 x 4 cm", weight: 0.08, baseUnit: "pcs", openingStockQuantity: 300, minimumStockAlertLevel: 75, productStatus: "active" },
    { productName: "LED Smart Bulb - 9W Warm White", sku: "BULB-LED-9W-WARM", barcode: "9012345678901", category: "Electronics", subCategory: "Lighting", description: "9W LED smart bulb, 800 lumens, warm white color (2700K), Wi-Fi enabled, smartphone control via app, voice compatible, energy efficient", tags: "electronics, lighting, smart-home, energy-efficient, trending", costPrice: 320, retailPrice: 799, wholesalePrice: 650, taxRate: 18, dimensions: "6 x 6 x 11 cm", weight: 0.15, baseUnit: "pcs", openingStockQuantity: 150, minimumStockAlertLevel: 40, productStatus: "active" },
    { productName: "Premium Ball Pen Set - 50 Pack", sku: "PEN-BALL-50PC-BLUE", barcode: "3456789012345", category: "Other", subCategory: "Office Supplies", description: "Pack of 50 smooth-writing ball pens, 0.7mm tip, blue ink, comfortable grip, long-lasting ink capacity, perfect for offices and schools", tags: "office-supplies, pens, stationery, bulk-pack, wholesale", costPrice: 180, retailPrice: 449, wholesalePrice: 350, taxRate: 18, dimensions: "30 x 20 x 10 cm", weight: 0.5, baseUnit: "pack", openingStockQuantity: 100, minimumStockAlertLevel: 25, productStatus: "active" },
    { productName: "Wooden Side Table - Natural Oak", sku: "TABLE-SIDE-OAK-NAT", barcode: "7890123456789", category: "Furniture", subCategory: "Side Tables", description: "Solid wood side table made from natural oak, minimalist design, fits any room decor, easy assembly, spacious top surface for lamp or books", tags: "furniture, tables, wooden, minimalist, home-decor", costPrice: 2200, retailPrice: 4999, wholesalePrice: 4200, taxRate: 18, dimensions: "45 x 45 x 60 cm", weight: 12.0, baseUnit: "pcs", openingStockQuantity: 20, minimumStockAlertLevel: 5, productStatus: "active" },
    { productName: "Apple AirPods Pro (2nd Gen)", sku: "EARPOD-AIRPRO-2-WHT", barcode: "1234567890124", category: "Electronics", subCategory: "Headphones & Earbuds", description: "Wireless earbuds with active noise cancellation, spatial audio support, up to 6 hours battery life, charging case provides 30 hours total, water resistant", tags: "electronics, premium, wireless, airpods, trendy", costPrice: 15500, retailPrice: 24990, wholesalePrice: 22500, taxRate: 18, dimensions: "12 x 10 x 6 cm", weight: 0.24, baseUnit: "pcs", openingStockQuantity: 10, minimumStockAlertLevel: 3, productStatus: "active" }
];

async function seedDummyProducts() {
    console.log('🚀 Seeding dummy products...\n');

    try {
        // First, get the categories to match them
        const categories = await db('categories').select('id', 'name');
        const categoryMap = {};
        categories.forEach(c => {
            categoryMap[c.name.toLowerCase()] = c.id;
        });
        console.log('📂 Found categories:', Object.keys(categoryMap).join(', '));

        // Get existing products to avoid duplicates (by code/sku)
        const existingProducts = await db('products').select('code');
        const existingCodes = new Set(existingProducts.map(p => p.code));

        let insertedCount = 0;
        let skippedCount = 0;

        for (const dummy of dummyProducts) {
            // Skip if product with same SKU already exists
            if (existingCodes.has(dummy.sku)) {
                console.log(`⏭️  Skipping "${dummy.productName}" - SKU already exists`);
                skippedCount++;
                continue;
            }

            // Find matching category
            const categoryId = categoryMap[dummy.category.toLowerCase()] || null;

            // Prepare product data for insertion
            const productData = {
                code: dummy.sku,
                name: dummy.productName,
                barcode: dummy.barcode,
                description: dummy.description,
                category_id: categoryId,
                sub_category: dummy.subCategory,
                tags: dummy.tags,
                status: dummy.productStatus,
                cost_price: dummy.costPrice,
                retail_price: dummy.retailPrice,
                wholesale_price: dummy.wholesalePrice,
                tax_rate: dummy.taxRate,
                weight: dummy.weight,
                weight_unit: 'kg',
                dimensions: dummy.dimensions,
                min_stock_level: dummy.minimumStockAlertLevel,
                is_active: true,
                track_stock: true
            };

            // Insert product
            const [product] = await db('products').insert(productData).returning('*');
            console.log(`✅ Inserted: ${dummy.productName} (ID: ${product.id})`);

            // Create opening stock movement if opening stock > 0
            if (dummy.openingStockQuantity > 0) {
                await db('stock_movements').insert({
                    product_id: product.id,
                    movement_type: 'IN',
                    reference_type: 'opening',
                    quantity: dummy.openingStockQuantity,
                    unit_cost: dummy.costPrice,
                    remaining_qty: dummy.openingStockQuantity,
                    notes: 'Opening stock from seed script'
                });
                console.log(`   📦 Added opening stock: ${dummy.openingStockQuantity} units`);
            }

            insertedCount++;
        }

        console.log('\n📊 Summary:');
        console.log(`   ✅ Inserted: ${insertedCount} products`);
        console.log(`   ⏭️  Skipped: ${skippedCount} products (already exist)`);
        console.log('\n✨ Done!');

    } catch (error) {
        console.error('❌ Error seeding products:', error.message);
        console.error(error.stack);
    } finally {
        await db.destroy();
    }
}

seedDummyProducts();
