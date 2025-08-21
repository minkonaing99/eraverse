import asyncio
import nest_asyncio
from creds import BOT_TOKEN, DB_CONFIG, CHANNEL_ID

nest_asyncio.apply()

import mysql.connector
from datetime import datetime, timedelta, date
from zoneinfo import ZoneInfo
from telegram import (
    Update, InlineKeyboardButton, InlineKeyboardMarkup, BotCommand
)
from telegram.ext import (
    ApplicationBuilder, CommandHandler, CallbackQueryHandler,
    MessageHandler, ContextTypes, filters
)


def fetch_products():
    """Fetch all products from both retail and wholesale products_catalog tables"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute("""
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
        """)
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()

def fetch_retail_products():
    """Fetch only retail products from products_catalog table"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                CONCAT('R-', product_id) as product_id, 
                product_name, 
                duration, 
                wholesale, 
                retail,
                'retail' as product_type
            FROM products_catalog 
            ORDER BY product_name
        """)
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()

def fetch_wholesale_products():
    """Fetch only wholesale products from ws_products_catalog table"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                CONCAT('WS-', product_id) as product_id, 
                product_name, 
                duration, 
                wholesale, 
                retail,
                'wholesale' as product_type
            FROM ws_products_catalog 
            ORDER BY product_name
        """)
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()

def fetch_product_details(product_id):
    """Fetch product details by ID from either retail or wholesale table"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True, buffered=True)
        
        # Check if it's a retail or wholesale product
        if product_id.startswith('R-'):
            actual_id = product_id.replace('R-', '')
            cursor.execute("SELECT *, 'retail' as product_type FROM products_catalog WHERE product_id = %s", (actual_id,))
        elif product_id.startswith('WS-'):
            actual_id = product_id.replace('WS-', '')
            cursor.execute("SELECT *, 'wholesale' as product_type FROM ws_products_catalog WHERE product_id = %s", (actual_id,))
        else:
            # Fallback to retail table for backward compatibility
            cursor.execute("SELECT *, 'retail' as product_type FROM products_catalog WHERE product_id = %s", (product_id,))
            
        return cursor.fetchone()
    finally:
        cursor.close()
        conn.close()
        
def get_summary_data(date_str):
    """Get summary data for a specific date from both retail and wholesale tables"""
    total_profit = 0
    total_sales = 0

    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Get sales and profit for the date from both tables
        cursor.execute("""
            SELECT SUM(price), SUM(profit)
            FROM (
                SELECT price, profit FROM sale_overview WHERE purchased_date = %s
                UNION ALL
                SELECT price, profit FROM ws_sale_overview WHERE purchased_date = %s
            ) combined_sales
        """, (date_str, date_str))
        result = cursor.fetchone()
        
        if result and result[0] is not None:
            total_sales = float(result[0])
            total_profit = float(result[1] or 0)

        return total_sales, total_profit

    except Exception as e:
        print("Summary error:", e)
        return None, None
    finally:
        try:
            cursor.close()
            conn.close()
        except:
            pass

def get_monthly_summary():
    """Get monthly summary data from both retail and wholesale tables"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Get current month's data from both tables
        current_month = datetime.now(ZoneInfo("Asia/Bangkok")).strftime('%Y-%m')
        cursor.execute("""
            SELECT SUM(price), SUM(profit), COUNT(*)
            FROM (
                SELECT price, profit FROM sale_overview WHERE purchased_date LIKE %s
                UNION ALL
                SELECT price, profit FROM ws_sale_overview WHERE purchased_date LIKE %s
            ) combined_sales
        """, (f"{current_month}%", f"{current_month}%"))
        result = cursor.fetchone()
        
        if result and result[0] is not None:
            monthly_sales = float(result[0])
            monthly_profit = float(result[1] or 0)
            monthly_count = int(result[2] or 0)
        else:
            monthly_sales = 0
            monthly_profit = 0
            monthly_count = 0

        return monthly_sales, monthly_profit, monthly_count

    except Exception as e:
        print("Monthly summary error:", e)
        return 0, 0, 0
    finally:
        try:
            cursor.close()
            conn.close()
        except:
            pass

def get_today_sales_details():
    """Get detailed sales for today from both retail and wholesale tables"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)

        today = datetime.now(ZoneInfo("Asia/Bangkok")).strftime('%Y-%m-%d')
        cursor.execute("""
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
        """, (today, today))
        results = cursor.fetchall()
        
        return results

    except Exception as e:
        print("Today sales details error:", e)
        return []
    finally:
        try:
            cursor.close()
            conn.close()
        except:
            pass
        
