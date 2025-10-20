const express = require('express');
const { body, validationResult } = require('express-validator');
const Course = require('../models/Course');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const Payment = require('../models/Payment');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Apply admin authentication to all routes
router.use(authenticateToken);
router.use(authorizeRole('admin'));

// @route   GET /api/admin/dashboard-stats
// @desc    Get dashboard statistics
// @access  Private (Admin only)
router.get('/dashboard-stats', async (req, res) => {
  try {
    const [
      totalUsers,
      totalCourses,
      totalEnrollments,
      totalRevenue,
      recentEnrollments,
      recentPayments
    ] = await Promise.all([
      User.countDocuments(),
      Course.countDocuments(),
      Enrollment.countDocuments(),
      Payment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Enrollment.find()
        .populate('course', 'title')
        .populate('user', 'firstName lastName email')
        .sort({ enrolledAt: -1 })
        .limit(5),
      Payment.find({ status: 'completed' })
        .populate('user', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

    const revenue = totalRevenue.length > 0 ? totalRevenue[0].total : 0;

    // Get monthly revenue for chart
    const monthlyRevenue = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1)
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalCourses,
        totalEnrollments,
        totalRevenue: revenue,
        monthlyRevenue
      },
      recent: {
        enrollments: recentEnrollments,
        payments: recentPayments
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with pagination
// @access  Private (Admin only)
router.get('/users', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      role = '',
      status = ''
    } = req.query;

    const filter = {};
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (role) filter.role = role;
    if (status) filter.isActive = status === 'active';

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(filter)
      .select('-password -refreshTokens')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalUsers = await User.countDocuments(filter);

    res.json({
      success: true,
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalUsers / parseInt(limit)),
        totalUsers,
        hasNext: skip + users.length < totalUsers,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

// @route   PUT /api/admin/users/:userId/status
// @desc    Update user status (activate/deactivate)
// @access  Private (Admin only)
router.put('/users/:userId/status', async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    const user = await User.findOneAndUpdate(
      { author_id: userId },
      { isActive },
      { new: true }
    ).select('-password -refreshTokens');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status'
    });
  }
});

// @route   GET /api/admin/courses
// @desc    Get all courses (including drafts)
// @access  Private (Admin only)
router.get('/courses', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      author = ''
    } = req.query;

    const filter = {};
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) filter.status = status;
    if (author) filter.author_id = author;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const courses = await Course.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Manually populate author information since we're using UUIDs instead of ObjectIds
    const coursesWithAuthors = await Promise.all(
      courses.map(async (course) => {
        const author = await User.findOne({ author_id: course.author_id })
          .select('firstName lastName email');
        return {
          ...course.toObject(),
          author: author || { firstName: 'Unknown', lastName: 'Author', email: 'unknown@example.com' }
        };
      })
    );

    const totalCourses = await Course.countDocuments(filter);

    res.json({
      success: true,
      courses: coursesWithAuthors,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCourses / parseInt(limit)),
        totalCourses,
        hasNext: skip + coursesWithAuthors.length < totalCourses,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch courses'
    });
  }
});

// @route   POST /api/admin/courses
// @desc    Create new course
// @access  Private (Admin only)
router.post('/courses', [
  body('title').trim().isLength({ min: 5, max: 200 }).withMessage('Title must be between 5 and 200 characters'),
  body('description').trim().isLength({ min: 20, max: 2000 }).withMessage('Description must be between 20 and 2000 characters'),
  body('price').isNumeric().withMessage('Price must be a number'),
  body('currency').optional().isIn(['INR', 'USD', 'EUR']).withMessage('Invalid currency'),
  body('duration').optional().trim().notEmpty().withMessage('Duration cannot be empty'),
  body('accessDuration').optional().trim().notEmpty().withMessage('Access duration cannot be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const courseData = {
      ...req.body,
      author_id: req.user.author_id,
      currency: req.body.currency || 'INR',
      duration: req.body.duration || 'Not specified',
      accessDuration: req.body.accessDuration || 'lifetime',
      status: req.body.status || 'draft',
      level: req.body.level || 'beginner',
      language: req.body.language || 'English',
      tags: req.body.tags || [],
      requirements: req.body.requirements || [],
      whatYouWillLearn: req.body.whatYouWillLearn || [],
      sections: req.body.sections || [],
      enrollmentCount: 0,
      rating: { average: 0, count: 0 },
      isFeatured: req.body.isFeatured || false
    };

    const course = new Course(courseData);
    await course.save();

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      course
    });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create course'
    });
  }
});

