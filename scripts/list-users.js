#!/usr/bin/env node

/**
 * List Users Script
 * 
 * This script lists all users in the database to help with CSV import.
 * 
 * Usage: node scripts/list-users.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('👥 Episode Tracker Users');
    console.log('========================');
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (users.length === 0) {
      console.log('❌ No users found in the database');
      console.log('💡 Create a user account first before importing CSV data');
      return;
    }
    
    console.log(`📊 Found ${users.length} user(s):\n`);
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || 'Unnamed User'}`);
      console.log(`   📧 Email: ${user.email}`);
      console.log(`   🆔 ID: ${user.id}`);
      console.log(`   📅 Created: ${user.createdAt.toLocaleDateString()}`);
      console.log('');
    });
    
    console.log('💡 Use one of these user IDs with the import script:');
    console.log('   npm run import:csv -- --user-id=USER_ID');
    
  } catch (error) {
    console.error('❌ Error listing users:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
