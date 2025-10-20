# Learning Platform Backend

Node.js backend API for the Learning Management System (LMS).

## 🚀 Features

- **RESTful API** - Clean and well-documented API endpoints
- **JWT Authentication** - Secure token-based authentication with refresh tokens
- **MongoDB Integration** - Mongoose ODM for database operations
- **Payment Processing** - Razorpay integration for course payments
- **Role-based Access Control** - Student, Admin, and Beta user roles
- **Input Validation** - Express-validator for request validation
- **Security Middleware** - Helmet, CORS, and rate limiting
- **Error Handling** - Comprehensive error handling and logging

## 📁 Project Structure

```
backend/
├── config/                 # Configuration files
├── controllers/            # Business logic controllers
├── middleware/             # Custom middleware
│   ├── auth.js            # JWT authentication
│   └── courseAccess.js    # Course access control
├── models/                 # Database schemas
│   ├── User.js            # User model
│   ├── Course.js          # Course model
│   ├── Enrollment.js      # Enrollment model
│   └── Payment.js         # Payment model
├── routes/                 # API route definitions
│   ├── auth.js            # Authentication routes
│   ├── courses.js         # Course routes
│   ├── admin.js           # Admin routes
│   └── razorpay.js        # Payment routes
├── utils/                  # Utility functions
├── uploads/               # File storage
├── server.js              # Main server file
├── package.json           # Dependencies
└── README.md
```

## 🛠️ Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment setup**
   ```bash
   cp env.example .env
   ```

3. **Configure environment variables**
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/learning_platform
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
   JWT_EXPIRE=24h
   JWT_REFRESH_EXPIRE=7d
   RAZORPAY_KEY_ID=your-razorpay-key-id
   RAZORPAY_KEY_SECRET=your-razorpay-key-secret
   PAYMENT_CURRENCY=INR
   REGISTRATION_FEE_AMOUNT=699
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   UPI_ID=your-upi-id@paytm
   MERCHANT_NAME=Learning Platform
   ```

4. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 🔗 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh-token` - Refresh access token
- `PUT /api/auth/profile` - Update user profile

### Courses
- `GET /api/courses` - Get all published courses (with filters)
- `GET /api/courses/featured` - Get featured courses
- `GET /api/courses/categories` - Get course categories
- `GET /api/courses/:courseId` - Get course details
- `GET /api/courses/:courseId/content` - Get course content (enrolled users)
- `GET /api/courses/:courseId/topic/:sectionIndex/:topicIndex` - Get topic content
- `POST /api/courses/:courseId/topic/:sectionIndex/:topicIndex/progress` - Update progress
- `GET /api/courses/:courseId/enrollment-status` - Check enrollment status
- `POST /api/courses/:courseId/enroll` - Enroll in course
- `GET /api/courses/user/enrolled` - Get user's enrolled courses

### Payments
- `GET /api/razorpay/config` - Get Razorpay configuration
- `POST /api/razorpay/create-registration-order` - Create registration payment order
- `POST /api/razorpay/create-course-order` - Create course payment order
- `POST /api/razorpay/verify-payment` - Verify payment
- `POST /api/razorpay/create-payment-link` - Create payment link
- `GET /api/razorpay/payment-status/:paymentId` - Get payment status

### Admin
- `GET /api/admin/dashboard-stats` - Get dashboard statistics
- `GET /api/admin/users` - Get all users (with pagination)
- `PUT /api/admin/users/:userId/status` - Update user status
- `GET /api/admin/courses` - Get all courses (admin view)
- `POST /api/admin/courses` - Create new course
- `PUT /api/admin/courses/:courseId` - Update course
- `DELETE /api/admin/courses/:courseId` - Delete course
- `POST /api/admin/courses/:courseId/sections` - Add section to course
- `POST /api/admin/courses/:courseId/sections/:sectionIndex/topics` - Add topic to section
- `GET /api/admin/enrollments` - Get all enrollments
- `GET /api/admin/payments` - Get all payments

## 🗄️ Database Models

### User Model
```javascript
{
  author_id: String (UUID),
  firstName: String,
  lastName: String,
  email: String (unique),
  password: String (hashed),
  role: String (student/admin/beta),
  isActive: Boolean,
  profile: Object,
  refreshTokens: Array,
  lastLogin: Date,
  hasPaidRegistrationFee: Boolean,
  registrationFeePayment: ObjectId
}
```

### Course Model
```javascript
{
  c_id: String (UUID),
  title: String,
  description: String,
  thumbnail: String,
  price: Number,
  originalPrice: Number,
  currency: String,
  status: String (draft/published/archived),
  author_id: String (UUID),
  sections: Array,
  requirements: Array,
  whatYouWillLearn: Array,
  duration: String,
  accessDuration: String,
  tags: Array,
  level: String,
  language: String,
  enrollmentCount: Number,
  rating: Object,
  isFeatured: Boolean
}
```

### Enrollment Model
```javascript
{
  user: String (UUID),
  course: String (UUID),
  enrolledAt: Date,
  expiresAt: Date,
  status: String (active/expired/cancelled),
  payment: ObjectId,
  progress: Object,
  certificateIssued: Boolean,
  certificateUrl: String,
  notes: Array
}
```

### Payment Model
```javascript
{
  user: String (UUID),
  course: String (UUID),
  amount: Number,
  currency: String,
  status: String (pending/completed/failed/refunded),
  paymentType: String (registration/course),
  paymentGateway: Object,
  paymentMethod: String,
  refund: Object,
  metadata: Object,
  webhookData: Mixed,
  failureReason: String,
  notes: String
}
```

## 🔒 Security Features

- **JWT Authentication** - Access and refresh tokens
- **HTTP-only Cookies** - Secure token storage
- **Password Hashing** - bcryptjs with salt rounds
- **Input Validation** - Express-validator middleware
- **Rate Limiting** - API request throttling
- **CORS Configuration** - Controlled cross-origin access
- **Helmet.js** - Security headers
- **XSS Protection** - Input sanitization

## 🚀 Deployment

### Render.com Deployment

1. **Connect GitHub repository to Render**
2. **Create new Web Service**
3. **Configure settings:**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: Node
4. **Add environment variables**
5. **Deploy**

### Environment Variables for Production

```env
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/learning_platform
JWT_SECRET=your-production-jwt-secret
JWT_REFRESH_SECRET=your-production-refresh-secret
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
FRONTEND_URL=https://your-frontend-domain.vercel.app
```

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run with coverage
npm run test:coverage
```

## 📝 API Documentation

The API follows RESTful conventions and returns JSON responses. All responses include a `success` boolean field and appropriate status codes.

### Response Format
```javascript
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "errors": [ ... ]
}
```

### Error Handling
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource not found)
- `500` - Internal Server Error

## 🔧 Development

### Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests

### Code Style
- ESLint configuration for consistent code style
- Prettier for code formatting
- Conventional commit messages

## 📞 Support

For backend-specific issues, please create an issue in the repository or contact the development team.
