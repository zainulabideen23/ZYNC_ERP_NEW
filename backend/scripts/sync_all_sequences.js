/**
 * Sync All Sequences Script
 * Syncs sequence current_value with actual max values in respective tables
 * Run this to fix out-of-sync sequence numbers
 * 
 * Usage: node scripts/sync_all_sequences.js
 */

const knex = require('knex');
const config = require('../knexfile');

const db = knex(config.development);

async function syncSequences() {
    console.log('🔄 Starting sequence synchronization...\n');

    const syncConfigs = [
        {
            name: 'invoice',
            table: 'sales',
            column: 'invoice_number',
            prefixDefault: 'SINV-'
        },
        {
            name: 'purchase',
            table: 'purchases',
            column: 'bill_number',
            prefixDefault: 'PUR-'
        },
        {
            name: 'quotation',
            table: 'quotations',
            column: 'quotation_number',
            prefixDefault: 'QUO-'
        },
        {
            name: 'journal',
            table: 'journal_entries',
            column: 'voucher_number',
            prefixDefault: 'JV-'
        }
    ];

    for (const config of syncConfigs) {
        try {
            // Get current sequence
            const sequence = await db('sequences').where('name', config.name).first();
            
            if (!sequence) {
                console.log(`⚠️  Sequence '${config.name}' not found, skipping...`);
                continue;
            }

            const prefix = sequence.prefix || config.prefixDefault;

            // Check if table exists
            const tableExists = await db.schema.hasTable(config.table);
            if (!tableExists) {
                console.log(`⚠️  Table '${config.table}' not found, skipping...`);
                continue;
            }

            // Check if column exists
            const columnExists = await db.schema.hasColumn(config.table, config.column);
            if (!columnExists) {
                console.log(`⚠️  Column '${config.column}' not found in '${config.table}', skipping...`);
                continue;
            }

            // Get max value from table
            const result = await db.raw(
                `SELECT COALESCE(MAX(CAST(REPLACE(${config.column}, ?, '') AS INTEGER)), 0) as max_num FROM ${config.table} WHERE ${config.column} LIKE ?`,
                [prefix, prefix + '%']
            );
            
            const maxInTable = parseInt(result.rows[0]?.max_num || 0);
            const currentSequence = parseInt(sequence.current_value || 0);

            console.log(`📊 ${config.name.toUpperCase()}:`);
            console.log(`   Current sequence value: ${currentSequence}`);
            console.log(`   Max value in ${config.table}: ${maxInTable}`);

            if (maxInTable > currentSequence) {
                await db('sequences')
                    .where('name', config.name)
                    .update({ current_value: maxInTable });
                console.log(`   ✅ Updated sequence to: ${maxInTable}`);
            } else if (maxInTable === currentSequence) {
                console.log(`   ✓ Already in sync`);
            } else {
                console.log(`   ✓ Sequence is ahead of table max (OK)`);
            }
            console.log('');

        } catch (error) {
            console.error(`❌ Error syncing '${config.name}':`, error.message);
        }
    }

    console.log('🎉 Sequence synchronization complete!\n');
}

syncSequences()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    })
    .finally(() => {
        db.destroy();
    });
