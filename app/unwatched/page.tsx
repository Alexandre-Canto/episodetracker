'use client'

import React, { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import { apiGet, apiPatch } from '@/lib/api-client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Clock, Eye, CheckCircle, Loader2, AlertCircle, Search, X, CheckSquare } from 'lucide-react'
import { format } from 'date-fns'

interface Episode {
  id: string
  title: string
  airDate: string
  overview: string
  watched: boolean
  episodeNumber: number
  season: {
    seasonNumber: number
  }
}

interface Show {
  id: string
  title: string
  poster: string
  unwatchedCount: number
  totalRuntime: number
  seasons: Array<{
    seasonNumber: number
    episodes: Episode[]
  }>
}

export default function UnwatchedPage() {
  const [shows, setShows] = useState<Show[]>([])
  const [selectedShow, setSelectedShow] = useState<Show | null>(null)
  const [selectedSeason, setSelectedSeason] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [totalUnwatched, setTotalUnwatched] = useState(0)
  const [totalRuntime, setTotalRuntime] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [markingSeries, setMarkingSeries] = useState(false)

  const fetchUnwatchedShows = async (preserveSelection = false) => {
    try {
      setLoading(true)
      setError('')
      
      const response = await apiGet('/api/user/unwatched')
      const data = await response.json()
      
      if (response.ok) {
        setShows(data.shows)
        setTotalUnwatched(data.totalUnwatched)
        setTotalRuntime(data.totalRuntime)
        
        if (preserveSelection && selectedShow) {
          // Try to find and reselect the same show
          const updatedShow = data.shows.find((s: Show) => s.id === selectedShow.id)
          if (updatedShow) {
            setSelectedShow(updatedShow)
            // Keep the same season if it still exists
            if (updatedShow.seasons && updatedShow.seasons.some((s: any) => s.seasonNumber === selectedSeason)) {
              // Season still exists, keep it selected
            } else if (updatedShow.seasons && updatedShow.seasons.length > 0) {
              // Season doesn't exist anymore, select first available
              setSelectedSeason(updatedShow.seasons[0].seasonNumber)
            }
          } else if (data.shows.length > 0) {
            // Show no longer has unwatched episodes, select first show
            setSelectedShow(data.shows[0])
            if (data.shows[0].seasons && data.shows[0].seasons.length > 0) {
              setSelectedSeason(data.shows[0].seasons[0].seasonNumber)
            }
          } else {
            setSelectedShow(null)
          }
        } else if (data.shows.length > 0) {
          // Initial load or no selection to preserve
          setSelectedShow(data.shows[0])
          if (data.shows[0].seasons && data.shows[0].seasons.length > 0) {
            setSelectedSeason(data.shows[0].seasons[0].seasonNumber)
          }
        } else {
          setSelectedShow(null)
        }
      } else {
        setError(data.error || 'Failed to fetch unwatched shows')
      }
    } catch (error) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUnwatchedShows()
  }, [])

  const handleShowSelect = (show: Show) => {
    setSelectedShow(show)
    if (show.seasons && show.seasons.length > 0) {
      setSelectedSeason(show.seasons[0].seasonNumber)
    }
  }

  const handleEpisodeToggle = async (episode: Episode) => {
    if (!selectedShow) {
      setError('No show selected')
      return
    }

    try {
      const response = await apiPatch(`/api/user/episodes/${episode.id}/watched`, {
        watched: !episode.watched,
        showId: selectedShow.id,
        seasonNumber: episode.season.seasonNumber,
        episodeNumber: episode.episodeNumber
      })

      if (response.ok) {
        fetchUnwatchedShows(true)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to update episode')
      }
    } catch (error) {
      setError('Network error')
    }
  }

  const handleSeasonMarkWatched = async () => {
    console.log('handleSeasonMarkWatched called')
    console.log('selectedShow:', selectedShow)
    console.log('selectedSeason:', selectedSeason)
    
    if (!selectedShow) {
      console.error('No selectedShow')
      setError('No show selected')
      return
    }
    
    if (selectedSeason === null || selectedSeason === undefined) {
      console.error('No selectedSeason')
      setError('No season selected')
      return
    }

    try {
      console.log('Marking season as watched:', {
        showId: selectedShow.id,
        seasonNumber: selectedSeason
      })
      
      const response = await apiPatch('/api/user/episodes/season/watched', {
        showId: selectedShow.id,
        seasonNumber: selectedSeason,
      })

      console.log('Response status:', response.status)
      
      if (response.ok) {
        console.log('Successfully marked season as watched')
        await fetchUnwatchedShows(true)
      } else {
        const data = await response.json()
        console.error('Error response:', data)
        setError(data.error || 'Failed to mark season as watched')
      }
    } catch (error) {
      console.error('Exception in handleSeasonMarkWatched:', error)
      setError('Network error: ' + (error as Error).message)
    }
  }

  const formatRuntime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const getUnwatchedEpisodes = () => {
    if (!selectedShow || !selectedShow.seasons) return []
    
    const season = selectedShow.seasons.find(s => s.seasonNumber === selectedSeason)
    if (!season) return []
    
    return season.episodes.filter(episode => !episode.watched)
  }

  const getAvailableSeasons = () => {
    if (!selectedShow || !selectedShow.seasons) return []
    return selectedShow.seasons.map(s => s.seasonNumber).sort((a, b) => a - b)
  }

  const filterShows = (showsList: Show[]) => {
    if (!searchQuery.trim()) return showsList
    return showsList.filter(show => 
      show.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }

  const handleMarkSeriesWatched = async () => {
    if (!selectedShow) return

    try {
      setMarkingSeries(true)
      setError('')

      // Get all episodes for the show with season context
      const allEpisodes = selectedShow.seasons.flatMap(season => 
        season.episodes.map(episode => ({ ...episode, seasonNumber: season.seasonNumber }))
      )
      
      // Mark all unwatched episodes as watched
      const unwatchedEpisodes = allEpisodes.filter(episode => !episode.watched)
      
      console.log(`Marking ${unwatchedEpisodes.length} episodes as watched for ${selectedShow.title}`)

      // Update each unwatched episode
      for (const episode of unwatchedEpisodes) {
        try {
          await apiPatch(`/api/user/episodes/${episode.id}/watched`, {
            watched: true,
            showId: selectedShow.id,
            seasonNumber: episode.seasonNumber,
            episodeNumber: episode.episodeNumber
          })
        } catch (error) {
          console.error(`Failed to mark episode ${episode.id} as watched:`, error)
        }
      }

      // Refresh the data
      await fetchUnwatchedShows(true)
    } catch (error) {
      setError('Failed to mark series as watched')
    } finally {
      setMarkingSeries(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </Layout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Unwatched Episodes</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>{totalUnwatched} episodes</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{formatRuntime(totalRuntime)} to watch</span>
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {shows.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">All caught up!</p>
                <p className="text-sm text-muted-foreground">You have no unwatched episodes</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
              {/* Shows List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Your Shows</CardTitle>
                  <CardDescription>Select a show to view episodes</CardDescription>
                  
                  {/* Search Bar */}
                  <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search shows by name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-10"
                    />
                    {searchQuery && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                        onClick={() => setSearchQuery('')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-1 p-4">
                      {filterShows(shows).map((show) => {
                        const posterUrl = show.poster || '/placeholder-poster.jpg'
                        return (
                        <button
                          key={show.id}
                          onClick={() => handleShowSelect(show)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                            selectedShow?.id === show.id
                              ? 'bg-secondary'
                              : 'hover:bg-secondary/50'
                          }`}
                        >
                          <div className="relative h-16 w-12 flex-shrink-0 overflow-hidden rounded bg-muted">
                            <img
                              src={posterUrl}
                              alt={show.title}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.src = '/placeholder-poster.jpg'
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-sm">{show.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {show.unwatchedCount} episodes
                              </Badge>
                            </div>
                          </div>
                        </button>
                      )})}
                      
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Episodes */}
              {selectedShow && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{selectedShow.title}</CardTitle>
                        <CardDescription>Season {selectedSeason}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={handleMarkSeriesWatched}
                          disabled={markingSeries || selectedShow.seasons.flatMap(s => s.episodes).filter(e => !e.watched).length === 0}
                          size="sm"
                          variant="outline"
                        >
                          {markingSeries ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckSquare className="mr-2 h-4 w-4" />
                          )}
                          Mark Series Watched
                        </Button>
                        <Button
                          onClick={handleSeasonMarkWatched}
                          disabled={getUnwatchedEpisodes().length === 0}
                          size="sm"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Mark Season Watched
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="h-[600px] flex flex-col">
                      <div className="p-4 pb-0">
                        <Tabs
                          value={selectedSeason.toString()}
                          onValueChange={(value) => setSelectedSeason(parseInt(value))}
                        >
                          <TabsList className="mb-4">
                            {getAvailableSeasons().map((seasonNum) => (
                              <TabsTrigger key={seasonNum} value={seasonNum.toString()}>
                                Season {seasonNum}
                              </TabsTrigger>
                            ))}
                          </TabsList>
                        </Tabs>
                      </div>
                      
                      <div className="flex-1 overflow-hidden">
                        <Tabs
                          value={selectedSeason.toString()}
                          onValueChange={(value) => setSelectedSeason(parseInt(value))}
                        >
                          {getAvailableSeasons().map((seasonNum) => (
                            <TabsContent key={seasonNum} value={seasonNum.toString()} className="h-full">
                              {getUnwatchedEpisodes().length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center h-full">
                                  <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                                  <p className="text-lg font-medium">All caught up!</p>
                                  <p className="text-sm text-muted-foreground">
                                    No unwatched episodes in this season
                                  </p>
                                </div>
                              ) : (
                                <ScrollArea className="h-full">
                                  <div className="space-y-4 p-4">
                                    {getUnwatchedEpisodes().map((episode) => (
                                <div
                                  key={episode.id}
                                  className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                >
                                  <Checkbox
                                    checked={episode.watched}
                                    onCheckedChange={() => handleEpisodeToggle(episode)}
                                    className="mt-1"
                                  />
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs">
                                        {episode.season.seasonNumber}x{episode.episodeNumber}
                                      </Badge>
                                      <h4 className="font-medium">{episode.title}</h4>
                                    </div>
                                    {episode.airDate && (
                                      <p className="text-xs text-muted-foreground">
                                        {format(new Date(episode.airDate), 'PPP')}
                                      </p>
                                    )}
                                    {episode.overview && (
                                      <p className="text-sm text-muted-foreground line-clamp-2">
                                        {episode.overview}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                    ))}
                                  </div>
                                </ScrollArea>
                              )}
                            </TabsContent>
                          ))}
                        </Tabs>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
