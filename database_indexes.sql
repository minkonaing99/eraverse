-- ===============================================
-- DATABASE INDEXES FOR ERAVERSE PERFORMANCE
-- ===============================================
-- Run these SQL commands in your database to optimize query performance
-- ===============================================
-- 1. SALES_MINIMAL.PHP INDEXES (Last 40 Days)
-- ===============================================
-- Primary index for purchased_date filtering
CREATE INDEX idx_sale_overview_purchased_date ON sale_overview(purchased_date);
CREATE INDEX idx_ws_sale_overview_purchased_date ON ws_sale_overview(purchased_date);
-- Composite index for ORDER BY optimization
CREATE INDEX idx_sale_overview_purchased_sale_id ON sale_overview(purchased_date DESC, sale_id DESC);
CREATE INDEX idx_ws_sale_overview_purchased_sale_id ON ws_sale_overview(purchased_date DESC, sale_id DESC);
-- ===============================================
-- 2. SALES_SUMMARY_TABLE.PHP INDEXES (Expiry + Renew)
-- ===============================================
-- Index for expired_date filtering
CREATE INDEX idx_sale_overview_expired_date ON sale_overview(expired_date);
CREATE INDEX idx_ws_sale_overview_expired_date ON ws_sale_overview(expired_date);
-- Index for renew filtering
CREATE INDEX idx_sale_overview_renew ON sale_overview(renew);
CREATE INDEX idx_ws_sale_overview_renew ON ws_sale_overview(renew);
-- Composite index for combined WHERE conditions
CREATE INDEX idx_sale_overview_expired_renew ON sale_overview(expired_date, renew);
CREATE INDEX idx_ws_sale_overview_expired_renew ON ws_sale_overview(expired_date, renew);
-- ===============================================
-- 3. ADDITIONAL PERFORMANCE INDEXES
-- ===============================================
-- Index for sale_id (if not already primary key)
CREATE INDEX idx_sale_overview_sale_id ON sale_overview(sale_id);
CREATE INDEX idx_ws_sale_overview_sale_id ON ws_sale_overview(sale_id);
-- Index for customer lookups (if needed)
CREATE INDEX idx_sale_overview_customer ON sale_overview(customer);
CREATE INDEX idx_ws_sale_overview_customer ON ws_sale_overview(customer);
-- Index for email lookups (if needed)
CREATE INDEX idx_sale_overview_email ON sale_overview(email);
CREATE INDEX idx_ws_sale_overview_email ON ws_sale_overview(email);
-- ===============================================
-- 4. CHECK EXISTING INDEXES
-- ===============================================
-- Use these queries to check if indexes already exist:
-- For MySQL/MariaDB:
-- SHOW INDEX FROM sale_overview;
-- SHOW INDEX FROM ws_sale_overview;
-- For PostgreSQL:
-- \d sale_overview
-- \d ws_sale_overview
-- ===============================================
-- 5. DROP INDEXES (if needed to recreate)
-- ===============================================
-- Uncomment and modify if you need to drop existing indexes:
-- DROP INDEX idx_sale_overview_purchased_date ON sale_overview;
-- DROP INDEX idx_ws_sale_overview_purchased_date ON ws_sale_overview;
-- DROP INDEX idx_sale_overview_expired_date ON sale_overview;
-- DROP INDEX idx_ws_sale_overview_expired_date ON ws_sale_overview;
-- DROP INDEX idx_sale_overview_renew ON sale_overview;
-- DROP INDEX idx_ws_sale_overview_renew ON ws_sale_overview;

