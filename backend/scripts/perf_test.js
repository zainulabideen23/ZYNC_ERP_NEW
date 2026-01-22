const db = require('../src/config/database');
const { v4: uuidv4 } = require('uuid');

async function runPerfTest() {
    console.log('--- Starting Performance Test (10,000 Products) ---');

    // Clean up or just add
    const countBefore = await db('products').count('* as count').first();
    console.log(`Initial product count: ${countBefore.count}`);

    const products = [];
    for (let i = 0; i < 10000; i++) {
        products.push({
            code: `PERF-${uuidv4().substring(0, 8)}-${i}`,
            name: `Performance Test Product ${i}`,
            retail_price: Math.random() * 1000,
            cost_price: Math.random() * 500,
            is_active: true,
            track_stock: false
        });
    }

    console.time('Bulk Insertion (10k)');
    // Chunking to avoid memory issues or query limits
    const chunkSize = 1000;
    for (let i = 0; i < products.length; i += chunkSize) {
        await db('products').insert(products.slice(i, i + chunkSize));
    }
    console.timeEnd('Bulk Insertion (10k)');

    console.time('Search Retrieval (Random Name)');
    const randomSearch = `Performance Test Product ${Math.floor(Math.random() * 10000)}`;
    const found = await db('products').whereILike('name', `%${randomSearch}%`).limit(50);
    console.timeEnd('Search Retrieval (Random Name)');
    console.log(`Found ${found.length} matches.`);

    const countAfter = await db('products').count('* as count').first();
    console.log(`Final product count: ${countAfter.count}`);

    // Clean up (optional logic, but let's keep them for now or delete them)
    // console.log('Cleaning up performance data...');
    // await db('products').where('code', 'LIKE', 'PERF-%').delete();

    console.log('--- Performance Test Completed ---');
    process.exit(0);
}

runPerfTest().catch(err => {
    console.error(err);
    process.exit(1);
});
