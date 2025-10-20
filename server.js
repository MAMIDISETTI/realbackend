const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Debug environment variables
console.log('🔧 Environment variables check:');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✅ Set' : '❌ Not set');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Not set');
console.log('PORT:', process.env.PORT || 'Not set');

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    console.log('CORS Origin check:', origin);
    console.log('Frontend URL:', process.env.FRONTEND_URL);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3000',
      'https://localhost:3000'
    ];
    
    console.log('Allowed origins:', allowedOrigins);
    
    if (allowedOrigins.includes(origin)) {
      console.log('Origin allowed:', origin);
      callback(null, true);
    } else {
      console.log('Origin not allowed:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', (req, res) => {
  console.log('Preflight request received for:', req.url);
  console.log('Origin:', req.headers.origin);
  console.log('Method:', req.headers['access-control-request-method']);
  console.log('Headers:', req.headers['access-control-request-headers']);
  
  res.header('Access-Control-Allow-Origin', req.headers.origin || process.env.FRONTEND_URL);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Expose-Headers', 'Set-Cookie');
  res.status(200).end();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Logging middleware
app.use(morgan('combined'));

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('✅ MongoDB connected successfully');
  
  // Create default accounts after successful connection
  const createDefaultAccounts = require('./scripts/createDefaultAccounts');
  await createDefaultAccounts();
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/razorpay', require('./routes/razorpay'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Learning Platform API is running',
    timestamp: new Date().toISOString()
  });
});

// Test cookie endpoint
app.get('/api/test-cookie', (req, res) => {
  console.log('Test cookie endpoint called');
  console.log('Request cookies:', req.cookies);
  console.log('Request headers:', req.headers);
  
  // Set a test cookie
  res.cookie('testCookie', 'test-value', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 60000, // 1 minute
    path: '/'
  });
  
  res.json({
    success: true,
    message: 'Test cookie set',
    receivedCookies: req.cookies,
    environment: process.env.NODE_ENV,
    headers: req.headers
  });
});

// Debug cookies endpoint
app.get('/api/debug-cookies', (req, res) => {
  console.log('Debug cookies endpoint called');
  console.log('All cookies:', req.cookies);
  console.log('Access token cookie:', req.cookies.accessToken);
  console.log('Refresh token cookie:', req.cookies.refreshToken);
  console.log('Debug access token cookie:', req.cookies.accessTokenDebug);
  console.log('Request headers:', req.headers);
  console.log('Origin:', req.headers.origin);
  
  res.json({
    success: true,
    allCookies: req.cookies,
    accessToken: req.cookies.accessToken ? 'Present' : 'Missing',
    refreshToken: req.cookies.refreshToken ? 'Present' : 'Missing',
    debugAccessToken: req.cookies.accessTokenDebug ? 'Present' : 'Missing',
    headers: req.headers,
    origin: req.headers.origin
  });
});

// Test login endpoint that shows cookie setting
app.post('/api/test-login', (req, res) => {
  console.log('Test login endpoint called');
  console.log('Request body:', req.body);
  console.log('Request cookies:', req.cookies);
  
  // Set test cookies
  res.cookie('testAccessToken', 'test-access-token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/'
  });
  
  res.cookie('testRefreshToken', 'test-refresh-token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  });
  
  res.json({
    success: true,
    message: 'Test cookies set',
    environment: process.env.NODE_ENV,
    frontendUrl: process.env.FRONTEND_URL
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
