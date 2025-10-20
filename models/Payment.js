const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const paymentSchema = new mongoose.Schema({
  user: {
    type: String,
    required: [true, 'User ID is required'],
    ref: 'User'
  },
  course: {
    type: String,
    ref: 'Course',
    required: function() {
      return this.paymentType === 'course';
    }
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    default: 'INR',
    enum: ['INR', 'USD', 'EUR']
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },
  paymentType: {
    type: String,
    required: [true, 'Payment type is required'],
    enum: ['registration', 'course']
  },
  paymentGateway: {
    provider: {
      type: String,
      default: 'razorpay',
      enum: ['razorpay', 'stripe', 'paypal']
    },
    transactionId: String,
    orderId: String,
    paymentId: String,
    signature: String,
    receipt: String
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'upi', 'netbanking', 'wallet', 'emi', 'cod'],
    default: 'card'
  },
  refund: {
    refundId: String,
    refundAmount: Number,
    refundReason: String,
    refundedAt: Date,
    refundStatus: {
      type: String,
      enum: ['pending', 'processed', 'failed']
    }
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    deviceType: String,
    browser: String
  },
  webhookData: mongoose.Schema.Types.Mixed,
  failureReason: String,
  notes: String
}, {
  timestamps: true
});

// Indexes for better query performance
paymentSchema.index({ user: 1 });
paymentSchema.index({ course: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ paymentType: 1 });
paymentSchema.index({ 'paymentGateway.transactionId': 1 });
paymentSchema.index({ 'paymentGateway.orderId': 1 });
paymentSchema.index({ createdAt: -1 });

// Virtual for formatted amount
paymentSchema.virtual('formattedAmount').get(function() {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: this.currency
  }).format(this.amount);
});

// Virtual for payment status display
paymentSchema.virtual('statusDisplay').get(function() {
  const statusMap = {
    pending: 'Pending',
    completed: 'Completed',
    failed: 'Failed',
    refunded: 'Refunded',
    cancelled: 'Cancelled'
  };
  return statusMap[this.status] || this.status;
});

// Method to mark payment as completed
paymentSchema.methods.markAsCompleted = function(paymentData) {
  this.status = 'completed';
  this.paymentGateway.paymentId = paymentData.paymentId;
  this.paymentGateway.signature = paymentData.signature;
  this.webhookData = paymentData;
  return this.save();
};

// Method to mark payment as failed
paymentSchema.methods.markAsFailed = function(reason) {
  this.status = 'failed';
  this.failureReason = reason;
  return this.save();
};

// Method to process refund
paymentSchema.methods.processRefund = function(refundData) {
  this.status = 'refunded';
  this.refund = {
    refundId: refundData.refundId,
    refundAmount: refundData.amount,
    refundReason: refundData.reason,
    refundedAt: new Date(),
    refundStatus: 'processed'
  };
  return this.save();
};

// Static method to get payment statistics
paymentSchema.statics.getPaymentStats = async function(startDate, endDate) {
  const matchStage = {};
  if (startDate && endDate) {
    matchStage.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);

  return stats;
};

// Static method to get revenue by period
paymentSchema.statics.getRevenueByPeriod = async function(period = 'month') {
  const groupFormat = period === 'day' ? '%Y-%m-%d' : 
                     period === 'week' ? '%Y-%U' : 
                     period === 'month' ? '%Y-%m' : '%Y';

  return await this.aggregate([
    {
      $match: {
        status: 'completed'
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: groupFormat,
            date: '$createdAt'
          }
        },
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
};

module.exports = mongoose.model('Payment', paymentSchema);