// @route   PUT /api/admin/courses/:courseId
// @desc    Update course
// @access  Private (Admin only)
router.put('/courses/:courseId', [
  body('title').optional().trim().isLength({ min: 5, max: 200 }),
  body('description').optional().trim().isLength({ min: 20, max: 2000 }),
  body('price').optional().isNumeric(),
  body('currency').optional().isIn(['INR', 'USD', 'EUR'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { courseId } = req.params;
    const updateData = req.body;

    const course = await Course.findOneAndUpdate(
      { c_id: courseId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.json({
      success: true,
      message: 'Course updated successfully',
      course
    });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update course'
    });
  }
});

// @route   DELETE /api/admin/courses/:courseId
// @desc    Delete course
// @access  Private (Admin only)
router.delete('/courses/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findOneAndDelete({ c_id: courseId });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Also delete related enrollments and payments
    await Promise.all([
      Enrollment.deleteMany({ course: courseId }),
      Payment.deleteMany({ course: courseId })
    ]);

    res.json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete course'
    });
  }
});

// @route   GET /api/admin/enrollments
// @desc    Get all enrollments
// @access  Private (Admin only)
router.get('/enrollments', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = '',
      course = '',
      user = ''
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (course) filter.course = course;
    if (user) filter.user = user;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const enrollments = await Enrollment.find(filter)
      .populate('user', 'firstName lastName email')
      .populate('course', 'title price')
      .populate('payment', 'amount currency status')
      .sort({ enrolledAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalEnrollments = await Enrollment.countDocuments(filter);

    res.json({
      success: true,
      enrollments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalEnrollments / parseInt(limit)),
        totalEnrollments,
        hasNext: skip + enrollments.length < totalEnrollments,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get enrollments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch enrollments'
    });
  }
});

// @route   GET /api/admin/payments
// @desc    Get all payments
// @access  Private (Admin only)
router.get('/payments', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = '',
      paymentType = '',
      startDate = '',
      endDate = ''
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (paymentType) filter.paymentType = paymentType;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const payments = await Payment.find(filter)
      .populate('user', 'firstName lastName email')
      .populate('course', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalPayments = await Payment.countDocuments(filter);

    res.json({
      success: true,
      payments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalPayments / parseInt(limit)),
        totalPayments,
        hasNext: skip + payments.length < totalPayments,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments'
    });
  }
});

// @route   POST /api/admin/courses/:courseId/sections
// @desc    Add section to course
// @access  Private (Admin only)
router.post('/courses/:courseId/sections', [
  body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Section title must be between 3 and 200 characters'),
  body('description').optional().trim().isLength({ max: 500 }),
  body('order').isInt({ min: 0 }).withMessage('Order must be a non-negative integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { courseId } = req.params;
    const { title, description, order } = req.body;

    const course = await Course.findOne({ c_id: courseId });
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    course.sections.push({
      title,
      description,
      order,
      topics: []
    });

    await course.save();

    res.json({
      success: true,
      message: 'Section added successfully',
      section: course.sections[course.sections.length - 1]
    });
  } catch (error) {
    console.error('Add section error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add section'
    });
  }
});

// @route   POST /api/admin/courses/:courseId/sections/:sectionIndex/topics
// @desc    Add topic to section
// @access  Private (Admin only)
router.post('/courses/:courseId/sections/:sectionIndex/topics', [
  body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Topic title must be between 3 and 200 characters'),
  body('type').isIn(['video', 'document', 'quiz', 'assignment']).withMessage('Invalid topic type'),
  body('order').isInt({ min: 0 }).withMessage('Order must be a non-negative integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { courseId, sectionIndex } = req.params;
    const topicData = req.body;

    const course = await Course.findOne({ c_id: courseId });
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const section = course.sections[parseInt(sectionIndex)];
    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    section.topics.push(topicData);
    await course.save();

    res.json({
      success: true,
      message: 'Topic added successfully',
      topic: section.topics[section.topics.length - 1]
    });
  } catch (error) {
    console.error('Add topic error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add topic'
    });
  }
});

module.exports = router;
