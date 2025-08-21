# Eraverse Bot Webhook Deployment Guide

## Overview

This guide will help you deploy your Eraverse Telegram bot using webhooks on AWS Lambda, which will:

- ✅ Eliminate polling requests (much more efficient)
- ✅ Reduce server load and costs
- ✅ Provide instant message responses
- ✅ Scale automatically with traffic

## Prerequisites

- AWS Account
- Amazon RDS MySQL database (already set up)
- Python 3.9+ installed locally
- AWS CLI configured

## Step 1: Prepare Your Code

### 1.1 Create Deployment Package

```bash
# Create a deployment directory
mkdir eraverse-bot-deployment
cd eraverse-bot-deployment

# Copy your bot files
cp ../eraverse_dashboard.py ./lambda_function.py
cp ../creds.py ./
cp ../requirements_webhook.txt ./requirements.txt
```

### 1.2 Install Dependencies

```bash
# Install dependencies in a local directory
pip install -r requirements.txt -t ./

# Remove unnecessary files
find . -type d -name "__pycache__" -exec rm -rf {} +
find . -type d -name "*.dist-info" -exec rm -rf {} +
```

### 1.3 Create Lambda Handler

Create `lambda_function.py` with this content:

```python
import json
import asyncio
from eraverse_dashboard import main, lambda_handler

# For direct Lambda invocation
def handler(event, context):
    return asyncio.run(lambda_handler(event, context))
```

## Step 2: AWS Lambda Setup

### 2.1 Create Lambda Function

1. Go to AWS Lambda Console
2. Click "Create function"
3. Choose "Author from scratch"
4. Function name: `eraverse-bot-webhook`
5. Runtime: Python 3.9
6. Architecture: x86_64
7. Click "Create function"

### 2.2 Upload Code

1. In your Lambda function, go to "Code" tab
2. Click "Upload from" → ".zip file"
3. Upload your deployment package
4. Click "Save"

### 2.3 Configure Environment Variables

Add these environment variables in Lambda:

```
BOT_TOKEN=your_bot_token
DB_HOST=your_rds_endpoint
DB_USER=your_db_username
DB_PASSWORD=your_db_password
DB_NAME=eraverse
CHANNEL_ID=your_channel_id
BOT_PASSWORD=your_bot_password
```

### 2.4 Configure Lambda Settings

- **Timeout**: 30 seconds
- **Memory**: 256 MB
- **Handler**: `lambda_function.handler`

## Step 3: API Gateway Setup

### 3.1 Create API

1. Go to API Gateway Console
2. Click "Create API"
3. Choose "REST API" → "Build"
4. API name: `eraverse-bot-api`
5. Click "Create API"

### 3.2 Create Resource

1. Click "Actions" → "Create Resource"
2. Resource Name: `webhook`
3. Resource Path: `/webhook`
4. Click "Create Resource"

### 3.3 Create Method

1. Select the `/webhook` resource
2. Click "Actions" → "Create Method"
3. Method: `POST`
4. Integration type: Lambda Function
5. Lambda Function: `eraverse-bot-webhook`
6. Click "Save"

### 3.4 Deploy API

1. Click "Actions" → "Deploy API"
2. Stage name: `prod`
3. Click "Deploy"

### 3.5 Get Webhook URL

Your webhook URL will be:

```
https://your-api-id.execute-api.region.amazonaws.com/prod/webhook
```

## Step 4: Set Webhook URL

### 4.1 Set Webhook in Telegram

Replace `YOUR_BOT_TOKEN` and `YOUR_WEBHOOK_URL`:

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "YOUR_WEBHOOK_URL"}'
```

### 4.2 Verify Webhook

```bash
curl -X GET "https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo"
```

## Step 5: Test Your Bot

1. Send a message to your bot
2. Check Lambda logs in CloudWatch
3. Verify database connections
4. Test all bot features

## Step 6: Monitoring and Logs

### 6.1 CloudWatch Logs

- Go to CloudWatch → Log groups
- Find your Lambda function logs
- Monitor for errors and performance

### 6.2 Set Up Alarms

Create CloudWatch alarms for:

- Lambda errors
- High latency
- Database connection issues

## Troubleshooting

### Common Issues:

1. **Timeout Errors**

   - Increase Lambda timeout
   - Optimize database queries
   - Check RDS connection

2. **Memory Errors**

   - Increase Lambda memory
   - Optimize code
   - Reduce connection pool size

3. **Database Connection Issues**

   - Check RDS security groups
   - Verify credentials
   - Test connection from Lambda

4. **Webhook Not Receiving Updates**
   - Verify webhook URL is correct
   - Check API Gateway logs
   - Ensure Lambda has proper permissions

## Cost Optimization

### Lambda Costs:

- **Free tier**: 1M requests/month
- **Pay per use**: ~$0.20 per 1M requests
- **Memory**: ~$0.0000166667 per GB-second

### RDS Costs:

- Your existing RDS costs
- Consider using RDS Proxy for connection pooling

## Security Best Practices

1. **Environment Variables**: Store secrets in AWS Secrets Manager
2. **VPC**: Place Lambda in VPC for RDS access
3. **IAM**: Use least privilege permissions
4. **HTTPS**: Always use HTTPS for webhooks
5. **Rate Limiting**: Implement rate limiting in API Gateway

## Migration from Polling

1. **Backup**: Backup your current bot
2. **Deploy**: Deploy webhook version
3. **Test**: Test thoroughly
4. **Switch**: Set webhook URL
5. **Monitor**: Monitor for 24-48 hours
6. **Cleanup**: Remove old polling bot

## Support

If you encounter issues:

1. Check CloudWatch logs
2. Verify all environment variables
3. Test database connectivity
4. Review API Gateway logs
5. Check Telegram webhook status

## Next Steps

After successful deployment:

1. Set up monitoring and alerts
2. Configure backup strategies
3. Plan for scaling
4. Document your setup
5. Train team members

---

**Congratulations!** Your bot is now running on webhooks with much better performance and lower costs! 🎉

