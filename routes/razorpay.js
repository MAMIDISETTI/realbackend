const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const { authenticateToken, requireRegistrationFee } = require('../middleware/auth');

const router = express.Router();

// Helper function to check if Razorpay is available
const checkRazorpayAvailable = (req, res, next) => {
  if (!razorpay) {
    return res.status(503).json({
      success: false,
      message: 'Payment service is not available. Please contact administrator.'
    });
  }
  next();
};

// Initialize Razorpay with fallback values
let razorpay;
try {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_1234567890',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'test_secret_key_1234567890'
  });
} catch (error) {
  console.warn('⚠️  Razorpay initialization failed:', error.message);
  console.warn('⚠️  Payment features will be disabled. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file');
  razorpay = null;
}

// @route   GET /api/razorpay/config
// @desc    Get Razorpay configuration
// @access  Public
router.get('/config', checkRazorpayAvailable, (req, res) => {
  res.json({
    success: true,
    config: {
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_1234567890',
      currency: process.env.PAYMENT_CURRENCY || 'INR',
      merchantName: process.env.MERCHANT_NAME || 'Learning Platform'
    }
  });
});

// @route   POST /api/razorpay/create-registration-order
// @desc    Create registration fee payment order
// @access  Private
router.post('/create-registration-order', authenticateToken, checkRazorpayAvailable, async (req, res) => {
  try {
    const userId = req.user.author_id;

    // Check if user has already paid registration fee
    if (req.user.hasPaidRegistrationFee) {
      return res.status(400).json({
        success: false,
        message: 'Registration fee has already been paid.'
      });
    }

    const amount = parseInt(process.env.REGISTRATION_FEE_AMOUNT || 699) * 100; // Convert to paise
    const currency = process.env.PAYMENT_CURRENCY || 'INR';

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amount,
      currency: currency,
      receipt: `reg_${userId}_${Date.now()}`,
      notes: {
        paymentType: 'registration',
        userId: userId
      }
    });

    // Create payment record
    const payment = new Payment({
      user: userId,
      amount: amount / 100, // Convert back to rupees
      currency: currency,
      paymentType: 'registration',
      paymentGateway: {
        provider: 'razorpay',
        orderId: order.id,
        receipt: order.receipt
      }
    });

    await payment.save();

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      },
      paymentId: payment._id
    });
  } catch (error) {
    console.error('Create registration order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order. Please try again.'
    });
  }
});

// @route   POST /api/razorpay/create-course-order
// @desc    Create course payment order
// @access  Private
router.post('/create-course-order', authenticateToken, requireRegistrationFee, checkRazorpayAvailable, async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user.author_id;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required.'
      });
    }

    // Find the course
    const course = await Course.findOne({ c_id: courseId });
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found.'
      });
    }

    if (course.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Course is not available for purchase.'
      });
    }

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      user: userId,
      course: courseId,
      status: { $in: ['active', 'expired'] }
    });

    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: 'You are already enrolled in this course.'
      });
    }

    const amount = course.price * 100; // Convert to paise
    const currency = course.currency || 'INR';

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amount,
      currency: currency,
      receipt: `course_${courseId}_${userId}_${Date.now()}`,
      notes: {
        paymentType: 'course',
        userId: userId,
        courseId: courseId
      }
    });

    // Create payment record
    const payment = new Payment({
      user: userId,
      course: courseId,
      amount: course.price,
      currency: currency,
      paymentType: 'course',
      paymentGateway: {
        provider: 'razorpay',
        orderId: order.id,
        receipt: order.receipt
      }
    });

    await payment.save();

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      },
      course: {
        c_id: course.c_id,
        title: course.title,
        price: course.price,
        currency: course.currency
      },
      paymentId: payment._id
    });
  } catch (error) {
    console.error('Create course order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order. Please try again.'
    });
  }
});

