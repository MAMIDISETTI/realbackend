const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token from cookies
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token not found. Please login again.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user and check if they're active
    const user = await User.findOne({ 
      author_id: decoded.userId,
      isActive: true 
    }).select('-password -refreshTokens');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found or account deactivated.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error. Please try again.'
    });
  }
};

// Check if user has specific role
const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions. Access denied.'
      });
    }

    next();
  };
};

// Check if user has paid registration fee
const requireRegistrationFee = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (req.user.role === 'admin' || req.user.role === 'beta') {
      return next();
    }

    if (!req.user.hasPaidRegistrationFee) {
      return res.status(402).json({
        success: false,
        message: 'Registration fee payment required to access this feature.',
        paymentRequired: true,
        amount: process.env.REGISTRATION_FEE_AMOUNT || 699
      });
    }

    next();
  } catch (error) {
    console.error('Registration fee check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking registration status.'
    });
  }
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken;
    
    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ 
      author_id: decoded.userId,
      isActive: true 
    }).select('-password -refreshTokens');

    req.user = user;
    next();
  } catch (error) {
    // If token is invalid, just continue without user
    req.user = null;
    next();
  }
};

// Generate JWT tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '24h' }
  );

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );

  return { accessToken, refreshToken };
};

// Set token cookies
const setTokenCookies = (res, accessToken, refreshToken) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'strict', // 'none' for cross-origin in production
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
    ...(isProduction && { domain: process.env.COOKIE_DOMAIN }) // Set domain if provided
  };

  const refreshCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'strict', // 'none' for cross-origin in production
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
    ...(isProduction && { domain: process.env.COOKIE_DOMAIN }) // Set domain if provided
  };

  res.cookie('accessToken', accessToken, cookieOptions);
  res.cookie('refreshToken', refreshToken, refreshCookieOptions);
};

// Clear token cookies
const clearTokenCookies = (res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const clearOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'strict',
    path: '/',
    ...(isProduction && { domain: process.env.COOKIE_DOMAIN })
  };

  res.clearCookie('accessToken', clearOptions);
  res.clearCookie('refreshToken', clearOptions);
};

module.exports = {
  authenticateToken,
  authorizeRole,
  requireRegistrationFee,
  optionalAuth,
  generateTokens,
  setTokenCookies,
  clearTokenCookies
};
