-- ===============================================
-- COMPLETE DATABASE INDEXES FOR ERAVERSE
-- ===============================================
-- Based on analysis of all API files
-- Run these SQL commands to optimize all database queries
-- ===============================================
-- 1. SALES TABLES (sale_overview & ws_sale_overview)
-- ===============================================
-- Primary indexes for date filtering (MOST CRITICAL)
CREATE INDEX idx_sale_overview_purchased_date ON sale_overview(purchased_date);
CREATE INDEX idx_ws_sale_overview_purchased_date ON ws_sale_overview(purchased_date);
-- Indexes for expired_date filtering (sales_summary_table.php)
CREATE INDEX idx_sale_overview_expired_date ON sale_overview(expired_date);
CREATE INDEX idx_ws_sale_overview_expired_date ON ws_sale_overview(expired_date);
-- Indexes for renew filtering (sales_summary_table.php)
CREATE INDEX idx_sale_overview_renew ON sale_overview(renew);
CREATE INDEX idx_ws_sale_overview_renew ON ws_sale_overview(renew);
-- Composite indexes for complex WHERE conditions
CREATE INDEX idx_sale_overview_expired_renew ON sale_overview(expired_date, renew);
CREATE INDEX idx_ws_sale_overview_expired_renew ON ws_sale_overview(expired_date, renew);
-- Composite indexes for ORDER BY optimization
CREATE INDEX idx_sale_overview_purchased_sale_id ON sale_overview(purchased_date DESC, sale_id DESC);
CREATE INDEX idx_ws_sale_overview_purchased_sale_id ON ws_sale_overview(purchased_date DESC, sale_id DESC);
-- Index for MONTH() function optimization (sales_table.php, ws_sales_table.php)
-- Note: This helps with WHERE MONTH(purchased_date) = :month queries
CREATE INDEX idx_sale_overview_purchased_month ON sale_overview(purchased_date);
CREATE INDEX idx_ws_sale_overview_purchased_month ON ws_sale_overview(purchased_date);
-- Primary key indexes (if not already primary keys)
CREATE INDEX idx_sale_overview_sale_id ON sale_overview(sale_id);
CREATE INDEX idx_ws_sale_overview_sale_id ON ws_sale_overview(sale_id);
-- ===============================================
-- 2. PRODUCTS TABLES (products_catalog & ws_products_catalog)
-- ===============================================
-- Primary key indexes (if not already primary keys)
CREATE INDEX idx_products_catalog_product_id ON products_catalog(product_id);
CREATE INDEX idx_ws_products_catalog_product_id ON ws_products_catalog(product_id);
-- Index for ORDER BY product_name (products_table.php, ws_products_table.php)
CREATE INDEX idx_products_catalog_product_name ON products_catalog(product_name);
CREATE INDEX idx_ws_products_catalog_product_name ON ws_products_catalog(product_name);
-- Index for renew filtering (if needed for product queries)
CREATE INDEX idx_products_catalog_renew ON products_catalog(renew);
CREATE INDEX idx_ws_products_catalog_renew ON ws_products_catalog(renew);
-- ===============================================
-- 3. USER TABLES (users & bot_users)
-- ===============================================
-- Primary key indexes (if not already primary keys)
CREATE INDEX idx_users_user_id ON users(user_id);
CREATE INDEX idx_bot_users_id ON bot_users(id);
-- Index for username lookups (user_list.php, login.php)
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_bot_users_username ON bot_users(username);
-- Index for role filtering (user_list.php)
CREATE INDEX idx_users_role ON users(role);
-- Index for active status filtering
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_bot_users_is_active ON bot_users(is_active);
-- Index for ORDER BY username (user_list.php)
CREATE INDEX idx_users_username_asc ON users(username ASC);
CREATE INDEX idx_bot_users_username_asc ON bot_users(username ASC);
-- ===============================================
-- 4. PERFORMANCE OPTIMIZATION INDEXES
-- ===============================================
-- Additional indexes for common lookup patterns
CREATE INDEX idx_sale_overview_customer ON sale_overview(customer);
CREATE INDEX idx_ws_sale_overview_customer ON ws_sale_overview(customer);
CREATE INDEX idx_sale_overview_email ON sale_overview(email);
CREATE INDEX idx_ws_sale_overview_email ON ws_sale_overview(email);
-- ===============================================
-- 5. CHECK EXISTING INDEXES
-- ===============================================
-- Use these queries to check if indexes already exist:
-- For MySQL/MariaDB:
-- SHOW INDEX FROM sale_overview;
-- SHOW INDEX FROM ws_sale_overview;
-- SHOW INDEX FROM products_catalog;
-- SHOW INDEX FROM ws_products_catalog;
-- SHOW INDEX FROM users;
-- SHOW INDEX FROM bot_users;
-- For PostgreSQL:
-- \d sale_overview
-- \d ws_sale_overview
-- \d products_catalog
-- \d ws_products_catalog
-- \d users
-- \d bot_users
-- ===============================================
-- 6. DROP INDEXES (if needed to recreate)
-- ===============================================
-- Uncomment and modify if you need to drop existing indexes:
-- DROP INDEX idx_sale_overview_purchased_date ON sale_overview;
-- DROP INDEX idx_ws_sale_overview_purchased_date ON ws_sale_overview;
-- DROP INDEX idx_sale_overview_expired_date ON sale_overview;
-- DROP INDEX idx_ws_sale_overview_expired_date ON ws_sale_overview;
-- DROP INDEX idx_sale_overview_renew ON sale_overview;
-- DROP INDEX idx_ws_sale_overview_renew ON ws_sale_overview;
-- DROP INDEX idx_products_catalog_product_name ON products_catalog;
-- DROP INDEX idx_ws_products_catalog_product_name ON ws_products_catalog;
-- DROP INDEX idx_users_username ON users;
-- DROP INDEX idx_bot_users_username ON bot_users;
-- ===============================================
-- 7. PRIORITY ORDER FOR CREATING INDEXES
-- ===============================================
-- Create these indexes FIRST (highest impact):
-- 1. idx_sale_overview_purchased_date
-- 2. idx_ws_sale_overview_purchased_date
-- 3. idx_sale_overview_expired_date
-- 4. idx_ws_sale_overview_expired_date
-- 5. idx_sale_overview_renew
-- 6. idx_ws_sale_overview_renew
-- Then create these (medium impact):
-- 7. idx_products_catalog_product_name
-- 8. idx_ws_products_catalog_product_name
-- 9. idx_users_username
-- 10. idx_bot_users_username
-- Finally create these (lower impact but still beneficial):
-- 11. Composite indexes
-- 12. Additional lookup indexes