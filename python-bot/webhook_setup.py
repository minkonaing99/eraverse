# Webhook Setup for Eraverse Bot
# This file contains the configuration and setup for webhook deployment

import os
from creds import BOT_TOKEN

# Webhook Configuration
WEBHOOK_URL = "https://your-domain.com/webhook"  # Replace with your actual webhook URL
WEBHOOK_PATH = "/webhook"
WEBHOOK_PORT = 8443

# AWS Configuration
AWS_REGION = "us-east-1"  # Change to your preferred region
LAMBDA_FUNCTION_NAME = "eraverse-bot-webhook"

# Environment Variables
os.environ['BOT_TOKEN'] = BOT_TOKEN
os.environ['WEBHOOK_URL'] = WEBHOOK_URL

# Webhook Setup Instructions:
"""
1. AWS Lambda Setup:
   - Create a new Lambda function
   - Runtime: Python 3.9+
   - Handler: eraverse_dashboard_webhook.lambda_handler
   - Timeout: 30 seconds
   - Memory: 256 MB

2. API Gateway Setup:
   - Create REST API
   - Create resource with path: /webhook
   - Create POST method
   - Integrate with Lambda function
   - Deploy to stage (prod/dev)

3. Set Webhook URL:
   - Your webhook URL will be: https://your-api-id.execute-api.region.amazonaws.com/prod/webhook
   - Use this URL in the bot setup

4. Environment Variables in Lambda:
   - BOT_TOKEN: Your bot token
   - DB_HOST: Your RDS endpoint
   - DB_USER: Database username
   - DB_PASSWORD: Database password
   - DB_NAME: Database name
   - CHANNEL_ID: Your Telegram channel ID
   - BOT_PASSWORD: Your bot authentication password

5. Required Lambda Layers:
   - mysql-connector-python
   - python-telegram-bot
   - zoneinfo

6. Deployment Steps:
   a. Zip your bot code with dependencies
   b. Upload to Lambda
   c. Set environment variables
   d. Configure API Gateway
   e. Set webhook URL in Telegram
"""

def get_webhook_url():
    """Get the webhook URL for the bot"""
    return WEBHOOK_URL

def setup_webhook_environment():
    """Setup environment variables for webhook"""
    env_vars = {
        'BOT_TOKEN': BOT_TOKEN,
        'WEBHOOK_URL': WEBHOOK_URL,
        'AWS_REGION': AWS_REGION,
        'LAMBDA_FUNCTION_NAME': LAMBDA_FUNCTION_NAME
    }
    return env_vars

if __name__ == "__main__":
    print("Webhook Configuration:")
    print(f"Webhook URL: {WEBHOOK_URL}")
    print(f"Webhook Path: {WEBHOOK_PATH}")
    print(f"Port: {WEBHOOK_PORT}")
    print(f"AWS Region: {AWS_REGION}")
    print(f"Lambda Function: {LAMBDA_FUNCTION_NAME}")
    
    print("\nEnvironment Variables:")
    env_vars = setup_webhook_environment()
    for key, value in env_vars.items():
        print(f"{key}: {value}")

