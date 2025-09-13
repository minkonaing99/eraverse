-- Additional performance indexes for sales overview optimization
-- Run these to make queries even faster
-- Composite index for the main query pattern (purchased_date + sale_id ordering)
CREATE INDEX idx_sale_overview_purchased_sale_id ON sale_overview(purchased_date DESC, sale_id DESC);
CREATE INDEX idx_ws_sale_overview_purchased_sale_id ON ws_sale_overview(purchased_date DESC, sale_id DESC);
-- Index for date range queries (when filtering by month)
CREATE INDEX idx_sale_overview_purchased_date_range ON sale_overview(purchased_date);
CREATE INDEX idx_ws_sale_overview_purchased_date_range ON ws_sale_overview(purchased_date);
-- Index for customer search (if you use customer filtering)
CREATE INDEX idx_sale_overview_customer ON sale_overview(customer);
CREATE INDEX idx_ws_sale_overview_customer ON ws_sale_overview(customer);
-- Index for product search (if you use product filtering)
CREATE INDEX idx_sale_overview_product ON sale_overview(sale_product);
CREATE INDEX idx_ws_sale_overview_product ON ws_sale_overview(sale_product);
-- Index for manager filtering (if you use manager filtering)
CREATE INDEX idx_sale_overview_manager ON sale_overview(manager);
CREATE INDEX idx_ws_sale_overview_manager ON ws_sale_overview(manager);