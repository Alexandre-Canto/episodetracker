'use client'

import React, { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import { apiGet } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, CheckCircle, User, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '@/lib/auth-context'

interface Episode {
  id: string
  title: string
  airDate: string
  episodeNumber: number
  watchedAt: string
  show: {
    id: string
    title: string
    poster: string
  }
  season: {
    seasonNumber: number
  }
}

interface ShowWithEpisodes {
  showId: string
  showTitle: string
  poster: string
  episodes: Episode[]
  totalWatched: number
}

export default function ProfilePage() {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedShows, setExpandedShows] = useState<Set<string>>(new Set())
  const { user } = useAuth()

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      setError('')
      
      const response = await apiGet('/api/user/profile')
      const data = await response.json()
      
      if (response.ok) {
        setEpisodes(data.episodes || [])
      } else {
        setError(data.error || 'Failed to fetch profile')
      }
    } catch (error) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const toggleShow = (showId: string) => {
    const newExpanded = new Set(expandedShows)
    if (newExpanded.has(showId)) {
      newExpanded.delete(showId)
    } else {
      newExpanded.add(showId)
    }
    setExpandedShows(newExpanded)
  }

  const expandAll = () => {
    const allShowIds = new Set(episodes.map(e => e.show.id))
    setExpandedShows(allShowIds)
  }

  const collapseAll = () => {
    setExpandedShows(new Set())
  }

  // Group episodes by show
  const showsWithEpisodes: ShowWithEpisodes[] = React.useMemo(() => {
    const grouped = episodes.reduce((acc, episode) => {
      const showId = episode.show.id
      if (!acc[showId]) {
        acc[showId] = {
          showId: episode.show.id,
          showTitle: episode.show.title,
          poster: episode.show.poster,
          episodes: [],
          totalWatched: 0
        }
      }
      acc[showId].episodes.push(episode)
      acc[showId].totalWatched++
      return acc
    }, {} as Record<string, ShowWithEpisodes>)

    // Sort shows by most recently watched episode
    return Object.values(grouped).sort((a, b) => {
      const aLatest = Math.max(...a.episodes.map(e => new Date(e.watchedAt).getTime()))
      const bLatest = Math.max(...b.episodes.map(e => new Date(e.watchedAt).getTime()))
      return bLatest - aLatest
    })
  }, [episodes])

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
            <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
            <p className="text-muted-foreground">Your watching history and statistics</p>
          </div>

          {/* User Info Card */}
          {user && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <User className="h-8 w-8" />
                  </div>
                  <div>
                    <CardTitle>{user.name || user.email}</CardTitle>
                    <CardDescription>{user.email}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-2xl font-bold">{episodes.length}</p>
                    <p className="text-sm text-muted-foreground">Episodes Watched</p>
                  </div>
                  <Separator orientation="vertical" className="h-12" />
                  <div>
                    <p className="text-2xl font-bold">{showsWithEpisodes.length}</p>
                    <p className="text-sm text-muted-foreground">Shows</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Watched Shows */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Watched Shows</CardTitle>
                  <CardDescription>
                    {showsWithEpisodes.length} shows with {episodes.length} watched episodes
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={expandAll}>
                    Expand All
                  </Button>
                  <Button variant="outline" size="sm" onClick={collapseAll}>
                    Collapse All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {showsWithEpisodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No watched episodes yet</p>
                  <p className="text-sm text-muted-foreground">
                    Start watching shows to see your history
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-3">
                    {showsWithEpisodes.map((show) => {
                      const isExpanded = expandedShows.has(show.showId)
                      // Sort episodes by season and episode number
                      const sortedEpisodes = [...show.episodes].sort((a, b) => {
                        if (a.season.seasonNumber !== b.season.seasonNumber) {
                          return a.season.seasonNumber - b.season.seasonNumber
                        }
                        return a.episodeNumber - b.episodeNumber
                      })

                      return (
                        <Card key={show.showId} className="overflow-hidden">
                          <div
                            className="flex items-center gap-4 p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                            onClick={() => toggleShow(show.showId)}
                          >
                            {show.poster && (
                              <img
                                src={show.poster}
                                alt={show.showTitle}
                                className="h-20 w-14 object-cover rounded"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.src = '/placeholder-poster.jpg'
                                }}
                              />
                            )}
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg">{show.showTitle}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  {show.totalWatched} episodes watched
                                </Badge>
                                <p className="text-xs text-muted-foreground">
                                  Last watched: {format(
                                    new Date(Math.max(...show.episodes.map(e => new Date(e.watchedAt).getTime()))),
                                    'MMM d, yyyy'
                                  )}
                                </p>
                              </div>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>

                          {isExpanded && (
                            <div className="border-t bg-muted/30">
                              <div className="p-4 space-y-2">
                                {sortedEpisodes.map((episode) => (
                                  <div
                                    key={episode.id}
                                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                  >
                                    <div className="flex-1 space-y-1">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">
                                          S{episode.season.seasonNumber}E{episode.episodeNumber}
                                        </Badge>
                                        <p className="font-medium text-sm">{episode.title}</p>
                                      </div>
                                      {episode.airDate && (
                                        <p className="text-xs text-muted-foreground">
                                          Aired: {format(new Date(episode.airDate), 'MMM d, yyyy')}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <p className="text-xs text-muted-foreground">
                                        Watched: {format(new Date(episode.watchedAt), 'MMM d, yyyy')}
                                      </p>
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </Card>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
