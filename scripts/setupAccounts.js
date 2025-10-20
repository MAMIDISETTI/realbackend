#!/usr/bin/env node

/**
 * Setup script to create default admin and beta accounts
 * Run with: node scripts/setupAccounts.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const createDefaultAccounts = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    console.log('🔧 Setting up default accounts...');

    // Create admin account
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
        hasPaidRegistrationFee: true
      });
      await admin.save();
      console.log('✅ Admin account created successfully');
      console.log(`   Email: ${process.env.ADMIN_EMAIL}`);
      console.log(`   Password: ${process.env.ADMIN_PASSWORD}`);
    } else {
      console.log('ℹ️  Admin account already exists');
    }

    // Create beta account
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
        hasPaidRegistrationFee: true
      });
      await beta.save();
      console.log('✅ Beta account created successfully');
      console.log(`   Email: ${process.env.BETA_EMAIL}`);
      console.log(`   Password: ${process.env.BETA_PASSWORD}`);
    } else {
      console.log('ℹ️  Beta account already exists');
    }

    console.log('🎉 Default accounts setup complete');
    console.log('\n📋 Account Summary:');
    console.log('==================');
    console.log('Admin Account:');
    console.log(`  Email: ${process.env.ADMIN_EMAIL}`);
    console.log(`  Password: ${process.env.ADMIN_PASSWORD}`);
    console.log(`  Role: admin`);
    console.log(`  Access: Full admin privileges`);
    console.log('\nBeta Account:');
    console.log(`  Email: ${process.env.BETA_EMAIL}`);
    console.log(`  Password: ${process.env.BETA_PASSWORD}`);
    console.log(`  Role: beta`);
    console.log(`  Access: Free course access`);

  } catch (error) {
    console.error('❌ Error setting up accounts:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the script
createDefaultAccounts();