// @route   POST /api/razorpay/verify-payment
// @desc    Verify payment and process enrollment
// @access  Private
router.post('/verify-payment', authenticateToken, checkRazorpayAvailable, async (req, res) => {
  try {
    const { paymentId, orderId, signature, razorpay_payment_id } = req.body;

    if (!paymentId || !orderId || !signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment verification data.'
      });
    }

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature.'
      });
    }

    // Find payment record
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found.'
      });
    }

    if (payment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Payment has already been processed.'
      });
    }

    // Mark payment as completed
    payment.status = 'completed';
    payment.paymentGateway.paymentId = razorpay_payment_id;
    payment.paymentGateway.signature = signature;
    await payment.save();

    // Process based on payment type
    if (payment.paymentType === 'registration') {
      // Update user registration fee status
      await User.findByIdAndUpdate(
        { author_id: payment.user },
        {
          hasPaidRegistrationFee: true,
          registrationFeePayment: payment._id
        }
      );

      res.json({
        success: true,
        message: 'Registration fee payment successful! You can now enroll in courses.',
        paymentType: 'registration'
      });
    } else if (payment.paymentType === 'course') {
      // Create enrollment
      const course = await Course.findOne({ c_id: payment.course });
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found.'
        });
      }

      // Calculate expiration date
      const accessDuration = course.accessDuration || '1 year';
      const expiresAt = new Date();
      if (accessDuration.includes('year')) {
        const years = parseInt(accessDuration.match(/\d+/)[0]);
        expiresAt.setFullYear(expiresAt.getFullYear() + years);
      } else if (accessDuration.includes('month')) {
        const months = parseInt(accessDuration.match(/\d+/)[0]);
        expiresAt.setMonth(expiresAt.getMonth() + months);
      } else if (accessDuration.includes('day')) {
        const days = parseInt(accessDuration.match(/\d+/)[0]);
        expiresAt.setDate(expiresAt.getDate() + days);
      }

      // Create enrollment
      const enrollment = new Enrollment({
        user: payment.user,
        course: payment.course,
        payment: payment._id,
        expiresAt: expiresAt
      });

      await enrollment.save();

      // Update course enrollment count
      await Course.findByIdAndUpdate(
        course._id,
        { $inc: { enrollmentCount: 1 } }
      );

      res.json({
        success: true,
        message: 'Course enrollment successful! You now have access to the course content.',
        paymentType: 'course',
        enrollment: {
          courseId: course.c_id,
          courseTitle: course.title,
          expiresAt: expiresAt
        }
      });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed. Please contact support.'
    });
  }
});

// @route   POST /api/razorpay/create-payment-link
// @desc    Create payment link for course
// @access  Private
router.post('/create-payment-link', authenticateToken, requireRegistrationFee, checkRazorpayAvailable, async (req, res) => {
  try {
    const { courseId, amount, description } = req.body;
    const userId = req.user.author_id;

    if (!courseId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Course ID and amount are required.'
      });
    }

    const course = await Course.findOne({ c_id: courseId });
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found.'
      });
    }

    // Create payment link
    const paymentLink = await razorpay.paymentLink.create({
      amount: amount * 100, // Convert to paise
      currency: 'INR',
      description: description || `Payment for ${course.title}`,
      customer: {
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email
      },
      notify: {
        sms: false,
        email: true
      },
      reminder_enable: true,
      notes: {
        courseId: courseId,
        userId: userId,
        paymentType: 'course'
      }
    });

    res.json({
      success: true,
      paymentLink: {
        id: paymentLink.id,
        short_url: paymentLink.short_url,
        amount: paymentLink.amount,
        currency: paymentLink.currency,
        status: paymentLink.status
      }
    });
  } catch (error) {
    console.error('Create payment link error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment link. Please try again.'
    });
  }
});

// @route   GET /api/razorpay/payment-status/:paymentId
// @desc    Get payment status
// @access  Private
router.get('/payment-status/:paymentId', authenticateToken, checkRazorpayAvailable, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.author_id;

    const payment = await Payment.findOne({
      _id: paymentId,
      user: userId
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found.'
      });
    }

    res.json({
      success: true,
      payment: {
        id: payment._id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paymentType: payment.paymentType,
        createdAt: payment.createdAt
      }
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment status.'
    });
  }
});

module.exports = router;