async def auto_send_daily_notifications(context: ContextTypes.DEFAULT_TYPE):
    """Automatically send daily notifications for expiring products and renewals"""
    today = datetime.now(ZoneInfo("Asia/Bangkok")).date()
    
    # Get expiring products
    expiring_data = get_expiring_soon_products()
    expiring_soon = []

    for row in expiring_data:
        try:
            raw = row["expired_date"]
            if isinstance(raw, str):
                end_date = datetime.strptime(raw, "%Y-%m-%d").date()
            elif isinstance(raw, datetime):
                end_date = raw.date()
            elif isinstance(raw, date):
                end_date = raw
            else:
                continue
            days_left = (end_date - today).days
            if 0 <= days_left <= 1:
                row["days_left"] = days_left
                row["expired_date"] = end_date.strftime("%Y-%m-%d")
                expiring_soon.append(row)
        except Exception as e:
            print(f"[AutoSend] Error parsing expiring row: {row} -> {e}")
            continue

    # Get renewals due soon
    renewals = get_renewals_due_soon()

    def safe(text):
        return str(text).replace('_', '\\_').replace('*', '\\*').replace('[', '\\[')

    # Send expiring products notification
    if expiring_soon:
        expiring_soon.sort(key=lambda x: x["days_left"])
        batch_size = 10
        for i in range(0, len(expiring_soon), batch_size):
            group = expiring_soon[i:i + batch_size]
            lines = []
            for idx, item in enumerate(group, start=i + 1):
                days_text = "Today!" if item["days_left"] == 0 else f"{item['days_left']} day(s)"
                # Format dates to readable format
                if isinstance(item['purchased_date'], str):
                    purchased_date = datetime.strptime(item['purchased_date'], '%Y-%m-%d').strftime('%d %b %Y')
                else:
                    purchased_date = item['purchased_date'].strftime('%d %b %Y')
                    
                if isinstance(item['expired_date'], str):
                    expired_date = datetime.strptime(item['expired_date'], '%Y-%m-%d').strftime('%d %b %Y')
                else:
                    expired_date = item['expired_date'].strftime('%d %b %Y')
                
                lines.append(
                    f"{idx}. Product: {safe(item['sale_product'])}\n"
                    f"Customer: `{safe(item['customer'])}`\n"
                    f"Email: `{safe(item['email'] or '-')}`\n"
                    f"{purchased_date} to {expired_date}\n"
                    f"Ends in: {days_text}\n"
                )
            message = "*Expiring Products:*\n\n" + "\n".join(lines)
            try:
                await context.bot.send_message(chat_id=CHANNEL_ID, text=message, parse_mode="Markdown")
            except Exception as e:
                print(f"[AutoSend] Failed to send expiring batch starting at #{i+1}: {e}")
    else:
        await context.bot.send_message(chat_id=CHANNEL_ID, text="No products expiring within 2 days.")

    # Send renewals notification
    if renewals:
        batch_size = 10
        for i in range(0, len(renewals), batch_size):
            group = renewals[i:i + batch_size]
            lines = []
            for idx, item in enumerate(group, start=i + 1):
                days_text = "Today!" if item["days_left"] == 0 else f"{item['days_left']} day(s)"
                # Format dates to readable format
                if isinstance(item['purchased_date'], str):
                    purchased_date = datetime.strptime(item['purchased_date'], '%Y-%m-%d').strftime('%d %b %Y')
                else:
                    purchased_date = item['purchased_date'].strftime('%d %b %Y')
                    
                if isinstance(item['expired_date'], str):
                    expired_date = datetime.strptime(item['expired_date'], '%Y-%m-%d').strftime('%d %b %Y')
                else:
                    expired_date = item['expired_date'].strftime('%d %b %Y')
                
                lines.append(
                    f"{idx}. Product: {safe(item['sale_product'])}\n"
                    f"Customer: `{safe(item['customer'])}`\n"
                    f"Email: `{safe(item['email'] or '-')}`\n"
                    f"{purchased_date} to {expired_date}\n"
                    f"Next Due: {item['next_due'].strftime('%d %b %Y')}\n"
                    f"Due in: {days_text}\n"
                )
            message = "*Renewals Due Soon:*\n\n" + "\n".join(lines)
            try:
                await context.bot.send_message(chat_id=CHANNEL_ID, text=message, parse_mode="Markdown")
            except Exception as e:
                print(f"[AutoSend] Failed to send renewals batch starting at #{i+1}: {e}")
    else:
        await context.bot.send_message(chat_id=CHANNEL_ID, text="No renewals due within 2 days.")

