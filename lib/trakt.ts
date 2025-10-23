import axios from 'axios'

const TRAKT_CLIENT_ID = process.env.TRAKT_CLIENT_ID!
const TRAKT_CLIENT_SECRET = process.env.TRAKT_CLIENT_SECRET!

const traktApi = axios.create({
  baseURL: 'https://api.trakt.tv',
  headers: {
    'Content-Type': 'application/json',
    'trakt-api-key': TRAKT_CLIENT_ID,
    'trakt-api-version': '2',
  },
})

export interface TraktShow {
  title: string
  year: number
  ids: {
    trakt: number
    slug: string
    tvdb: number
    imdb: string
    tmdb: number
    tvrage: number
  }
  overview: string
  first_aired: string
  airs: {
    day: string
    time: string
    timezone: string
  }
  runtime: number
  certification: string
  network: string
  country: string
  trailer: string
  homepage: string
  status: string
  rating: number
  votes: number
  comment_count: number
  updated_at: string
  language: string
  available_translations: string[]
  genres: string[]
  aired_episodes: number
}

export interface TraktEpisode {
  season: number
  number: number
  title: string
  ids: {
    trakt: number
    tvdb: number
    imdb: string
    tmdb: number
    tvrage: number
  }
  number_abs: number
  overview: string
  runtime: number
  rating: number
  votes: number
  first_aired: string
  updated_at: string
  available_translations: string[]
}

export interface TraktSearchResult {
  type: string
  score: number
  show: TraktShow
}

export class TraktAPI {
  async getPopularShows(page = 1, limit = 50): Promise<TraktShow[]> {
    const response = await traktApi.get(`/shows/popular?page=${page}&limit=${limit}`)
    return response.data
  }

  async getTrendingShows(page = 1, limit = 50): Promise<TraktShow[]> {
    const response = await traktApi.get(`/shows/trending?page=${page}&limit=${limit}`)
    return response.data.map((item: any) => item.show)
  }

  async searchShows(query: string, page = 1, limit = 50): Promise<TraktSearchResult[]> {
    const response = await traktApi.get(`/search/show?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`)
    return response.data
  }

  async getShowDetails(traktId: number): Promise<TraktShow> {
    const response = await traktApi.get(`/shows/${traktId}?extended=full`)
    return response.data
  }

  async getShowEpisodes(traktId: number, season?: number): Promise<TraktEpisode[]> {
    const url = season 
      ? `/shows/${traktId}/seasons/${season}/episodes?extended=full`
      : `/shows/${traktId}/seasons?extended=episodes`
    
    const response = await traktApi.get(url)
    return response.data
  }

  async getUpcomingEpisodes(userShows: number[]): Promise<any[]> {
    // This would require user authentication with Trakt
    // For now, we'll get upcoming episodes for specific shows
    const episodes = []
    
    for (const showId of userShows) {
      try {
        const response = await traktApi.get(`/shows/${showId}/next_episode?extended=full`)
        if (response.data) {
          episodes.push(response.data)
        }
      } catch (error) {
        console.error(`Error fetching upcoming episodes for show ${showId}:`, error)
      }
    }
    
    return episodes
  }

  async getShowSeasons(traktId: number): Promise<any[]> {
    const response = await traktApi.get(`/shows/${traktId}/seasons?extended=episodes`)
    return response.data
  }

  async getShowByTMDBId(tmdbId: number): Promise<TraktShow | null> {
    try {
      const response = await traktApi.get(`/search/tmdb/${tmdbId}?type=show`)
      if (response.data && response.data.length > 0) {
        return response.data[0].show
      }
      return null
    } catch (error) {
      console.error(`Error fetching show by TMDB ID ${tmdbId}:`, error)
      return null
    }
  }

  async getShowByTVDBId(tvdbId: number): Promise<TraktShow | null> {
    try {
      const response = await traktApi.get(`/search/tvdb/${tvdbId}?type=show`)
      if (response.data && response.data.length > 0) {
        return response.data[0].show
      }
      return null
    } catch (error) {
      console.error(`Error fetching show by TVDB ID ${tvdbId}:`, error)
      return null
    }
  }

  async getSeasonEpisodes(traktId: number, seasonNumber: number): Promise<TraktEpisode[]> {
    try {
      const response = await traktApi.get(`/shows/${traktId}/seasons/${seasonNumber}/episodes?extended=full`)
      return response.data
    } catch (error) {
      console.error(`Error fetching season ${seasonNumber} episodes for show ${traktId}:`, error)
      return []
    }
  }

  async getEpisode(traktId: number, seasonNumber: number, episodeNumber: number): Promise<TraktEpisode> {
    const response = await traktApi.get(`/shows/${traktId}/seasons/${seasonNumber}/episodes/${episodeNumber}?extended=full`)
    return response.data
  }
}

export const traktAPI = new TraktAPI()
