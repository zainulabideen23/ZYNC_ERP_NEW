class SequenceService {
    constructor(db) {
        this.db = db;
    }

    /**
     * getNextSequenceValue for a given entity
     * Increments the current_value and returns the formatted code
     */
    async getNextSequenceValue(sequenceName, trx = null) {
        const query = trx || this.db;

        // Get and lock the sequence row to prevent race conditions
        const sequence = await query('sequences')
            .where('name', sequenceName)
            .forUpdate()
            .first();

        if (!sequence) {
            throw new Error(`Sequence '${sequenceName}' not found`);
        }

        const nextValue = parseInt(sequence.current_value) + 1;

        // Update the sequence
        await query('sequences')
            .where('id', sequence.id)
            .update({
                current_value: nextValue,
                last_reset: new Date()
            });

        // Format the code (Prefix + Pad + Value) e.g., SUPP-00005
        const code = `${sequence.prefix || ''}${String(nextValue).padStart(sequence.pad_length, '0')}`;

        return code;
    }
}

module.exports = SequenceService;
