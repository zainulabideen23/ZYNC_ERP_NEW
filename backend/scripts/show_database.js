const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/config/database');

async function showDatabase() {
    console.log('\n========== DATABASE OVERVIEW ==========\n');

    try {
        // Products
        const products = await db('products')
            .select('code', 'name', 'retail_price', 'cost_price', 'status')
            .orderBy('name');
        console.log(`📦 PRODUCTS (${products.length} items):`);
        console.table(products);

        // Stock Movements
        const stock = await db('stock_movements as sm')
            .join('products as p', 'sm.product_id', 'p.id')
            .select('p.name as product', 'sm.movement_type', 'sm.quantity', 'sm.remaining_qty', 'sm.reference_type')
            .orderBy('sm.created_at', 'desc')
            .limit(15);
        console.log(`\n📊 STOCK MOVEMENTS (last 15):`);
        console.table(stock);

        // Categories
        const categories = await db('categories').select('name', 'description');
        console.log(`\n📂 CATEGORIES:`);
        console.table(categories);

        // Customers
        const customers = await db('customers').select('name', 'phone', 'city').limit(10);
        console.log(`\n👥 CUSTOMERS (${customers.length}):`);
        console.table(customers);

        // Suppliers
        const suppliers = await db('suppliers').select('name', 'phone', 'city').limit(10);
        console.log(`\n🏭 SUPPLIERS (${suppliers.length}):`);
        console.table(suppliers);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await db.destroy();
    }
}

showDatabase();
