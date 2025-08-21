import asyncio
import json
import logging
from creds import BOT_TOKEN, DB_CONFIG, CHANNEL_ID, BOT_PASSWORD
from mysql.connector.pooling import MySQLConnectionPool
from datetime import datetime, timedelta, date
from zoneinfo import ZoneInfo
from telegram import (
    Update, InlineKeyboardButton, InlineKeyboardMarkup, BotCommand
)
from telegram.ext import (
    ApplicationBuilder, CommandHandler, CallbackQueryHandler,
    MessageHandler, ContextTypes, filters
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global constants
BANGKOK_TZ = ZoneInfo("Asia/Bangkok")
BATCH_SIZE = 10

# Database connection pool
try:
    db_pool = MySQLConnectionPool(
        pool_name="eraverse_pool",
        pool_size=5,  # Reduced for webhook
        pool_reset_session=True,
        **DB_CONFIG
    )
    logger.info("Database connection pool created successfully")
except Exception as e:
    logger.error(f"Failed to create database pool: {e}")
    db_pool = None

# Utility functions (same as original)
def get_bangkok_now():
    """Get current time in Bangkok timezone"""
    return datetime.now(BANGKOK_TZ)

def get_bangkok_today():
    """Get current date in Bangkok timezone"""
    return get_bangkok_now().date()

def parse_date_safe(date_value):
    """Safely parse date from various formats"""
    if isinstance(date_value, str):
        return datetime.strptime(date_value, "%Y-%m-%d").date()
    elif isinstance(date_value, datetime):
        return date_value.date()
    elif isinstance(date_value, date):
        return date_value
    else:
        raise ValueError(f"Unsupported date format: {type(date_value)}")

def format_date_readable(date_value):
    """Format date to readable format (dd MMM yyyy)"""
    if isinstance(date_value, str):
        date_obj = datetime.strptime(date_value, '%Y-%m-%d')
    else:
        date_obj = date_value
    return date_obj.strftime('%d %b %Y')

def escape_markdown(text):
    """Escape text for Markdown formatting"""
    return str(text).replace('_', '\\_').replace('*', '\\*').replace('[', '\\[')

def create_paginated_keyboard(products, page=0, items_per_page=20, callback_prefix='product'):
    """Create paginated keyboard for product selection"""
    start_idx = page * items_per_page
    end_idx = start_idx + items_per_page
    page_products = products[start_idx:end_idx]
    
    keyboard = []
    row = []
    
    for i, product in enumerate(page_products, 1):
        row.append(InlineKeyboardButton(
            product['product_name'], 
            callback_data=f"{callback_prefix}_{product['product_id']}"
        ))
        if i % 2 == 0:
            keyboard.append(row)
            row = []
    
    if row:
        keyboard.append(row)
    
    # Add navigation buttons
    nav_row = []
    total_pages = (len(products) + items_per_page - 1) // items_per_page
    
    if page > 0:
        nav_row.append(InlineKeyboardButton("⬅️ Previous", callback_data=f"page_{callback_prefix}_{page-1}"))
    
    nav_row.append(InlineKeyboardButton(f"{page+1}/{total_pages}", callback_data="page_info"))
    
    if page < total_pages - 1:
        nav_row.append(InlineKeyboardButton("Next ➡️", callback_data=f"page_{callback_prefix}_{page+1}"))
    
    if nav_row:
        keyboard.append(nav_row)
    
    # Add cancel button
    keyboard.append([InlineKeyboardButton("Cancel", callback_data='cancel')])
    
    return keyboard, page_products, total_pages

def get_db_connection():
    """Get database connection from pool with error handling"""
    if not db_pool:
        raise RuntimeError("Database pool not initialized")
    return db_pool.get_connection()

def execute_query(query, params=None, fetch_type='all', dictionary=False):
    """Execute database query with proper error handling and connection management"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=dictionary, buffered=True)
        
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        
        # Commit the transaction for non-select queries
        if fetch_type != 'all' and fetch_type != 'one':
            conn.commit()
        
        if fetch_type == 'all':
            result = cursor.fetchall()
        elif fetch_type == 'one':
            result = cursor.fetchone()
        else:
            result = None
            
        return result
    except Exception as e:
        logger.error(f"Database query error: {e}")
        logger.error(f"Query: {query}")
        if params:
            logger.error(f"Params: {params}")
        # Rollback on error
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()

# Database functions (same as original)
def fetch_products_by_type(product_type=None):
    """Fetch products with optional type filter"""
    if product_type == 'retail':
        query = """
            SELECT 
                CONCAT('R-', product_id) as product_id, 
                product_name, 
                duration, 
                wholesale, 
                retail,
                'retail' as product_type
            FROM products_catalog 
            ORDER BY product_name
        """
    elif product_type == 'wholesale':
        query = """
            SELECT 
                CONCAT('WS-', product_id) as product_id, 
                product_name, 
                duration, 
                wholesale, 
                retail,
                'wholesale' as product_type
            FROM ws_products_catalog
            ORDER BY product_name
        """
    else:
        query = """
            SELECT 
                CONCAT('R-', product_id) as product_id, 
                CONCAT('Retail - ', product_name) as product_name, 
                duration, 
                wholesale, 
                retail,
                'retail' as product_type
            FROM products_catalog 
            
            UNION ALL
            
            SELECT 
                CONCAT('WS-', product_id) as product_id, 
                CONCAT('Wholesale - ', product_name) as product_name, 
                duration, 
                wholesale, 
                retail,
                'wholesale' as product_type
            FROM ws_products_catalog
            
            ORDER BY product_name
        """
    
    return execute_query(query, dictionary=True)

def fetch_retail_products():
    """Fetch only retail products"""
    return fetch_products_by_type('retail')

def fetch_wholesale_products():
    """Fetch only wholesale products"""
    return fetch_products_by_type('wholesale')

def fetch_product_details(product_id):
    """Fetch product details by ID"""
    if product_id.startswith('R-'):
        actual_id = product_id.replace('R-', '')
        query = "SELECT *, 'retail' as product_type FROM products_catalog WHERE product_id = %s"
    elif product_id.startswith('WS-'):
        actual_id = product_id.replace('WS-', '')
        query = "SELECT *, 'wholesale' as product_type FROM ws_products_catalog WHERE product_id = %s"
    else:
        actual_id = product_id
        query = "SELECT *, 'retail' as product_type FROM products_catalog WHERE product_id = %s"
    
    return execute_query(query, (actual_id,), fetch_type='one', dictionary=True)

# Authentication functions
def check_user_auth(telegram_id):
    """Check if user is authenticated"""
    query = "SELECT id FROM bot_users WHERE telegram_id = %s AND is_active = TRUE"
    try:
        result = execute_query(query, (telegram_id,), fetch_type='one')
        return result is not None
    except Exception as e:
        logger.error(f"Error checking user auth: {e}")
        return False

def save_authenticated_user(telegram_id, username):
    """Save authenticated user to database"""
    query = """
        INSERT INTO bot_users (telegram_id, username) 
        VALUES (%s, %s) 
        ON DUPLICATE KEY UPDATE 
        username = VALUES(username), 
        last_login = CURRENT_TIMESTAMP
    """
    try:
        execute_query(query, (telegram_id, username), fetch_type=None)
        return True
    except Exception as e:
        logger.error(f"Error saving authenticated user: {e}")
        return False

def validate_credentials(username, password):
    """Validate username and password against bot credentials"""
    if password == BOT_PASSWORD:
        return True
    logger.warning(f"Invalid password attempt for username: {username}")
    return False

# Summary functions
def get_summary_data(date_str):
    """Get summary data for a specific date"""
    query = """
        SELECT SUM(price), SUM(profit)
        FROM (
            SELECT price, profit FROM sale_overview WHERE purchased_date = %s
            UNION ALL
            SELECT price, profit FROM ws_sale_overview WHERE purchased_date = %s
        ) combined_sales
    """
    
    try:
        result = execute_query(query, (date_str, date_str), fetch_type='one')
        
        if result and result[0] is not None:
            total_sales = float(result[0])
            total_profit = float(result[1] or 0)
            return total_sales, total_profit
        return 0, 0
        
    except Exception as e:
        logger.error(f"Error in get_summary_data: {e}")
        return None, None

def get_today_sales_details():
    """Get detailed sales for today"""
    today = get_bangkok_now().strftime('%Y-%m-%d')
    query = """
        SELECT 
            CONCAT('Retail - ', sale_product) as sale_product, 
            customer, 
            price, 
            profit, 
            manager,
            'retail' as sale_type
        FROM sale_overview
        WHERE purchased_date = %s
        
        UNION ALL
        
        SELECT 
            CONCAT('Wholesale - ', sale_product) as sale_product, 
            customer, 
            price, 
            profit, 
            manager,
            'wholesale' as sale_type
        FROM ws_sale_overview
        WHERE purchased_date = %s
        
        ORDER BY price DESC
    """
    
    try:
        return execute_query(query, (today, today), dictionary=True)
    except Exception as e:
        logger.error(f"Error in get_today_sales_details: {e}")
        return []

# Sale functions
def calculate_expired_date(purchased_date, duration_months):
    """Calculate expired date based on purchase date and duration"""
    try:
        if isinstance(purchased_date, str):
            purchased_date = datetime.strptime(purchased_date, '%Y-%m-%d')
        
        year = purchased_date.year
        month = purchased_date.month + int(duration_months)
        day = purchased_date.day
        
        while month > 12:
            year += 1
            month -= 12
        
        try:
            expired_date = purchased_date.replace(year=year, month=month, day=day)
        except ValueError:
            if month == 12:
                next_month = datetime(year + 1, 1, 1)
            else:
                next_month = datetime(year, month + 1, 1)
            expired_date = next_month - timedelta(days=1)
        
        return expired_date.strftime('%Y-%m-%d')
    except Exception as e:
        logger.error(f"Error calculating expired date: {e}")
        return None

def save_sale(data):
    """Save a new sale to database"""
    try:
        if not data.get('expired_date'):
            expired_date = calculate_expired_date(data['purchased_date'], data['duration'])
            if not expired_date:
                return False
            data['expired_date'] = expired_date
        
        table_name = "ws_sale_overview" if data.get('product_type') == 'wholesale' else "sale_overview"
        
        if data.get('product_type') == 'wholesale':
            quantity = data.get('quantity', 1)
            query = f"""
                INSERT INTO {table_name}
                (sale_product, duration, quantity, renew, customer, email, purchased_date, expired_date, manager, note, price, profit)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            params = (
                data['sale_product'], data['duration'], quantity, data['renew'], data['customer'],
                data['email'], data['purchased_date'], data['expired_date'],
                data['manager'], data['note'], data['price'], data['profit']
            )
        else:
            query = f"""
                INSERT INTO {table_name}
                (sale_product, duration, renew, customer, email, purchased_date, expired_date, manager, note, price, profit)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            params = (
                data['sale_product'], data['duration'], data['renew'], data['customer'],
                data['email'], data['purchased_date'], data['expired_date'],
                data['manager'], data['note'], data['price'], data['profit']
            )
        
        execute_query(query, params, fetch_type=None)
        return True
        
    except Exception as e:
        logger.error(f"Error in save_sale: {e}")
        return False

# Handler functions (same as original)
async def auth_required(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Check if user is authenticated"""
    telegram_id = update.effective_user.id
    
    if not check_user_auth(telegram_id):
        if not context.user_data.get('login_flow'):
            await start_login_flow(update, context)
            return False
    return True

async def start_login_flow(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start login process"""
    context.user_data['login_flow'] = True
    context.user_data['login_step'] = 'username'
    
    if update.callback_query:
        await update.callback_query.message.reply_text(
            "Authentication Required\n\n"
            "Please enter your username:"
        )
    else:
        await update.message.reply_text(
            "Authentication Required\n\n"
            "Please enter your username:"
        )

async def handle_login(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle login input"""
    if not context.user_data.get('login_flow'):
        return
    
    step = context.user_data.get('login_step')
    
    if step == 'username':
        context.user_data['temp_username'] = update.message.text
        context.user_data['login_step'] = 'password'
        await update.message.reply_text("Please enter your password:")
        
    elif step == 'password':
        username = context.user_data.get('temp_username')
        password = update.message.text
        telegram_id = update.effective_user.id
        
        if validate_credentials(username, password):
            if save_authenticated_user(telegram_id, username):
                context.user_data.clear()
                
                await update.message.reply_text(
                    "Authentication successful!\n\n"
                    "You can now use all bot features."
                )
                
                await show_main_menu(update, context)
            else:
                logger.error(f"Failed to save authenticated user to database for telegram_id={telegram_id}")
                await update.message.reply_text("Error saving authentication. Please try again.")
                context.user_data['login_step'] = 'username'
                await update.message.reply_text("Please enter your username:")
        else:
            await update.message.reply_text(
                "Invalid credentials\n\n"
                "Please try again with correct username and password."
            )
            context.user_data['login_step'] = 'username'
            await update.message.reply_text("Please enter your username:")

async def show_main_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show main menu after authentication"""
    keyboard = [
        [InlineKeyboardButton("Add Retail Sale", callback_data='add_retail_sale')],
        [InlineKeyboardButton("Add Wholesale Sale", callback_data='add_wholesale_sale')],
        [InlineKeyboardButton("View Summary", callback_data='summary')],
        [InlineKeyboardButton("Expiring Products", callback_data='expiring')],
        [InlineKeyboardButton("Renewals Due Soon", callback_data='renewals')]
    ]
    
    if update.callback_query:
        await update.callback_query.message.reply_text(
            "Welcome to Eraverse Dashboard Bot!\nChoose an option:", 
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
    else:
        await update.message.reply_text(
            "Welcome to Eraverse Dashboard Bot!\nChoose an option:", 
            reply_markup=InlineKeyboardMarkup(keyboard)
        )

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start command handler"""
    if not await auth_required(update, context):
        return
    
    await show_main_menu(update, context)

async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle button callbacks"""
    query = update.callback_query
    await query.answer()

    if not await auth_required(update, context):
        return

    try:
        if query.data == 'add_retail_sale':
            products = fetch_retail_products()
            keyboard, page_products, total_pages = create_paginated_keyboard(products, page=0, callback_prefix='product')
            context.user_data['current_product_type'] = 'retail'
            
            await query.edit_message_text(
                f"Select a retail product (Page 1/{total_pages}):",
                reply_markup=InlineKeyboardMarkup(keyboard)
            )

        elif query.data == 'add_wholesale_sale':
            products = fetch_wholesale_products()
            keyboard, page_products, total_pages = create_paginated_keyboard(products, page=0, callback_prefix='product')
            context.user_data['current_product_type'] = 'wholesale'
            
            await query.edit_message_text(
                f"Select a wholesale product (Page 1/{total_pages}):",
                reply_markup=InlineKeyboardMarkup(keyboard)
            )

        elif query.data == 'summary':
            today = get_bangkok_now().strftime('%Y-%m-%d')
            total_sales, total_profit = get_summary_data(today)
            today_sales_details = get_today_sales_details()
            
            if total_sales is not None:
                response = f"*Summary for {today}:*\n\n"
                response += f"Total Sales: {int(total_sales)} Ks\n"
                response += f"Total Profit: {int(total_profit)} Ks\n\n"
                
                if today_sales_details:
                    response += f"*Today's Sales ({len(today_sales_details)} orders):*\n\n"
                    for idx, sale in enumerate(today_sales_details, 1):
                        response += f"{idx}. {sale['sale_product']}\n"
                        response += f"Customer: {sale['customer']}\n"
                        response += f"Price: {int(sale['price'])} Ks\n\n"
                else:
                    response += "*Today's Sales:* No sales today"
            else:
                response = "Failed to fetch summary data."
            
            await query.edit_message_text(response, parse_mode="Markdown")

        elif query.data.startswith("product_"):
            product_id = query.data.replace("product_", "")
            product = fetch_product_details(product_id)
            
            if product:
                context.user_data.update({
                    "flow": "add_sale", 
                    "product": product, 
                    "awaiting": True
                })
                
                if product.get('product_type') == 'wholesale':
                    input_format = (
                        "Please enter the following (one per line):\n"
                        "Customer Name\n"
                        "Email\n"
                        "Manager\n"
                        "Quantity\n"
                        "[Optional] Custom Price per unit"
                    )
                else:
                    input_format = (
                        "Please enter the following (one per line):\n"
                        "Customer Name\n"
                        "Email\n"
                        "Manager\n"
                        "[Optional] Custom Price"
                    )
                
                await query.edit_message_text(
                    f"*Product:* {product['product_name']}\n"
                    f"*Type:* {product.get('product_type', 'retail').title()}\n"
                    f"*Duration:* {product['duration']} months\n"
                    f"*Wholesale:* {product['wholesale']} Ks\n"
                    f"*Retail:* {product['retail']} Ks\n\n"
                    f"{input_format}",
                    parse_mode="Markdown"
                )
            else:
                await query.edit_message_text("Product not found.")
                
        elif query.data.startswith("page_product_"):
            page = int(query.data.split("_")[-1])
            
            if context.user_data.get('current_product_type') == 'wholesale':
                products = fetch_wholesale_products()
                product_type = "wholesale"
            else:
                products = fetch_retail_products()
                product_type = "retail"
            
            keyboard, page_products, total_pages = create_paginated_keyboard(products, page=page, callback_prefix='product')
            
            await query.edit_message_text(
                f"Select a {product_type} product (Page {page+1}/{total_pages}):",
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
            
        elif query.data == 'page_info':
            await query.answer("Page information")
            
        elif query.data == 'cancel':
            context.user_data.pop('current_product_type', None)
            context.user_data.pop('flow', None)
            context.user_data.pop('product', None)
            context.user_data.pop('awaiting', None)
            await query.edit_message_text("Action cancelled.")
                
    except Exception as e:
        logger.error(f"Error in button_handler: {e}")
        await query.edit_message_text("An error occurred. Please try again.")

async def text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle text input for sale creation"""
    if context.user_data.get("login_flow"):
        await handle_login(update, context)
        return
    
    if not context.user_data.get("awaiting"):
        return

    if not await auth_required(update, context):
        return

    try:
        lines = [l.strip() for l in update.message.text.splitlines() if l.strip()]
        product = context.user_data['product']
        product_type = product.get('product_type', 'retail')

        if product_type == 'wholesale':
            if len(lines) >= 4:
                customer, email, manager = lines[0], lines[1], lines[2]
                
                try:
                    quantity = int(lines[3])
                    if quantity <= 0:
                        await update.message.reply_text("Quantity must be a positive number. Please try again:")
                        return
                except ValueError:
                    await update.message.reply_text("Invalid quantity format. Please enter a number. Please try again:")
                    return
                
                price_per_unit = float(lines[4]) if len(lines) >= 5 and lines[4].replace('.', '').isdigit() else float(product['retail'])
                
                total_price = price_per_unit * quantity
                profit_per_unit = price_per_unit - float(product['wholesale'])
                total_profit = profit_per_unit * quantity
                
                note = f"Quantity: {quantity} units @ {price_per_unit} Ks each"
                quantity_for_db = quantity
                
            else:
                await update.message.reply_text("Invalid input format for wholesale. Please provide at least: Customer, Email, Manager, Quantity\n\nPlease try again with the correct format:")
                return
        else:
            if len(lines) >= 3:
                customer, email, manager = lines[0], lines[1], lines[2]
                
                total_price = float(lines[3]) if len(lines) >= 4 and lines[3].replace('.', '').isdigit() else float(product['retail'])
                
                total_profit = total_price - float(product['wholesale'])
                
                note = ''
                quantity_for_db = 1
            else:
                await update.message.reply_text("Invalid input format for retail. Please provide at least: Customer, Email, Manager\n\nPlease try again with the correct format:")
                return
        
        today = get_bangkok_now()
        
        data = {
            'sale_product': product['product_name'],
            'duration': product['duration'],
            'renew': product['renew'],
            'customer': customer,
            'email': email,
            'purchased_date': today.strftime('%Y-%m-%d'),
            'expired_date': None,
            'manager': manager,
            'note': note,
            'price': total_price,
            'profit': total_profit,
            'product_type': product_type,
            'quantity': quantity_for_db
        }
        
        if save_sale(data):
            if product_type == 'wholesale':
                await update.message.reply_text(f"Wholesale sale saved successfully!\nQuantity: {quantity} units\nTotal: {total_price} Ks")
            else:
                await update.message.reply_text("Sale saved successfully!")
        else:
            await update.message.reply_text("Failed to save sale.")
        
        context.user_data.clear()
        
    except Exception as e:
        logger.error(f"Error in text_handler: {e}")
        await update.message.reply_text("An error occurred. Please try again.")

async def set_commands(app):
    """Set bot commands"""
    await app.bot.set_my_commands([
        BotCommand("start", "Start the bot"),
        BotCommand("summary", "Get sales summary"),
        BotCommand("expiring", "Check expiring products"),
        BotCommand("renewals", "Check renewals due soon")
    ])

# Webhook setup
async def setup_webhook(app, webhook_url):
    """Setup webhook for the bot"""
    await app.bot.set_webhook(url=webhook_url)
    logger.info(f"Webhook set to: {webhook_url}")

async def main():
    """Main function for webhook setup"""
    if not db_pool:
        logger.error("Database pool not initialized. Exiting.")
        return
        
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    await set_commands(app)

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(button_handler))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_handler))

    return app

# For AWS Lambda
async def lambda_handler(event, context):
    """AWS Lambda handler function"""
    try:
        app = await main()
        
        # Parse the incoming webhook
        if 'body' in event:
            update = Update.de_json(json.loads(event['body']), app.bot)
            await app.process_update(update)
        
        return {
            'statusCode': 200,
            'body': json.dumps('OK')
        }
    except Exception as e:
        logger.error(f"Lambda handler error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps('Error')
        }

# For local testing
if __name__ == '__main__':
    asyncio.run(main())
