#!/usr/bin/env node

/**
 * Update Show Posters Script
 * 
 * This script fetches poster URLs and metadata for shows that are already
 * imported but don't have poster URLs or have minimal metadata.
 * 
 * Usage: node scripts/update-show-posters.js [--dry-run] [--force]
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
require('dotenv').config();

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

async function main() {
  try {
    console.log('🖼️  Show Poster Update Script');
    console.log('==============================');
    
    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No data will be written to database');
    }
    
    // Use the hardcoded TMDB API v3 key
    const apiKey = '772b70a677e9fe99a6c4e511d1b0c596';
    console.log('✅ Using hardcoded TMDB API v3 key');
    
    // Find shows that need poster updates
    const showsToUpdate = await findShowsToUpdate(force);
    
    if (showsToUpdate.length === 0) {
      console.log('✅ All shows already have posters and metadata!');
      return;
    }
    
    console.log(`📊 Found ${showsToUpdate.length} shows that need poster updates:`);
    showsToUpdate.forEach(show => {
      console.log(`  📺 ${show.title} (ID: ${show.id})`);
    });
    console.log('');
    
    if (dryRun) {
      console.log('🔍 DRY RUN - Would update the following shows:');
      for (const show of showsToUpdate) {
        console.log(`  📺 ${show.title}`);
        console.log(`     Current poster: ${show.poster || 'None'}`);
        console.log(`     Current overview: ${show.overview?.substring(0, 50)}...`);
      }
      return;
    }
    
    // Update shows with new metadata
    let updated = 0;
    let failed = 0;
    const totalShows = showsToUpdate.length;
    
    for (let i = 0; i < showsToUpdate.length; i++) {
      const show = showsToUpdate[i];
      console.log(`🔄 Updating "${show.title}"... (${i + 1}/${totalShows})`);
      
      try {
        const metadata = await fetchShowMetadata(show.title, apiKey);
        
        if (metadata) {
          try {
            await prisma.show.update({
              where: { id: show.id },
              data: {
                traktId: parseInt(metadata.traktId), // Ensure it's an integer
                title: metadata.title,
                overview: metadata.overview,
                poster: metadata.poster,
                status: metadata.status,
                genres: metadata.genres,
                network: metadata.network,
                firstAired: metadata.firstAired
              }
            });
            
            updated++;
            if (metadata.poster) {
              console.log(`  ✅ Updated with poster: ${metadata.poster}`);
            } else {
              console.log(`  ⚠️  Updated but no poster found`);
            }
          } catch (updateError) {
            if (updateError.code === 'P2002') {
              console.log(`  ⚠️  Skipping traktId update (duplicate): ${metadata.traktId}`);
              // Update without traktId to avoid unique constraint
              await prisma.show.update({
                where: { id: show.id },
                data: {
                  title: metadata.title,
                  overview: metadata.overview,
                  poster: metadata.poster,
                  status: metadata.status,
                  genres: metadata.genres,
                  network: metadata.network,
                  firstAired: metadata.firstAired
                }
              });
              updated++;
              if (metadata.poster) {
                console.log(`  ✅ Updated (without traktId): ${metadata.poster}`);
              }
            } else {
              throw updateError;
            }
          }
        } else {
          console.log(`  ❌ No metadata found for "${show.title}"`);
          failed++;
        }
      } catch (error) {
        console.log(`  ❌ Failed to update "${show.title}": ${error.message}`);
        failed++;
      }
      
      // Add a 10-second delay to avoid rate limits
      const remaining = totalShows - (i + 1);
      const estimatedMinutes = Math.ceil((remaining * 10) / 60);
      console.log(`  ⏳ Waiting 10 seconds before next request... (${remaining} shows remaining, ~${estimatedMinutes} min left)`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    console.log('');
    console.log('📊 Update Summary:');
    console.log(`  ✅ Successfully updated: ${updated} shows`);
    console.log(`  ❌ Failed to update: ${failed} shows`);
    console.log(`  📺 Total processed: ${showsToUpdate.length} shows`);
    
  } catch (error) {
    console.error('❌ Error during poster update:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function findShowsToUpdate(force) {
  const whereClause = force 
    ? {} // Update all shows if force is used
    : {
        OR: [
          { poster: null },
          { poster: '' },
          { overview: { contains: 'Imported from CSV data' } },
          { network: 'Unknown' }
        ]
      };
  
  return await prisma.show.findMany({
    where: whereClause,
    select: {
      id: true,
      title: true,
      poster: true,
      overview: true,
      network: true
    },
    orderBy: {
      title: 'asc'
    }
  });
}

async function fetchShowMetadata(showTitle, apiKey) {
  try {
    console.log(`  🔍 Fetching metadata for "${showTitle}"...`);
    
    // Try multiple search variations for better matching
    const searchQueries = [
      showTitle, // Original title
      showTitle.replace(/\(\d{4}\)/, '').trim(), // Remove year in parentheses
      showTitle.replace(/\(\d{4}\)/, '').trim() + ' TV', // Add TV suffix
      showTitle.split(' (')[0], // Remove everything after first parenthesis
      // Special handling for known problematic titles
      showTitle === '1899' ? '1899' : null,
      showTitle === '24' ? '24' : null,
      showTitle.includes('Avatar: The Last Airbender') ? 'Avatar: The Last Airbender' : null,
      showTitle.includes('The Office') ? 'The Office' : null
    ].filter(Boolean); // Remove null values
    
    let bestMatch = null;
    
    for (const query of searchQueries) {
      if (!query.trim()) continue;
      
      console.log(`    🔍 Trying search: "${query}"`);
      
      const response = await axios.get(`https://api.themoviedb.org/3/search/tv`, {
        params: {
          api_key: apiKey,
          query: query,
          language: 'en-US'
        },
        timeout: 10000 // 10 second timeout
      });
      
      if (response.data.results && response.data.results.length > 0) {
        // Try the first few results to find the best match
        for (let i = 0; i < Math.min(3, response.data.results.length); i++) {
          const show = response.data.results[i];
          
          // Check if this is a good match (exact title match or high popularity)
          const isExactMatch = show.name.toLowerCase() === showTitle.toLowerCase() || 
                              show.name.toLowerCase() === query.toLowerCase();
          const isGoodMatch = show.popularity > 0.1 || isExactMatch;
          
          if (isGoodMatch) {
            bestMatch = show;
            console.log(`    ✅ Found good match: "${show.name}" (Popularity: ${show.popularity})`);
            break;
          } else {
            console.log(`    ⚠️  Result ${i+1}: "${show.name}" (Popularity: ${show.popularity})`);
          }
        }
        
        if (bestMatch) break;
      }
    }
    
    if (!bestMatch) {
      console.log(`    ❌ No good matches found for "${showTitle}"`);
      return null;
    }
    
    const show = bestMatch;
    console.log(`  📺 Found show: "${show.name}" (TMDB ID: ${show.id})`);
    
    // Get additional details for the show
    const detailsResponse = await axios.get(`https://api.themoviedb.org/3/tv/${show.id}`, {
      params: {
        api_key: apiKey,
        language: 'en-US'
      },
      timeout: 10000 // 10 second timeout
    });
    
    const details = detailsResponse.data;
    
    return {
      traktId: show.id,
      title: show.name,
      overview: show.overview || details.overview || `Imported from CSV data`,
      poster: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
      status: mapStatus(details.status),
      genres: details.genres ? details.genres.map(g => g.name) : [],
      network: details.networks && details.networks.length > 0 ? details.networks[0].name : 'Unknown',
      firstAired: details.first_air_date ? new Date(details.first_air_date) : new Date()
    };
    
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.warn(`  ⚠️  API Error for "${showTitle}": ${error.response.status} - ${error.response.statusText}`);
      if (error.response.status === 401) {
        console.warn(`  🔑 This appears to be an authentication error. Please check your TMDB API key.`);
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.warn(`  ⚠️  Network Error for "${showTitle}": No response received`);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.warn(`  ⚠️  Request Error for "${showTitle}": ${error.message}`);
    }
    return null;
  }
}

function mapStatus(tmdbStatus) {
  switch (tmdbStatus) {
    case 'Ended':
      return 'ended';
    case 'Canceled':
    case 'Cancelled':
      return 'canceled';
    case 'Returning Series':
    case 'In Production':
      return 'airing';
    default:
      return 'ended';
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Poster update interrupted by user');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Poster update terminated');
  await prisma.$disconnect();
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, findShowsToUpdate, fetchShowMetadata };
