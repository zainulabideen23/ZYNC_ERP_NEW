const axios = require('axios');
const jwt = require('jsonwebtoken');
const knex = require('knex');
const config = require('../knexfile');

// Config
const API_URL = 'http://localhost:3001/api';
const JWT_SECRET = 'your-super-secret-jwt-key-change-this-in-production';
const db = knex(config.development);

const endpoints = [
    { url: '/products', name: 'Products' },
    { url: '/customers', name: 'Customers' },
    { url: '/suppliers', name: 'Suppliers' },
    { url: '/sales', name: 'Sales' },
    { url: '/purchases', name: 'Purchases' },
    { url: '/expenses', name: 'Expenses' }
];

async function verify() {
    console.log('🚀 Starting API Verification...\n');
    let allPassed = true;

    try {
        // Get an active user
        const user = await db('users').where({ is_active: true }).first();
        if (!user) {
            console.error('❌ No active users found in database to verify with.');
            process.exit(1);
        }

        console.log(`👤 Using User: ${user.username} (${user.role})`);

        // Generate Token
        // NOTE: Payload must match what auth middleware expects: { userId: user.id }
        const token = jwt.sign(
            { userId: user.id, role: user.role, username: user.username },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        const instance = axios.create({
            baseURL: API_URL,
            headers: { Authorization: `Bearer ${token}` }
        });

        for (const endpoint of endpoints) {
            try {
                const res = await instance.get(endpoint.url);

                // Check for success flag
                if (!res.data.success) {
                    console.error(`❌ ${endpoint.name}: Response success is false`);
                    allPassed = false;
                    continue;
                }

                // Check for data array
                if (!Array.isArray(res.data.data)) {
                    console.error(`❌ ${endpoint.name}: Response data is not an array (Got ${typeof res.data.data})`);
                    console.error('Response structure:', JSON.stringify(res.data, null, 2).slice(0, 200));
                    allPassed = false;
                    continue;
                }

                // Check for pagination
                if (!res.data.pagination) {
                    console.error(`❌ ${endpoint.name}: Missing pagination object`);
                    allPassed = false;
                    continue;
                }

                console.log(`✅ ${endpoint.name}: OK (${res.data.data.length} items)`);

            } catch (error) {
                console.error(`❌ ${endpoint.name}: Request failed - ${error.message}`);
                if (error.response) {
                    console.error('Status:', error.response.status);
                    // console.error('Data:', error.response.data);
                }
                allPassed = false;
            }
        }

    } catch (err) {
        console.error('Global Error:', err);
        allPassed = false;
    } finally {
        await db.destroy();
    }

    console.log('\n-----------------------------------');
    if (allPassed) {
        console.log('🎉 VERIFICATION SUCCESSFUL: All endpoints return standardized structure.');
        process.exit(0);
    } else {
        console.error('💥 VERIFICATION FAILED: Some endpoints have issues.');
        process.exit(1);
    }
}

verify();