def get_expiring_soon_products():
    """Get products that are expiring soon from both retail and wholesale tables"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT 
                CONCAT('Retail - ', sale_product) as sale_product, 
                customer, 
                email, 
                purchased_date, 
                expired_date,
                'retail' as sale_type
            FROM sale_overview
            WHERE expired_date IS NOT NULL
            
            UNION ALL
            
            SELECT 
                CONCAT('Wholesale - ', sale_product) as sale_product, 
                customer, 
                email, 
                purchased_date, 
                expired_date,
                'wholesale' as sale_type
            FROM ws_sale_overview
            WHERE expired_date IS NOT NULL
            
            ORDER BY expired_date ASC
        """)
        results = cursor.fetchall()
        return results
    finally:
        cursor.close()
        conn.close()

def save_sale(data):
    """Save a new sale to either sale_overview or ws_sale_overview table based on product type"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Calculate expired_date if not provided
        if not data.get('expired_date'):
            purchased_date = datetime.strptime(data['purchased_date'], '%Y-%m-%d')
            # Add months properly (handles end-of-month cases)
            year = purchased_date.year
            month = purchased_date.month + int(data['duration'])
            day = purchased_date.day
            
            # Handle year rollover
            while month > 12:
                year += 1
                month -= 12
            
            # Handle end-of-month cases (e.g., Jan 31 + 1 month = Feb 28/29)
            try:
                expired_date = purchased_date.replace(year=year, month=month, day=day)
            except ValueError:
                # If the day doesn't exist in the target month, use the last day of that month
                if month == 12:
                    next_month = datetime(year + 1, 1, 1)
                else:
                    next_month = datetime(year, month + 1, 1)
                expired_date = next_month - timedelta(days=1)
            
            data['expired_date'] = expired_date.strftime('%Y-%m-%d')
        
        # Determine which table to use based on product type
        table_name = "ws_sale_overview" if data.get('product_type') == 'wholesale' else "sale_overview"
        
        if data.get('product_type') == 'wholesale':
            # Use quantity directly from data
            quantity = data.get('quantity', 1)
            
            cursor.execute(f"""
                INSERT INTO {table_name}
                (sale_product, duration, quantity, renew, customer, email, purchased_date, expired_date, manager, note, price, profit)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                data['sale_product'], data['duration'], quantity, data['renew'], data['customer'],
                data['email'], data['purchased_date'], data['expired_date'],
                data['manager'], data['note'], data['price'], data['profit']
            ))
        else:
            # Retail sales don't have quantity field
            cursor.execute(f"""
                INSERT INTO {table_name}
                (sale_product, duration, renew, customer, email, purchased_date, expired_date, manager, note, price, profit)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                data['sale_product'], data['duration'], data['renew'], data['customer'],
                data['email'], data['purchased_date'], data['expired_date'],
                data['manager'], data['note'], data['price'], data['profit']
            ))
        conn.commit()
        return True
    finally:
        cursor.close()
        conn.close()

def get_renewals_due_soon():
    """Get subscriptions that need renewal within 3 days from both retail and wholesale tables"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)
        
        # Get all sales with renew > 0 from both tables
        cursor.execute("""
            SELECT 
                CONCAT('Retail - ', sale_product) as sale_product, 
                customer, 
                email, 
                purchased_date, 
                expired_date, 
                duration, 
                renew,
                'retail' as sale_type
            FROM sale_overview
            WHERE renew > 0 AND expired_date IS NOT NULL
            
            UNION ALL
            
            SELECT 
                CONCAT('Wholesale - ', sale_product) as sale_product, 
                customer, 
                email, 
                purchased_date, 
                expired_date, 
                duration, 
                renew,
                'wholesale' as sale_type
            FROM ws_sale_overview
            WHERE renew > 0 AND expired_date IS NOT NULL
            
            ORDER BY expired_date ASC
        """)
        results = cursor.fetchall()
        
        renewals = []
        today = datetime.now(ZoneInfo("Asia/Bangkok")).date()
        
        for row in results:
            try:
                # Parse dates
                if isinstance(row['purchased_date'], str):
                    purchased_date = datetime.strptime(row['purchased_date'], '%Y-%m-%d').date()
                else:
                    purchased_date = row['purchased_date']
                    
                if isinstance(row['expired_date'], str):
                    expired_date = datetime.strptime(row['expired_date'], '%Y-%m-%d').date()
                else:
                    expired_date = row['expired_date']
                
                renew_months = int(row['renew'])
                duration = int(row['duration'])
                
                # Skip if renew >= duration (no renewals needed)
                if renew_months >= duration:
                    continue
                
                # Calculate next due date
                next_due = calculate_next_due_date(purchased_date, renew_months, today)
                if not next_due:
                    continue
                
                # Check if next due is within 2 days
                days_left = (next_due - today).days
                if 0 <= days_left <= 2:
                    # Check if it's not already expiring soon
                    days_to_expiry = (expired_date - today).days
                    if days_to_expiry > 3:  # Not expiring soon
                        renewals.append({
                            'sale_product': row['sale_product'],
                            'customer': row['customer'],
                            'email': row['email'],
                            'purchased_date': purchased_date,
                            'expired_date': expired_date,
                            'next_due': next_due,
                            'days_left': days_left,
                            'renew': renew_months,
                            'sale_type': row['sale_type']
                        })
                        
            except Exception as e:
                print(f"Error processing renewal row: {row} -> {e}")
                continue
        
        # Sort by days left, then by next due date
        renewals.sort(key=lambda x: (x['days_left'], x['next_due']))
        return renewals
        
    except Exception as e:
        print("Renewals error:", e)
        return []
    finally:
        try:
            cursor.close()
            conn.close()
        except:
            pass

def calculate_next_due_date(purchased_date, renew_months, base_date):
    """Calculate next due date for renewal"""
    try:
        # Start from purchase date
        due_date = purchased_date
        
        # Keep adding renew_months until we're at or after base_date
        while due_date < base_date:
            # Add months to due_date
            year = due_date.year
            month = due_date.month + renew_months
            day = due_date.day
            
            # Handle year rollover
            while month > 12:
                year += 1
                month -= 12
            
            # Handle end-of-month cases
            try:
                due_date = due_date.replace(year=year, month=month, day=day)
            except ValueError:
                # If the day doesn't exist in the target month, use the last day
                if month == 12:
                    next_month = datetime(year + 1, 1, 1)
                else:
                    next_month = datetime(year, month + 1, 1)
                due_date = (next_month - timedelta(days=1)).date()
        
        return due_date
        
    except Exception as e:
        print(f"Error calculating next due date: {e}")
        return None

# === HANDLERS ===
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start command handler"""
    keyboard = [
        [InlineKeyboardButton("Add Retail Sale", callback_data='add_retail_sale')],
        [InlineKeyboardButton("Add Wholesale Sale", callback_data='add_wholesale_sale')],
        [InlineKeyboardButton("View Summary", callback_data='summary')],
        [InlineKeyboardButton("Expiring Products", callback_data='expiring')],
        [InlineKeyboardButton("Renewals Due Soon", callback_data='renewals')]
    ]
    await update.message.reply_text("Welcome to Eraverse Dashboard Bot!\nChoose an option:", reply_markup=InlineKeyboardMarkup(keyboard))

async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle button callbacks"""
    query = update.callback_query
    await query.answer()

    if query.data == 'add_retail_sale':
        # Show only retail products
        products = fetch_retail_products()
        keyboard, row = [], []
        for i, (product_id, name, duration, wholesale, retail, product_type) in enumerate(products, 1):
            row.append(InlineKeyboardButton(name, callback_data=f"product_{product_id}"))
            if i % 2 == 0:
                keyboard.append(row)
                row = []
        if row:
            keyboard.append(row)
        
        await query.edit_message_text(
            "Select a retail product:",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )

    elif query.data == 'add_wholesale_sale':
        # Show only wholesale products
        products = fetch_wholesale_products()
        keyboard, row = [], []
        for i, (product_id, name, duration, wholesale, retail, product_type) in enumerate(products, 1):
            row.append(InlineKeyboardButton(name, callback_data=f"product_{product_id}"))
            if i % 2 == 0:
                keyboard.append(row)
                row = []
        if row:
            keyboard.append(row)
        
        await query.edit_message_text(
            "Select a wholesale product:",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )

    elif query.data == 'summary':
        # Show today's summary
        today = datetime.now(ZoneInfo("Asia/Bangkok")).strftime('%Y-%m-%d')
        total_sales, total_profit = get_summary_data(today)
        
        if total_sales is not None:
            response = (
                f"*Summary for {today}:*\n\n"
                f"Total Sales: {total_sales:.2f} Ks\n"
                f"Total Profit: {total_profit:.2f} Ks"
            )
        else:
            response = "Failed to fetch summary data."
        
        await query.edit_message_text(response, parse_mode="Markdown")

    elif query.data == 'expiring':
        # Show expiring products
        await expiring_handler(update, context)

    elif query.data == 'renewals':
        # Show renewals due soon
        await renewals_handler(update, context)



    elif query.data.startswith("product_"):
        # Product selected, get details and start input flow
        product_id = query.data.replace("product_", "")
        product = fetch_product_details(product_id)
        
        if product:
            context.user_data.update({
                "flow": "add_sale", 
                "product": product, 
                "awaiting": True
            })
            
            # Check if it's a wholesale product to show different input format
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

async def text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle text input for sale creation"""
    if not context.user_data.get("awaiting"):
        return

    lines = [l.strip() for l in update.message.text.splitlines() if l.strip()]
    product = context.user_data['product']
    product_type = product.get('product_type', 'retail')

    # Different handling for wholesale vs retail
    if product_type == 'wholesale':
        # Wholesale format: Customer, Email, Manager, Quantity, [Optional] Custom Price per unit
        if len(lines) >= 4:
            customer, email, manager = lines[0], lines[1], lines[2]
            
            # Parse quantity
            try:
                quantity = int(lines[3])
                if quantity <= 0:
                    await update.message.reply_text("❌ Quantity must be a positive number. Please try again:")
                    return
            except ValueError:
                await update.message.reply_text("❌ Invalid quantity format. Please enter a number. Please try again:")
                return
            
            # Parse optional price per unit
            price_per_unit = float(lines[4]) if len(lines) >= 5 and lines[4].replace('.', '').isdigit() else float(product['retail'])
            
            # Calculate total price and profit
            total_price = price_per_unit * quantity
            profit_per_unit = price_per_unit - float(product['wholesale'])
            total_profit = profit_per_unit * quantity
            
            # Create note with quantity info
            note = f"Quantity: {quantity} units @ {price_per_unit} Ks each"
            
            # Store quantity in data for database insertion
            quantity_for_db = quantity
            
        else:
            await update.message.reply_text("Invalid input format for wholesale. Please provide at least: Customer, Email, Manager, Quantity\n\nPlease try again with the correct format:")
            return
    else:
        # Retail format: Customer, Email, Manager, [Optional] Custom Price
        if len(lines) >= 3:
            customer, email, manager = lines[0], lines[1], lines[2]
            
            # Parse optional price
            total_price = float(lines[3]) if len(lines) >= 4 and lines[3].replace('.', '').isdigit() else float(product['retail'])
            
            # Calculate profit
            total_profit = total_price - float(product['wholesale'])
            
            # No quantity for retail
            note = ''
            quantity_for_db = 1  # Default quantity for retail
        else:
            await update.message.reply_text("Invalid input format for retail. Please provide at least: Customer, Email, Manager\n\nPlease try again with the correct format:")
            return
    
    today = datetime.now(ZoneInfo("Asia/Bangkok"))
    
    data = {
        'sale_product': product['product_name'],
        'duration': product['duration'],
        'renew': product['renew'],  # Get renew from product catalog
        'customer': customer,
        'email': email,
        'purchased_date': today.strftime('%Y-%m-%d'),
        'expired_date': None,  # Will be calculated in save_sale
        'manager': manager,
        'note': note,
        'price': total_price,
        'profit': total_profit,
        'product_type': product_type,
        'quantity': quantity_for_db
    }
    
    if save_sale(data):
        if product_type == 'wholesale':
            await update.message.reply_text(f"✅ Wholesale sale saved successfully!\nQuantity: {quantity} units\nTotal: {total_price} Ks")
        else:
            await update.message.reply_text("✅ Sale saved successfully!")
    else:
        await update.message.reply_text("❌ Failed to save sale.")
    
    # Clear the context after successful save
    context.user_data.clear()

async def expiring_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle expiring products command"""
    today = datetime.now(ZoneInfo("Asia/Bangkok")).date()
    data = get_expiring_soon_products()
    soon = []

    for row in data:
        try:
            raw = row["expired_date"]
            if isinstance(raw, str):
                end_date = datetime.strptime(raw, "%Y-%m-%d").date()
            elif isinstance(raw, datetime):
                end_date = raw.date()
            elif isinstance(raw, date):
                end_date = raw
            else:
                continue

            days_left = (end_date - today).days
            if 0 <= days_left <= 1:
                row["days_left"] = days_left
                row["expired_date"] = end_date.strftime("%Y-%m-%d")
                soon.append(row)
        except Exception as e:
            print(f"[Expiring CMD] Error parsing row: {row} -> {e}")
            continue

    if not soon:
        response = "No products expiring within 2 days."
        if update.callback_query:
            await update.callback_query.edit_message_text(response)
        else:
            await update.message.reply_text(response)
        return

    soon.sort(key=lambda x: x["days_left"])

    def safe(text):
        return str(text).replace('_', '\\_').replace('*', '\\*').replace('[', '\\[')

    batch_size = 10
    for i in range(0, len(soon), batch_size):
        group = soon[i:i + batch_size]
        lines = []
        for idx, item in enumerate(group, start=i + 1):
            days_text = "Today!" if item["days_left"] == 0 else f"{item['days_left']} day(s)"
            # Format dates to readable format
            if isinstance(item['purchased_date'], str):
                purchased_date = datetime.strptime(item['purchased_date'], '%Y-%m-%d').strftime('%d %b %Y')
            else:
                purchased_date = item['purchased_date'].strftime('%d %b %Y')
                
            if isinstance(item['expired_date'], str):
                expired_date = datetime.strptime(item['expired_date'], '%Y-%m-%d').strftime('%d %b %Y')
            else:
                expired_date = item['expired_date'].strftime('%d %b %Y')
            
            lines.append(
                f"{idx}. Product: {safe(item['sale_product'])}\n"
                f"Customer: `{safe(item['customer'])}`\n"
                f"Email: `{safe(item['email'] or '-')}`\n"
                f"{purchased_date} to {expired_date}\n"
                f"Ends in: {days_text}\n"
            )

        message = "\n".join(lines)
        
        try:
            if update.callback_query:
                if i == 0:
                    await update.callback_query.edit_message_text(message, parse_mode="Markdown")
                else:
                    await update.callback_query.message.reply_text(message, parse_mode="Markdown")
            else:
                await update.message.reply_text(message, parse_mode="Markdown")
        except Exception as e:
            print(f"[Expiring CMD] Failed to send batch starting at #{i+1}: {e}")

async def renewals_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle renewals due soon command"""
    renewals = get_renewals_due_soon()

    if not renewals:
        response = "No subscriptions due for renewal within 2 days."
        if update.callback_query:
            await update.callback_query.edit_message_text(response)
        else:
            await update.message.reply_text(response)
        return

    def safe(text):
        return str(text).replace('_', '\\_').replace('*', '\\*').replace('[', '\\[')

    batch_size = 10
    for i in range(0, len(renewals), batch_size):
        group = renewals[i:i + batch_size]
        lines = []
        for idx, item in enumerate(group, start=i + 1):
            days_text = "Today!" if item["days_left"] == 0 else f"{item['days_left']} day(s)"
            # Format dates to readable format
            if isinstance(item['purchased_date'], str):
                purchased_date = datetime.strptime(item['purchased_date'], '%Y-%m-%d').strftime('%d %b %Y')
            else:
                purchased_date = item['purchased_date'].strftime('%d %b %Y')
                
            if isinstance(item['expired_date'], str):
                expired_date = datetime.strptime(item['expired_date'], '%Y-%m-%d').strftime('%d %b %Y')
            else:
                expired_date = item['expired_date'].strftime('%d %b %Y')
            
            lines.append(
                f"{idx}. Product: {safe(item['sale_product'])}\n"
                f"Customer: `{safe(item['customer'])}`\n"
                f"Email: `{safe(item['email'] or '-')}`\n"
                f"{purchased_date} to {expired_date}\n"
                f"Next Due: {item['next_due'].strftime('%d %b %Y')}\n"
                f"Ends in: {days_text}\n"
            )

        message = "\n".join(lines)
        
        try:
            if update.callback_query:
                if i == 0:
                    await update.callback_query.edit_message_text(message, parse_mode="Markdown")
                else:
                    await update.callback_query.message.reply_text(message, parse_mode="Markdown")
            else:
                await update.message.reply_text(message, parse_mode="Markdown")
        except Exception as e:
            print(f"[Renewals CMD] Failed to send batch starting at #{i+1}: {e}")

async def summary_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle summary command"""
    try:
        if context.args:
            date_str = context.args[0]
            datetime.strptime(date_str, '%Y-%m-%d')  # Validate format
        else:
            date_str = datetime.now(ZoneInfo("Asia/Bangkok")).strftime('%Y-%m-%d')

    except ValueError:
        await update.message.reply_text("Invalid date format. Use `/summary YYYY-MM-DD`", parse_mode="Markdown")
        return

    # Get daily summary
    daily_sales, daily_profit = get_summary_data(date_str)
    
    # Get monthly summary
    monthly_sales, monthly_profit, monthly_count = get_monthly_summary()
    
    # Get today's detailed sales
    today_sales_details = get_today_sales_details()

    if daily_sales is None:
        await update.message.reply_text("Failed to fetch summary.")
        return

    # Build response
    response = f"*Sales Summary for {date_str}*\n\n"
    
    # Daily summary
    response += f"*Daily Summary:*\n"
    response += f"Sales: {int(daily_sales)} Ks\n"
    response += f"Profit: {int(daily_profit)} Ks\n\n"
    
    # Monthly summary
    current_month = datetime.now(ZoneInfo("Asia/Bangkok")).strftime('%B %Y')
    response += f"*Monthly Summary ({current_month}):*\n"
    response += f"Total Sales: {int(monthly_sales)} Ks\n"
    response += f"Total Profit: {int(monthly_profit)} Ks\n"
    response += f"Total Orders: {monthly_count}\n\n"

    await update.message.reply_text(response, parse_mode="Markdown")
    
    # Send today's sales details in batches of 10
    if today_sales_details:
        batch_size = 10
        for i in range(0, len(today_sales_details), batch_size):
            batch = today_sales_details[i:i + batch_size]
            batch_response = f"*Today's Sales ({len(today_sales_details)} orders):*\n\n"
            
            for j, sale in enumerate(batch, i + 1):
                batch_response += f"{j}. {sale['sale_product']}\n"
                batch_response += f"Customer: {sale['customer']}\n"
                batch_response += f"Price: {int(sale['price'])} Ks\n\n"
            
            await update.message.reply_text(batch_response, parse_mode="Markdown")
    else:
        await update.message.reply_text("*Today's Sales:* No sales today", parse_mode="Markdown")

async def set_commands(app):
    """Set bot commands"""
    await app.bot.set_my_commands([
        BotCommand("start", "Start the bot"),
        BotCommand("summary", "Get sales summary"),
        BotCommand("expiring", "Check expiring products"),
        BotCommand("renewals", "Check renewals due soon")
    ])

async def main():
    """Main function"""
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    await set_commands(app)

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("summary", summary_handler))
    app.add_handler(CommandHandler("expiring", expiring_handler))
    app.add_handler(CommandHandler("renewals", renewals_handler))
    app.add_handler(CallbackQueryHandler(button_handler))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_handler))

    # Schedule daily notifications check at 6 AM Bangkok time
    from datetime import time as dtime
    bangkok_6am = dtime(hour=6, minute=0, tzinfo=ZoneInfo("Asia/Bangkok"))
    app.job_queue.run_daily(
        auto_send_daily_notifications,
        time=bangkok_6am
    )

    print("Bot running with auto-scheduler...")
    await app.run_polling()

# ✅ Entry point
if __name__ == '__main__':
    asyncio.run(main())
