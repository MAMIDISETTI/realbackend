const express = require('express');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { 
  checkCourseAccess, 
  checkTopicAccess, 
  checkEnrollmentStatus,
  checkEnrollmentEligibility 
} = require('../middleware/courseAccess');

const router = express.Router();

// @route   GET /api/courses
// @desc    Get all published courses with pagination and filters
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      search = '',
      category = '',
      level = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      minPrice = '',
      maxPrice = ''
    } = req.query;

    // Build filter object
    const filter = { status: 'published' };

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    if (category) {
      filter.tags = { $in: [new RegExp(category, 'i')] };
    }

    if (level) {
      filter.level = level;
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseInt(minPrice);
      if (maxPrice) filter.price.$lte = parseInt(maxPrice);
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get courses with pagination
    const courses = await Course.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-sections') // Exclude detailed content for listing
      .lean();

    // Get total count for pagination
    const totalCourses = await Course.countDocuments(filter);

    // Add enrollment status for authenticated users
    if (req.user) {
      const courseIds = courses.map(course => course.c_id);
      const enrollments = await Enrollment.find({
        user: req.user.author_id,
        course: { $in: courseIds },
        status: 'active'
      }).select('course status expiresAt');

      const enrollmentMap = {};
      enrollments.forEach(enrollment => {
        enrollmentMap[enrollment.course] = {
          isEnrolled: true,
          status: enrollment.status,
          expiresAt: enrollment.expiresAt
        };
      });

      courses.forEach(course => {
        course.enrollment = enrollmentMap[course.c_id] || { isEnrolled: false };
      });
    }

    res.json({
      success: true,
      courses,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCourses / parseInt(limit)),
        totalCourses,
        hasNext: skip + courses.length < totalCourses,
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

// @route   GET /api/courses/featured
// @desc    Get featured courses
// @access  Public
router.get('/featured', optionalAuth, async (req, res) => {
  try {
    const courses = await Course.find({
      status: 'published',
      isFeatured: true
    })
    .sort({ createdAt: -1 })
    .limit(6)
    .select('-sections')
    .lean();

    res.json({
      success: true,
      courses
    });
  } catch (error) {
    console.error('Get featured courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured courses'
    });
  }
});

// @route   GET /api/courses/categories
// @desc    Get course categories/tags
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const categories = await Course.aggregate([
      { $match: { status: 'published' } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    res.json({
      success: true,
      categories: categories.map(cat => ({
        name: cat._id,
        count: cat.count
      }))
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
});

// @route   GET /api/courses/:courseId
// @desc    Get course details by ID
// @access  Public
router.get('/:courseId', optionalAuth, async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findOne({ 
      c_id: courseId,
      status: 'published' 
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check enrollment status for authenticated users
    let enrollment = null;
    if (req.user) {
      enrollment = await Enrollment.findOne({
        user: req.user.author_id,
        course: courseId,
        status: 'active'
      });
    }

    res.json({
      success: true,
      course: {
        ...course.toObject(),
        enrollment: enrollment ? {
          isEnrolled: true,
          status: enrollment.status,
          expiresAt: enrollment.expiresAt,
          progress: enrollment.progress
        } : { isEnrolled: false }
      }
    });
  } catch (error) {
    console.error('Get course details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course details'
    });
  }
});

// @route   GET /api/courses/:courseId/content
// @desc    Get course content (sections and topics)
// @access  Private (requires enrollment)
router.get('/:courseId/content', authenticateToken, checkCourseAccess, async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findOne({ c_id: courseId })
      .select('sections title description');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.json({
      success: true,
      course: {
        c_id: course.c_id,
        title: course.title,
        description: course.description,
        sections: course.sections
      }
    });
  } catch (error) {
    console.error('Get course content error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course content'
    });
  }
});

// @route   GET /api/courses/:courseId/topic/:sectionIndex/:topicIndex
// @desc    Get specific topic content
// @access  Private (requires enrollment)
router.get('/:courseId/topic/:sectionIndex/:topicIndex', 
  authenticateToken, 
  checkTopicAccess, 
  async (req, res) => {
    try {
      res.json({
        success: true,
        topic: req.topic,
        section: req.section
      });
    } catch (error) {
      console.error('Get topic content error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch topic content'
      });
    }
  }
);

// @route   POST /api/courses/:courseId/topic/:sectionIndex/:topicIndex/progress
// @desc    Update topic progress
// @access  Private (requires enrollment)
router.post('/:courseId/topic/:sectionIndex/:topicIndex/progress',
  authenticateToken,
  checkTopicAccess,
  async (req, res) => {
    try {
      const { sectionIndex, topicIndex } = req.params;
      const enrollment = req.enrollment;

      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: 'You are not enrolled in this course'
        });
      }

      // Update progress
      await enrollment.updateProgress(parseInt(sectionIndex), parseInt(topicIndex));
      
      // Calculate completion percentage
      await enrollment.calculateCompletionPercentage();

      res.json({
        success: true,
        message: 'Progress updated successfully',
        progress: enrollment.progress
      });
    } catch (error) {
      console.error('Update progress error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update progress'
      });
    }
  }
);

// @route   GET /api/courses/:courseId/enrollment-status
// @desc    Check enrollment status
// @access  Private
router.get('/:courseId/enrollment-status', 
  authenticateToken, 
  checkEnrollmentStatus, 
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const enrollment = req.enrollment;

      res.json({
        success: true,
        enrollment: enrollment ? {
          isEnrolled: true,
          status: enrollment.status,
          enrolledAt: enrollment.enrolledAt,
          expiresAt: enrollment.expiresAt,
          progress: enrollment.progress,
          daysRemaining: enrollment.daysRemaining
        } : {
          isEnrolled: false
        }
      });
    } catch (error) {
      console.error('Get enrollment status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check enrollment status'
      });
    }
  }
);

// @route   POST /api/courses/:courseId/enroll
// @desc    Enroll in a course (after payment)
// @access  Private
router.post('/:courseId/enroll', 
  authenticateToken, 
  checkEnrollmentEligibility, 
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const userId = req.user.author_id;
      const course = req.course;

      // This endpoint is typically called after successful payment
      // The actual enrollment is handled in the payment verification
      res.json({
        success: true,
        message: 'Please complete payment to enroll in this course',
        course: {
          c_id: course.c_id,
          title: course.title,
          price: course.price,
          currency: course.currency
        }
      });
    } catch (error) {
      console.error('Enroll course error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process enrollment'
      });
    }
  }
);

// @route   GET /api/courses/user/enrolled
// @desc    Get user's enrolled courses
// @access  Private
router.get('/user/enrolled', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.author_id;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const enrollments = await Enrollment.find({
      user: userId,
      status: 'active'
    })
    .populate('course', 'c_id title description thumbnail price currency duration')
    .sort({ enrolledAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const totalEnrollments = await Enrollment.countDocuments({
      user: userId,
      status: 'active'
    });

    res.json({
      success: true,
      enrollments: enrollments.map(enrollment => ({
        enrollmentId: enrollment._id,
        course: enrollment.course,
        enrolledAt: enrollment.enrolledAt,
        expiresAt: enrollment.expiresAt,
        progress: enrollment.progress,
        daysRemaining: enrollment.daysRemaining
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalEnrollments / parseInt(limit)),
        totalEnrollments,
        hasNext: skip + enrollments.length < totalEnrollments,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get enrolled courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch enrolled courses'
    });
  }
});

module.exports = router;
