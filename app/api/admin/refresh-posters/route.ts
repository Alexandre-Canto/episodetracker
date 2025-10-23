import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getTMDBPosterUrl } from '@/lib/tmdb'
import { traktAPI } from '@/lib/trakt'

export async function POST(request: NextRequest) {
  try {
    console.log('[REFRESH] Starting poster refresh for all shows...')
    
    // Get all shows
    const shows = await prisma.show.findMany({
      select: {
        id: true,
        title: true,
        traktId: true,
        poster: true
      }
    })

    console.log(`[REFRESH] Found ${shows.length} shows to process`)

    let updated = 0
    let failed = 0
    let skipped = 0

    for (const show of shows) {
      try {
        // Skip if already has a valid poster URL
        if (show.poster && show.poster.startsWith('https://image.tmdb.org/t/p/w500/') && show.poster.length > 50) {
          console.log(`[REFRESH] ⏭️  Skipping ${show.title} - already has valid poster`)
          skipped++
          continue
        }

        console.log(`[REFRESH] 🔄 Processing ${show.title} (Trakt ID: ${show.traktId})`)

        // Fetch show details from Trakt to get TMDB ID
        const traktShow = await traktAPI.getShowDetails(show.traktId)
        
        if (!traktShow.ids.tmdb) {
          console.log(`[REFRESH] ⚠️  No TMDB ID for ${show.title}`)
          failed++
          continue
        }

        console.log(`[REFRESH] Found TMDB ID ${traktShow.ids.tmdb} for ${show.title}`)

        // Fetch poster from TMDB
        const posterUrl = await getTMDBPosterUrl(traktShow.ids.tmdb)

        if (posterUrl) {
          // Update the show with the new poster URL
          await prisma.show.update({
            where: { id: show.id },
            data: { poster: posterUrl }
          })
          console.log(`[REFRESH] ✅ Updated ${show.title} with poster: ${posterUrl}`)
          updated++
        } else {
          console.log(`[REFRESH] ❌ No poster found for ${show.title}`)
          failed++
        }

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 250))
      } catch (error: any) {
        console.error(`[REFRESH] ❌ Error processing ${show.title}:`, error.message)
        failed++
      }
    }

    console.log(`[REFRESH] ✅ Refresh complete: ${updated} updated, ${skipped} skipped, ${failed} failed`)

    return NextResponse.json({
      success: true,
      total: shows.length,
      updated,
      skipped,
      failed
    })
  } catch (error: any) {
    console.error('[REFRESH] ❌ Error refreshing posters:', error)
    return NextResponse.json(
      { error: 'Failed to refresh posters', details: error.message },
      { status: 500 }
    )
  }
}

