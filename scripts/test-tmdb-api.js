#!/usr/bin/env node

/**
 * Test TMDB API Key Script
 * 
 * This script tests if the TMDB API key is working correctly.
 * 
 * Usage: node scripts/test-tmdb-api.js
 */

const axios = require('axios');
require('dotenv').config();

async function testTMDBAPI() {
  try {
    console.log('🧪 Testing TMDB API Key');
    console.log('======================');
    
    // Use the hardcoded TMDB API v3 key
    const apiKey = '772b70a677e9fe99a6c4e511d1b0c596';
    console.log(`✅ Using hardcoded TMDB API v3 key: ${apiKey.substring(0, 8)}...`);
    
    // Test with a simple search
    console.log('🔍 Testing API with show search...');
    
    const response = await axios.get(`https://api.themoviedb.org/3/search/tv`, {
      params: {
        api_key: apiKey,
        query: '1899',
        language: 'en-US'
      },
      timeout: 10000
    });
    
    if (response.data.results && response.data.results.length > 0) {
      const show = response.data.results[0];
      console.log('✅ API key is working!');
      console.log(`📺 Found show: "${show.name}" (ID: ${show.id})`);
      console.log(`📝 Overview: ${show.overview?.substring(0, 100)}...`);
      console.log(`🖼️  Poster: ${show.poster_path ? 'Available' : 'Not available'}`);
    } else {
      console.log('⚠️  API responded but no results found');
    }
    
  } catch (error) {
    if (error.response) {
      console.error(`❌ API Error: ${error.response.status} - ${error.response.statusText}`);
      if (error.response.status === 401) {
        console.error('🔑 Authentication failed - your API key is invalid');
        console.log('   Please check your API key at: https://www.themoviedb.org/settings/api');
      } else if (error.response.status === 429) {
        console.error('⏰ Rate limit exceeded - too many requests');
      }
    } else if (error.request) {
      console.error('❌ Network Error: No response received');
    } else {
      console.error(`❌ Request Error: ${error.message}`);
    }
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testTMDBAPI().catch(console.error);
}

module.exports = { testTMDBAPI };
