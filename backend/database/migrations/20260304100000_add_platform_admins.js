/**
 * Migration: Platform Admins & Impersonation Logs
 *
 * Creates tables for the Platform Admin Panel:
 *   - platform_admins: separate credentials for platform-level operators
 *   - impersonation_logs: audit trail when a platform admin impersonates a tenant
 */

exports.up = async function (knex) {
    // =====================================================
    // 1. PLATFORM ADMINS TABLE
    // =====================================================
    await knex.raw(`
        CREATE TABLE platform_admins (
            id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email           VARCHAR(100) UNIQUE NOT NULL,
            password_hash   VARCHAR(255) NOT NULL,
            full_name       VARCHAR(100) NOT NULL,
            is_active       BOOLEAN NOT NULL DEFAULT true,
            last_login      TIMESTAMP,
            created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CHECK (LENGTH(email) > 0),
            CHECK (LENGTH(full_name) > 0)
        );
    `);

    // =====================================================
    // 2. IMPERSONATION LOGS TABLE
    // =====================================================
    await knex.raw(`
        CREATE TABLE impersonation_logs (
            id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            platform_admin_id   UUID NOT NULL REFERENCES platform_admins(id),
            tenant_id           UUID NOT NULL REFERENCES tenants(id),
            target_user_id      UUID NOT NULL,
            started_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            token_expires_at    TIMESTAMP NOT NULL,
            ip_address          INET,
            user_agent          TEXT
        );

        CREATE INDEX idx_impersonation_logs_admin ON impersonation_logs(platform_admin_id);
        CREATE INDEX idx_impersonation_logs_tenant ON impersonation_logs(tenant_id);
        CREATE INDEX idx_impersonation_logs_started ON impersonation_logs(started_at DESC);
    `);

    // =====================================================
    // 3. SEED DEFAULT PLATFORM ADMIN
    // =====================================================
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('platform_admin_123', 10);

    await knex('platform_admins').insert({
        email: 'admin@zyncerp.com',
        password_hash: hash,
        full_name: 'Platform Admin'
    });
};

exports.down = async function (knex) {
    await knex.raw('DROP TABLE IF EXISTS impersonation_logs CASCADE;');
    await knex.raw('DROP TABLE IF EXISTS platform_admins CASCADE;');
};
