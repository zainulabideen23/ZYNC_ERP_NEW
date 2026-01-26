require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../src/config/database');

const resetPassword = async () => {
    try {
        const password = 'admin123';
        const hashedPassword = await bcrypt.hash(password, 10);

        await db('users')
            .where('username', 'admin')
            .update({ password_hash: hashedPassword });

        console.log(`Password for 'admin' user has been reset to: ${password}`);
        process.exit(0);
    } catch (error) {
        console.error('Failed to reset password:', error);
        process.exit(1);
    }
};

resetPassword();
