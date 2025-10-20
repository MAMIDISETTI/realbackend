# Backend Setup Guide

This guide will help you set up the Learning Platform backend with the required environment variables and default accounts.

## 🔧 Environment Variables Setup

### 1. Copy Environment Template
```bash
cp env.example .env
```

### 2. Required Environment Variables

#### Database Configuration
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/learning_platform
```

#### JWT Configuration
```env
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
JWT_EXPIRE=24h
JWT_REFRESH_EXPIRE=7d
```

#### Razorpay Configuration
```env
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
```

#### Payment Configuration
```env
PAYMENT_CURRENCY=INR
REGISTRATION_FEE_AMOUNT=699
```

#### Server Configuration
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

#### UPI Configuration
```env
UPI_ID=your-upi-id@paytm
MERCHANT_NAME=Learning Platform
```

#### Default Account Configuration
```env
# Admin Account
ADMIN_EMAIL=admin@learningplatform.com
ADMIN_PASSWORD=Admin123!
ADMIN_FIRST_NAME=Admin
ADMIN_LAST_NAME=User

# Beta Account
BETA_EMAIL=beta@learningplatform.com
BETA_PASSWORD=Beta123!
BETA_FIRST_NAME=Beta
BETA_LAST_NAME=User
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
- Copy `env.example` to `.env`
- Fill in all the required environment variables
- Make sure to use strong, unique values for JWT secrets

### 3. Start the Server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

The server will automatically create the default admin and beta accounts on first startup.

## 👤 Default Accounts

### Admin Account
- **Email**: admin@learningplatform.com
- **Password**: Admin123!
- **Role**: admin
- **Access**: Full admin privileges, can manage courses, users, and payments
- **Registration Fee**: Waived (free access)

### Beta Account
- **Email**: beta@learningplatform.com
- **Password**: Beta123!
- **Role**: beta
- **Access**: Free access to all courses without payment
- **Registration Fee**: Waived (free access)

## 🔧 Manual Account Setup

If you need to manually create the default accounts:

```bash
npm run setup-accounts
```

This will:
- Connect to your MongoDB database
- Create admin and beta accounts if they don't exist
- Display the account credentials
- Disconnect from the database

## 🛡️ Security Notes

### JWT Secrets
- Use strong, random strings for JWT secrets
- Keep them secure and never commit them to version control
- Use different secrets for development and production

### Admin Password
- Change the default admin password after first login
- Use a strong password with uppercase, lowercase, numbers, and special characters

### Database Security
- Use MongoDB Atlas with proper network access rules
- Enable authentication and use strong credentials
- Regularly backup your database

## 🌐 Production Deployment

### Render.com Deployment

1. **Connect your GitHub repository to Render**
2. **Create a new Web Service**
3. **Configure the following settings:**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: Node
4. **Add environment variables in Render dashboard:**
   - Copy all variables from your `.env` file
   - Make sure to use production values for JWT secrets
   - Update `FRONTEND_URL` to your production frontend URL

### Environment Variables for Production

```env
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/learning_platform
JWT_SECRET=your-production-jwt-secret-here
JWT_REFRESH_SECRET=your-production-refresh-secret-here
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
FRONTEND_URL=https://your-frontend-domain.vercel.app
ADMIN_EMAIL=admin@learningplatform.com
ADMIN_PASSWORD=Admin123!
ADMIN_FIRST_NAME=Admin
ADMIN_LAST_NAME=User
BETA_EMAIL=beta@learningplatform.com
BETA_PASSWORD=Beta123!
BETA_FIRST_NAME=Beta
BETA_LAST_NAME=User
```

## 🔍 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Check your MongoDB URI
   - Ensure your IP is whitelisted in MongoDB Atlas
   - Verify your database credentials

2. **JWT Secret Error**
   - Make sure JWT_SECRET and JWT_REFRESH_SECRET are set
   - Use strong, unique values
   - Restart the server after changing secrets

3. **Razorpay Integration Error**
   - Verify your Razorpay API keys
   - Check if your Razorpay account is active
   - Ensure you're using the correct environment (test/live)

4. **Default Accounts Not Created**
   - Check the server logs for errors
   - Run `npm run setup-accounts` manually
   - Verify environment variables are set correctly

### Logs

Check the server logs for detailed error information:
```bash
# Development
npm run dev

# Production
npm start
```

## 📞 Support

If you encounter any issues:
1. Check the troubleshooting section above
2. Review the server logs for error details
3. Verify all environment variables are set correctly
4. Create an issue in the repository with detailed error information
