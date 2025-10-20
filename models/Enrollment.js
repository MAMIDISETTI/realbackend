const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const enrollmentSchema = new mongoose.Schema({
  user: {
    type: String,
    required: [true, 'User ID is required'],
    ref: 'User'
  },
  course: {
    type: String,
    required: [true, 'Course ID is required'],
    ref: 'Course'
  },
  enrolledAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: [true, 'Expiration date is required']
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'suspended'],
    default: 'active'
  },
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: [true, 'Payment reference is required']
  },
  progress: {
    completedTopics: [{
      sectionIndex: Number,
      topicIndex: Number,
      completedAt: {
        type: Date,
        default: Date.now
      }
    }],
    lastAccessedTopic: {
      sectionIndex: Number,
      topicIndex: Number,
      lastAccessedAt: {
        type: Date,
        default: Date.now
      }
    },
    completionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  certificateIssued: {
    type: Boolean,
    default: false
  },
  certificateUrl: String,
  notes: [{
    content: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for better query performance
enrollmentSchema.index({ user: 1, course: 1 }, { unique: true });
enrollmentSchema.index({ user: 1 });
enrollmentSchema.index({ course: 1 });
enrollmentSchema.index({ status: 1 });
enrollmentSchema.index({ expiresAt: 1 });

// Virtual for enrollment duration in days
enrollmentSchema.virtual('enrollmentDurationDays').get(function() {
  const diffTime = Math.abs(this.expiresAt - this.enrolledAt);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for days remaining
enrollmentSchema.virtual('daysRemaining').get(function() {
  if (this.status !== 'active') return 0;
  const now = new Date();
  const diffTime = this.expiresAt - now;
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
});

// Method to check if enrollment is active
enrollmentSchema.methods.isActive = function() {
  return this.status === 'active' && new Date() < this.expiresAt;
};

// Method to update progress
enrollmentSchema.methods.updateProgress = function(sectionIndex, topicIndex) {
  const topicKey = `${sectionIndex}-${topicIndex}`;
  const existingTopic = this.progress.completedTopics.find(
    topic => topic.sectionIndex === sectionIndex && topic.topicIndex === topicIndex
  );
  
  if (!existingTopic) {
    this.progress.completedTopics.push({
      sectionIndex,
      topicIndex,
      completedAt: new Date()
    });
  }
  
  // Update last accessed topic
  this.progress.lastAccessedTopic = {
    sectionIndex,
    topicIndex,
    lastAccessedAt: new Date()
  };
  
  return this.save();
};

// Method to calculate completion percentage
enrollmentSchema.methods.calculateCompletionPercentage = async function() {
  const Course = mongoose.model('Course');
  const course = await Course.findOne({ c_id: this.course });
  
  if (!course) return 0;
  
  const totalTopics = course.sections.reduce((total, section) => total + section.topics.length, 0);
  const completedTopics = this.progress.completedTopics.length;
  
  this.progress.completionPercentage = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
  
  return this.save();
};

module.exports = mongoose.model('Enrollment', enrollmentSchema);
