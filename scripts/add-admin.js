#!/usr/bin/env node
/**
 * Admin User Management Script
 * 
 * Add admin users to the database for both development and production environments.
 * Automatically loads environment variables from .env file if available.
 * 
 * Usage Examples:
 * - Development: node scripts/add-admin.js your-email@example.com
 * - Production: MONGODB_URI=mongodb://... node scripts/add-admin.js admin@example.com
 * - With env var: ADMIN_EMAIL=admin@example.com node scripts/add-admin.js
 * - With .env file: Create .env file with MONGODB_URI, then run script normally
 */
const { MongoClient } = require('mongodb');
const path = require('path');

// Load environment variables from .env file
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (error) {
  // If dotenv is not available, provide helpful guidance
  console.log('💡 Note: dotenv package not found. To use .env files, install dependencies:');
  console.log('   cd server && npm install');
  console.log('   or run: node -r dotenv/config scripts/add-admin.js your-email@example.com');
  console.log('');
}

/**
 * Admin User Management Script
 * 
 * Add admin users to the database for both development and production environments.
 * 
 * Usage Examples:
 * - Development: node add-admin.js your-email@example.com
 * - Production: MONGODB_URI=mongodb://... node add-admin.js --email admin@example.com
 * - With env var: ADMIN_EMAIL=admin@example.com node add-admin.js
 */

// Parse command line arguments
const args = process.argv.slice(2);

// Support both positional and --email flag
let adminEmail;
if (args.length === 1 && !args[0].startsWith('--')) {
  // Simple usage: node add-admin.js email@example.com
  adminEmail = args[0];
} else {
  // Flag usage: node add-admin.js --email email@example.com
  const emailIndex = args.indexOf('--email');
  adminEmail = emailIndex !== -1 ? args[emailIndex + 1] : null;
}

// Fallback to environment variable
adminEmail = adminEmail || process.env.ADMIN_EMAIL;

if (!adminEmail) {
  console.error('❌ Error: Admin email is required');
  console.error('');
  console.error('Usage:');
  console.error('  node add-admin.js your-email@example.com');
  console.error('  node add-admin.js --email your-email@example.com');
  console.error('  ADMIN_EMAIL=your-email@example.com node add-admin.js');
  console.error('');
  console.error('For production with custom MongoDB URI:');
  console.error('  MONGODB_URI=mongodb://... node add-admin.js --email admin@example.com');
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(adminEmail)) {
  console.error('❌ Error: Invalid email format');
  process.exit(1);
}

// Get MongoDB URI with better defaults for different environments
const getMongoUri = () => {
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
  }
  
  // Default for local development
  return 'mongodb://admin:password@localhost:27017/landing?authSource=admin';
};

const MONGODB_URI = getMongoUri();

async function addAdminUser() {
  let client;
  
  try {
    console.log('🔗 Connecting to MongoDB...');
    console.log(`📍 Database: ${MONGODB_URI.replace(/\/\/[^@]*@/, '//***:***@')}`); // Hide credentials in log
    
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db('landing');
    const adminsCollection = db.collection('admins');
    
    // Check if admin already exists
    const existingAdmin = await adminsCollection.findOne({ email: adminEmail });
    
    if (existingAdmin) {
      console.log(`ℹ️  Admin user ${adminEmail} already exists`);
      console.log(`📅 Created: ${existingAdmin.created_at}`);
      return;
    }
    
    // Add new admin user
    const adminRecord = {
      email: adminEmail,
      created_at: new Date(),
      updated_at: new Date(),
      added_by: 'migration-script'
    };
    
    await adminsCollection.insertOne(adminRecord);
    console.log(`✅ Successfully added admin user: ${adminEmail}`);
    console.log(`🎉 ${adminEmail} can now access the admin panel at /admin`);
    
  } catch (error) {
    console.error('❌ Error adding admin user:', error.message);
    
    // Provide helpful error messages
    if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Make sure MongoDB is running. For local development:');
      console.error('   docker-compose up mongodb');
    } else if (error.message.includes('Authentication failed')) {
      console.error('💡 Check your MongoDB connection string and credentials');
    }
    
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔒 MongoDB connection closed');
    }
  }
}

// Run the migration
addAdminUser().catch(console.error);
