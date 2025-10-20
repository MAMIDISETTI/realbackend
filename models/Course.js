const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const topicSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Topic title is required'],
    trim: true,
    maxlength: [200, 'Topic title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Topic description cannot exceed 1000 characters']
  },
  type: {
    type: String,
    enum: ['video', 'document', 'quiz', 'assignment'],
    default: 'video'
  },
  content: {
    videoUrl: String,
    documentUrl: String,
    duration: String, // for videos
    fileSize: String, // for documents
    thumbnail: String
  },
  isFree: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    required: true
  }
});

const sectionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Section title is required'],
    trim: true,
    maxlength: [200, 'Section title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Section description cannot exceed 500 characters']
  },
  topics: [topicSchema],
  order: {
    type: Number,
    required: true
  }
});

const courseSchema = new mongoose.Schema({
  c_id: {
    type: String,
    default: () => uuidv4(),
    unique: true,
    required: true
  },
  title: {
    type: String,
    required: [true, 'Course title is required'],
    trim: true,
    maxlength: [200, 'Course title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Course description is required'],
    trim: true,
    maxlength: [2000, 'Course description cannot exceed 2000 characters']
  },
  shortDescription: {
    type: String,
    trim: true,
    maxlength: [300, 'Short description cannot exceed 300 characters']
  },
  thumbnail: {
    type: String,
    required: [true, 'Course thumbnail is required']
  },
  price: {
    type: Number,
    required: [true, 'Course price is required'],
    min: [0, 'Price cannot be negative']
  },
  originalPrice: {
    type: Number,
    min: [0, 'Original price cannot be negative']
  },
  currency: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD', 'EUR']
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  author_id: {
    type: String,
    required: [true, 'Author ID is required'],
    ref: 'User'
  },
  sections: [sectionSchema],
  requirements: [{
    type: String,
    trim: true,
    maxlength: [200, 'Requirement cannot exceed 200 characters']
  }],
  whatYouWillLearn: [{
    type: String,
    trim: true,
    maxlength: [200, 'Learning outcome cannot exceed 200 characters']
  }],
  duration: {
    type: String,
    required: [true, 'Course duration is required']
  },
  accessDuration: {
    type: String,
    required: [true, 'Access duration is required'],
    default: '1 year'
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  language: {
    type: String,
    default: 'English'
  },
  enrollmentCount: {
    type: Number,
    default: 0
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  isFeatured: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better query performance
courseSchema.index({ author_id: 1 });
courseSchema.index({ status: 1 });
courseSchema.index({ price: 1 });
courseSchema.index({ tags: 1 });
courseSchema.index({ createdAt: -1 });

// Virtual for discount percentage
courseSchema.virtual('discountPercentage').get(function() {
  if (this.originalPrice && this.originalPrice > this.price) {
    return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
  }
  return 0;
});

// Virtual for total topics count
courseSchema.virtual('totalTopics').get(function() {
  return this.sections.reduce((total, section) => total + section.topics.length, 0);
});

// Virtual for total duration in minutes
courseSchema.virtual('totalDurationMinutes').get(function() {
  let totalMinutes = 0;
  this.sections.forEach(section => {
    section.topics.forEach(topic => {
      if (topic.type === 'video' && topic.content.duration) {
        const duration = topic.content.duration;
        const parts = duration.split(':');
        if (parts.length === 2) {
          totalMinutes += parseInt(parts[0]) * 60 + parseInt(parts[1]);
        } else if (parts.length === 3) {
          totalMinutes += parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
        }
      }
    });
  });
  return totalMinutes;
});

module.exports = mongoose.model('Course', courseSchema);
