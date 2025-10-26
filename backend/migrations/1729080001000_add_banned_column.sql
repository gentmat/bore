-- Migration: Add is_banned column and audit_logs table
-- Run this if upgrading from an older version

BEGIN;

-- Add is_banned column to users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_banned'
    ) THEN
        ALTER TABLE users ADD COLUMN is_banned BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added is_banned column to users table';
    ELSE
        RAISE NOTICE 'is_banned column already exists';
    END IF;
END $$;

-- Create audit_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    admin_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    admin_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(50),
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_logs(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(target_type, target_id, created_at DESC);

COMMIT;
