#!/usr/bin/env node

/**
 * CSV Data Import Script for Episode Tracker
 * 
 * This script reads the data.csv file and imports it into the database
 * following the Prisma schema structure.
 * 
 * Usage: node scripts/import-csv-data.js [--user-id=USER_ID] [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const csv = require('csv-parser');
const axios = require('axios');
require('dotenv').config();

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const userId = args.find(arg => arg.startsWith('--user-id='))?.split('=')[1];
const dryRun = args.includes('--dry-run');

async function main() {
  try {
    console.log('🎬 Episode Tracker CSV Import Script');
    console.log('=====================================');
    
    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No data will be written to database');
    }
    
    // Check if user ID is provided
    if (!userId) {
      console.error('❌ Error: User ID is required');
      console.log('Usage: node scripts/import-csv-data.js --user-id=USER_ID [--dry-run]');
      process.exit(1);
    }
    
    // Check for TMDB API key
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey || apiKey === 'your-tmdb-api-key-or-bearer-token' || apiKey === 'your-tmdb-api-key-here') {
      console.warn('⚠️  Warning: TMDB_API_KEY not configured in environment');
      console.log('   To get show posters and metadata, set TMDB_API_KEY in your .env file');
      console.log('   Get your API key from: https://www.themoviedb.org/settings/api');
      console.log('   Shows will be imported without posters and with minimal metadata.');
      console.log('');
    }
    
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      console.error(`❌ Error: User with ID ${userId} not found`);
      process.exit(1);
    }
    
    console.log(`✅ Found user: ${user.name || user.email}`);
    
    // Read and parse CSV data
    const csvPath = path.join(__dirname, '..', 'data.csv');
    if (!fs.existsSync(csvPath)) {
      console.error(`❌ Error: CSV file not found at ${csvPath}`);
      process.exit(1);
    }
    
    console.log('📊 Reading CSV data...');
    const csvData = await parseCSV(csvPath);
    console.log(`📈 Found ${csvData.length} episodes`);
    
    // Group data by show and season
    const groupedData = groupDataByShowAndSeason(csvData);
    console.log(`📺 Found ${Object.keys(groupedData).length} unique shows`);
    
    // Import data
    if (!dryRun) {
      await importData(userId, groupedData);
    } else {
      console.log('🔍 DRY RUN - Would import:');
      Object.entries(groupedData).forEach(([showTitle, seasons]) => {
        console.log(`  📺 ${showTitle}: ${Object.keys(seasons).length} seasons`);
        Object.entries(seasons).forEach(([seasonNum, episodes]) => {
          console.log(`    📅 Season ${seasonNum}: ${episodes.length} episodes`);
        });
      });
    }
    
    console.log('✅ Import completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during import:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        // Clean and validate data
        const episode = {
          show: data.show?.trim(),
          season: parseInt(data.season),
          number: parseInt(data.number),
          name: data.name?.trim(),
          airDate: parseDate(data.air_date),
          watched: data.watched?.toLowerCase() === 'true'
        };
        
        // Validate required fields
        if (episode.show && !isNaN(episode.season) && !isNaN(episode.number) && episode.name) {
          results.push(episode);
        }
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function parseDate(dateString) {
  if (!dateString) return null;
  
  // Handle MM/DD/YYYY format
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

async function fetchShowMetadata(showTitle) {
  try {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey || apiKey === 'your-tmdb-api-key-or-bearer-token') {
      console.warn(`⚠️  TMDB_API_KEY not set in environment. Skipping metadata fetch for "${showTitle}"`);
      throw new Error('TMDB API key not configured');
    }
    
    // Use TMDB API to get show metadata
    const response = await axios.get(`https://api.themoviedb.org/3/search/tv`, {
      params: {
        api_key: apiKey,
        query: showTitle,
        language: 'en-US'
      }
    });
    
    if (response.data.results && response.data.results.length > 0) {
      const show = response.data.results[0];
      return {
        traktId: show.id,
        title: show.name,
        overview: show.overview || `Imported from CSV data`,
        poster: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
        status: show.status === 'Ended' ? 'ended' : show.status === 'Canceled' ? 'canceled' : 'airing',
        genres: show.genre_ids || [],
        network: show.networks && show.networks.length > 0 ? show.networks[0].name : 'Unknown',
        firstAired: show.first_air_date ? new Date(show.first_air_date) : new Date()
      };
    }
  } catch (error) {
    console.warn(`⚠️  Could not fetch metadata for "${showTitle}": ${error.message}`);
  }
  
  // Fallback data if API fails
  return {
    traktId: Math.floor(Math.random() * 1000000),
    title: showTitle,
    overview: `Imported from CSV data`,
    poster: null,
    status: 'ended',
    genres: [],
    network: 'Unknown',
    firstAired: new Date()
  };
}

function groupDataByShowAndSeason(csvData) {
  const grouped = {};
  
  csvData.forEach(episode => {
    const { show, season, ...episodeData } = episode;
    
    if (!grouped[show]) {
      grouped[show] = {};
    }
    
    if (!grouped[show][season]) {
      grouped[show][season] = [];
    }
    
    grouped[show][season].push(episodeData);
  });
  
  return grouped;
}

async function importData(userId, groupedData) {
  console.log('🔄 Starting database import...');
  
  let showsCreated = 0;
  let seasonsCreated = 0;
  let episodesCreated = 0;
  let userEpisodesCreated = 0;
  
  for (const [showTitle, seasons] of Object.entries(groupedData)) {
    console.log(`📺 Processing show: ${showTitle}`);
    
    // Create or find show
    let show = await prisma.show.findFirst({
      where: { title: showTitle }
    });
    
    if (!show) {
      console.log(`  🔍 Fetching metadata for "${showTitle}"...`);
      const metadata = await fetchShowMetadata(showTitle);
      
      show = await prisma.show.create({
        data: {
          traktId: metadata.traktId,
          title: metadata.title,
          overview: metadata.overview,
          poster: metadata.poster,
          status: metadata.status,
          genres: metadata.genres,
          network: metadata.network,
          firstAired: metadata.firstAired
        }
      });
      showsCreated++;
      
      if (metadata.poster) {
        console.log(`  ✅ Found poster: ${metadata.poster}`);
      } else {
        console.log(`  ⚠️  No poster found for "${showTitle}"`);
      }
    }
    
    // Create user-show relationship
    await prisma.userShow.upsert({
      where: {
        userId_showId: {
          userId: userId,
          showId: show.id
        }
      },
      update: {},
      create: {
        userId: userId,
        showId: show.id,
        status: 'ongoing'
      }
    });
    
    // Process seasons
    for (const [seasonNumber, episodes] of Object.entries(seasons)) {
      console.log(`  📅 Processing season ${seasonNumber} (${episodes.length} episodes)`);
      
      // Create or find season
      let season = await prisma.season.findFirst({
        where: {
          showId: show.id,
          seasonNumber: parseInt(seasonNumber)
        }
      });
      
      if (!season) {
        season = await prisma.season.create({
          data: {
            showId: show.id,
            seasonNumber: parseInt(seasonNumber),
            title: `Season ${seasonNumber}`,
            episodeCount: episodes.length,
            airDate: new Date()
          }
        });
        seasonsCreated++;
      }
      
      // Create user-season relationship
      await prisma.userSeason.upsert({
        where: {
          userId_seasonId: {
            userId: userId,
            seasonId: season.id
          }
        },
        update: {},
        create: {
          userId: userId,
          seasonId: season.id,
          watched: episodes.every(ep => ep.watched)
        }
      });
      
      // Process episodes
      for (const episodeData of episodes) {
        // Create or find episode
        let episode = await prisma.episode.findFirst({
          where: {
            seasonId: season.id,
            episodeNumber: episodeData.number
          }
        });
        
        if (!episode) {
          episode = await prisma.episode.create({
            data: {
              seasonId: season.id,
              episodeNumber: episodeData.number,
              title: episodeData.name,
              airDate: episodeData.airDate,
              overview: `Episode ${episodeData.number} of ${showTitle}`
            }
          });
          episodesCreated++;
        }
        
        // Create user-episode relationship
        await prisma.userEpisode.upsert({
          where: {
            userId_episodeId: {
              userId: userId,
              episodeId: episode.id
            }
          },
          update: {
            watched: episodeData.watched,
            watchedAt: episodeData.watched ? new Date() : null
          },
          create: {
            userId: userId,
            episodeId: episode.id,
            watched: episodeData.watched,
            watchedAt: episodeData.watched ? new Date() : null
          }
        });
        userEpisodesCreated++;
      }
    }
  }
  
  console.log('📊 Import Summary:');
  console.log(`  📺 Shows created: ${showsCreated}`);
  console.log(`  📅 Seasons created: ${seasonsCreated}`);
  console.log(`  🎬 Episodes created: ${episodesCreated}`);
  console.log(`  👤 User episodes created: ${userEpisodesCreated}`);
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Import interrupted by user');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Import terminated');
  await prisma.$disconnect();
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, parseCSV, groupDataByShowAndSeason };
