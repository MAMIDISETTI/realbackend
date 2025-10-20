const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');

// Check if user has access to a specific course
const checkCourseAccess = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.author_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to access course content.'
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

    // Check if course is published
    if (course.status !== 'published') {
      return res.status(403).json({
        success: false,
        message: 'Course is not available for access.'
      });
    }

    // Check if user is enrolled
    const enrollment = await Enrollment.findOne({
      user: userId,
      course: courseId,
      status: 'active'
    });

    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'You are not enrolled in this course. Please enroll to access the content.',
        courseId: courseId,
        courseTitle: course.title,
        price: course.price
      });
    }

    // Check if enrollment has expired
    if (new Date() > enrollment.expiresAt) {
      return res.status(403).json({
        success: false,
        message: 'Your course access has expired. Please renew your enrollment.',
        expiredAt: enrollment.expiresAt
      });
    }

    // Add enrollment info to request
    req.enrollment = enrollment;
    req.course = course;
    next();
  } catch (error) {
    console.error('Course access check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking course access.'
    });
  }
};

// Check if user can access a specific topic
const checkTopicAccess = async (req, res, next) => {
  try {
    const { courseId, sectionIndex, topicIndex } = req.params;
    const userId = req.user?.author_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
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

    // Check if section and topic exist
    const section = course.sections[parseInt(sectionIndex)];
    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found.'
      });
    }

    const topic = section.topics[parseInt(topicIndex)];
    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found.'
      });
    }

    // Check if topic is free
    if (topic.isFree) {
      req.topic = topic;
      req.section = section;
      return next();
    }

    // Check enrollment for paid topics
    const enrollment = await Enrollment.findOne({
      user: userId,
      course: courseId,
      status: 'active'
    });

    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'You need to enroll in this course to access this content.',
        courseId: courseId,
        courseTitle: course.title,
        price: course.price
      });
    }

    // Check if enrollment has expired
    if (new Date() > enrollment.expiresAt) {
      return res.status(403).json({
        success: false,
        message: 'Your course access has expired.'
      });
    }

    req.topic = topic;
    req.section = section;
    req.enrollment = enrollment;
    next();
  } catch (error) {
    console.error('Topic access check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking topic access.'
    });
  }
};

// Check if user is enrolled in a course (for enrollment status)
const checkEnrollmentStatus = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.author_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const enrollment = await Enrollment.findOne({
      user: userId,
      course: courseId
    });

    req.enrollment = enrollment;
    next();
  } catch (error) {
    console.error('Enrollment status check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking enrollment status.'
    });
  }
};

// Check if user can enroll in a course
const checkEnrollmentEligibility = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.author_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // Check if user has paid registration fee
    if (!req.user.hasPaidRegistrationFee && req.user.role === 'student') {
      return res.status(402).json({
        success: false,
        message: 'Registration fee payment required to enroll in courses.',
        paymentRequired: true,
        amount: process.env.REGISTRATION_FEE_AMOUNT || 699
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
        message: 'You are already enrolled in this course.',
        enrollment: existingEnrollment
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
        message: 'Course is not available for enrollment.'
      });
    }

    req.course = course;
    next();
  } catch (error) {
    console.error('Enrollment eligibility check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking enrollment eligibility.'
    });
  }
};

module.exports = {
  checkCourseAccess,
  checkTopicAccess,
  checkEnrollmentStatus,
  checkEnrollmentEligibility
};
