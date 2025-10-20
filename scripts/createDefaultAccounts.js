const User = require('../models/User');

const createDefaultAccounts = async () => {
  try {
    console.log('🔧 Checking for default accounts...');

    // Check if admin account exists
    const existingAdmin = await User.findOne({ email: process.env.ADMIN_EMAIL });
    if (!existingAdmin) {
      console.log('👤 Creating admin account...');
      const admin = new User({
        firstName: process.env.ADMIN_FIRST_NAME || 'Admin',
        lastName: process.env.ADMIN_LAST_NAME || 'User',
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
        role: 'admin',
        isActive: true,
        hasPaidRegistrationFee: true // Admin gets free access
      });
      await admin.save();
      console.log('✅ Admin account created successfully');
      console.log(`   Email: ${process.env.ADMIN_EMAIL}`);
      console.log(`   Password: ${process.env.ADMIN_PASSWORD}`);
    } else {
      console.log('ℹ️  Admin account already exists');
    }

    // Check if beta account exists
    const existingBeta = await User.findOne({ email: process.env.BETA_EMAIL });
    if (!existingBeta) {
      console.log('👤 Creating beta account...');
      const beta = new User({
        firstName: process.env.BETA_FIRST_NAME || 'Beta',
        lastName: process.env.BETA_LAST_NAME || 'User',
        email: process.env.BETA_EMAIL,
        password: process.env.BETA_PASSWORD,
        role: 'beta',
        isActive: true,
        hasPaidRegistrationFee: true // Beta users get free access
      });
      await beta.save();
      console.log('✅ Beta account created successfully');
      console.log(`   Email: ${process.env.BETA_EMAIL}`);
      console.log(`   Password: ${process.env.BETA_PASSWORD}`);
    } else {
      console.log('ℹ️  Beta account already exists');
    }

    console.log('🎉 Default accounts setup complete');
  } catch (error) {
    console.error('❌ Error creating default accounts:', error);
  }
};

module.exports = createDefaultAccounts;
