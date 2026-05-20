/**
 * Reconcile products.current_stock from stock_movements history.
 *
 * This migration is idempotent and tenant-safe.
 * It recalculates stock from movement history and updates only mismatched rows.
 */

exports.up = async function up(knex) {
    const result = await knex.raw(`
        WITH movement_totals AS (
            SELECT
                p.id AS product_id,
                p.tenant_id,
                COALESCE(
                    SUM(
                        CASE
                            WHEN sm.movement_type IN ('IN', 'RETURN') THEN sm.quantity
                            WHEN sm.movement_type IN ('OUT', 'DAMAGE') THEN -sm.quantity
                            WHEN sm.movement_type = 'ADJUSTMENT' THEN
                                CASE
                                    WHEN sa.id IS NOT NULL THEN sm.quantity * COALESCE(NULLIF(SIGN(sa.quantity_adjusted), 0), 1)
                                    ELSE sm.quantity
                                END
                            ELSE 0
                        END
                    ),
                    0
                ) AS computed_stock
            FROM products p
            LEFT JOIN stock_movements sm
                ON sm.product_id = p.id
                AND sm.tenant_id = p.tenant_id
            LEFT JOIN stock_adjustments sa
                ON sa.id = sm.reference_id
                AND sa.tenant_id = sm.tenant_id
            GROUP BY p.id, p.tenant_id
        ),
        updated AS (
            UPDATE products p
            SET
                current_stock = GREATEST(mt.computed_stock, 0),
                updated_at = NOW()
            FROM movement_totals mt
            WHERE p.id = mt.product_id
              AND p.tenant_id = mt.tenant_id
              AND p.current_stock IS DISTINCT FROM GREATEST(mt.computed_stock, 0)
            RETURNING p.id
        )
        SELECT COUNT(*)::INT AS updated_count
        FROM updated
    `);

    const updatedCount = Number(result.rows?.[0]?.updated_count || 0);
    // eslint-disable-next-line no-console
    console.log(`[stock-reconcile] Updated ${updatedCount} product stock rows.`);
};

exports.down = async function down() {
    // Irreversible data-fix migration.
};
