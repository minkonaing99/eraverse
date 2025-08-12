-- Create the database
CREATE DATABASE eraverse_panel;
-- Select the database
USE eraverse_panel;
-- Create the products table
CREATE TABLE products_catalog (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    duration INT DEFAULT 1,
    renew BOOLEAN NOT NULL DEFAULT FALSE,
    supplier VARCHAR(255) NULL,
    wholesale DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    retail DECIMAL(10, 2) NOT NULL,
    note TEXT NULL,
    link VARCHAR(2083) NULL
);
CREATE TABLE sale_overview (
    sale_id INT AUTO_INCREMENT PRIMARY KEY,
    sale_product VARCHAR(255) NOT NULL,
    duration INT NOT NULL,
    renew BOOLEAN NOT NULL,
    customer VARCHAR(255) NOT NULL,
    email VARCHAR(255) NULL,
    purchased_date DATE NOT NULL,
    expired_date DATE,
    manager VARCHAR(255) NULL,
    note TEXT NULL,
    price DECIMAL(10, 2) NOT NULL,
    profit DECIMAL(10, 2) NOT NULL
);
-- Add a few indexes you’ll almost certainly filter/sort by
CREATE INDEX idx_sale_product ON sale_overview (sale_product);
CREATE INDEX idx_purchased_date ON sale_overview (purchased_date);
CREATE INDEX idx_expired_date ON sale_overview (expired_date);
CREATE INDEX idx_customer ON sale_overview (customer);
CREATE TABLE users (
    user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    pass_hash VARCHAR(255) NOT NULL,
    -- password_hash() output
    role ENUM('Owner', 'Admin', 'Staff') NOT NULL DEFAULT 'Staff',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    last_login_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_username UNIQUE (username)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
JY45KQC3qwyhdLtfwwUtJRjqwLgDzu34 CREATE TABLE sale_overview (
    sale_id INT AUTO_INCREMENT PRIMARY KEY,
    sale_product VARCHAR(255) NOT NULL,
    duration INT NOT NULL,
    renew INT NOT NULL DEFAULT 0,
    customer VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    purchased_date DATE NOT NULL,
    expired_date DATE,
    manager VARCHAR(255),
    note TEXT,
    price DECIMAL(10, 2) NOT NULL,
    profit DECIMAL(10, 2) NOT NULL
);
CREATE TABLE products_catalog (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    duration INT DEFAULT 1,
    renew INT NOT NULL DEFAULT 0,
    supplier VARCHAR(255),
    wholesale DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    retail DECIMAL(10, 2) NOT NULL,
    note TEXT,
    link VARCHAR(2083)
);