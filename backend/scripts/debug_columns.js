const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const knex = require(path.join(__dirname, '..', 'src', 'config', 'database'));

async function listColumns() {
    try {
        const sales = await knex('sales').columnInfo();
        console.log('Sales Columns:', Object.keys(sales));

        const journals = await knex('journals').columnInfo();
        console.log('Journals Columns:', Object.keys(journals));

        const ledger = await knex('ledger_entries').columnInfo();
        console.log('Ledger Columns:', Object.keys(ledger));

        const stock = await knex('stock_movements').columnInfo();
        console.log('Stock Columns:', Object.keys(stock));
    } catch (e) {
        console.error(e);
    } finally {
        knex.destroy();
    }
}

listColumns();
