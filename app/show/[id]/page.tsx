'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import { apiGet, apiPost } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Loader2, AlertCircle, ArrowLeft, Star, Calendar, Clock, Tv, Users, Plus, Check } from 'lucide-react'
import { format } from 'date-fns'

interface Episode {
  id: string
  title: string
  overview: string
  episodeNumber: number
  seasonNumber: number
  airDate: string
  runtime: number
  watched: boolean
}

interface Season {
  seasonNumber: number
  episodes: Episode[]
  episodeCount: number
}

interface Cast {
  person: {
    name: string
    ids: {
      trakt: number
      slug: string
    }
  }
  character: string
  episodeCount?: number
}

interface ShowDetails {
  id: string
  traktId?: number
  title: string
  overview: string
  poster: string
  year: number
  status: string
  network: string
  genres: string[]
  runtime: number
  rating: number
  votes: number
  trailer: string
  firstAired: string
  country: string
  language: string
  airedEpisodes: number
  seasons: Season[]
  cast: Cast[]
  userShow?: {
    id: string
    status: string
    rating: number | null
  }
}

export default function ShowDetailPage() {
  const params = useParams()
  const router = useRouter()
  const showId = params.id as string
  
  const [show, setShow] = useState<ShowDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [addingShow, setAddingShow] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState('ongoing')

  useEffect(() => {
    if (showId) {
      fetchShowDetails()
    }
  }, [showId])

  const fetchShowDetails = async () => {
    try {
      setLoading(true)
      setError('')
      
      const response = await apiGet(`/api/shows/${showId}`)
      const data = await response.json()
      
      if (response.ok) {
        setShow(data.show)
      } else {
        setError(data.error || 'Failed to fetch show details')
      }
    } catch (error) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleAddShow = async (status: string) => {
    if (!show) return

    try {
      setAddingShow(true)
      setError('')
      
      // Use traktId if this is from browse, otherwise use the id
      const traktIdToAdd = show.traktId || parseInt(showId)
      
      const response = await apiPost('/api/user/shows', {
        traktId: traktIdToAdd,
        status: status,
      })

      if (response.ok) {
        // Refresh show details to get updated userShow info
        await fetchShowDetails()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to add show')
      }
    } catch (error) {
      setError('Network error')
    } finally {
      setAddingShow(false)
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

  if (error || !show) {
    return (
      <ProtectedRoute>
        <Layout>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || 'Show not found'}</AlertDescription>
          </Alert>
        </Layout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* Back Button */}
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          {/* Header Section */}
          <div className="grid gap-6 md:grid-cols-[300px_1fr]">
            {/* Poster */}
            <div className="space-y-4">
              <Card className="overflow-hidden">
                <img
                  src={show.poster || '/placeholder-poster.jpg'}
                  alt={show.title}
                  className="w-full h-auto object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = '/placeholder-poster.jpg'
                  }}
                />
              </Card>
              
              {/* Quick Stats */}
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-sm">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-2 text-sm">
                  {show.rating && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Rating</span>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{show.rating.toFixed(1)}/10</span>
                        <span className="text-muted-foreground text-xs">({show.votes} votes)</span>
                      </div>
                    </div>
                  )}
                  {show.status && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant="outline">{show.status}</Badge>
                    </div>
                  )}
                  {show.network && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Network</span>
                      <span className="font-medium">{show.network}</span>
                    </div>
                  )}
                  {show.runtime && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Runtime</span>
                      <span className="font-medium">{show.runtime} min</span>
                    </div>
                  )}
                  {show.airedEpisodes && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Episodes</span>
                      <span className="font-medium">{show.airedEpisodes}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {show.userShow && (
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">Your Status</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">List</span>
                      <Badge>{show.userShow.status}</Badge>
                    </div>
                    {show.userShow.rating && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Your Rating</span>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{show.userShow.rating}/10</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Main Content */}
            <div className="space-y-6">
              {/* Title and Info */}
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h1 className="text-4xl font-bold tracking-tight">{show.title}</h1>
                    {show.year && (
                      <p className="text-xl text-muted-foreground mt-1">{show.year}</p>
                    )}
                  </div>
                  
                  {/* Add to My Shows Button */}
                  {!show.userShow ? (
                    <div className="flex gap-2">
                      <Button
                        size="lg"
                        onClick={() => handleAddShow('ongoing')}
                        disabled={addingShow}
                      >
                        {addingShow ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <Plus className="mr-2 h-5 w-5" />
                            Add to My Shows
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-500" />
                      <span className="text-sm font-medium text-green-500">In Your Library</span>
                    </div>
                  )}
                </div>
                
                {/* Genres */}
                {show.genres && show.genres.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {show.genres.map((genre) => (
                      <Badge key={genre} variant="secondary">
                        {genre}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Meta Info */}
                <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
                  {show.firstAired && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(show.firstAired), 'MMM d, yyyy')}
                    </div>
                  )}
                  {show.country && (
                    <div className="flex items-center gap-1">
                      <span>📍</span>
                      {show.country}
                    </div>
                  )}
                  {show.language && (
                    <div className="flex items-center gap-1">
                      <span>🗣️</span>
                      {show.language.toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              {/* Overview */}
              {show.overview && (
                <Card>
                  <CardHeader>
                    <CardTitle>Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">{show.overview}</p>
                  </CardContent>
                </Card>
              )}

              {/* Tabs for Episodes and Cast */}
              <Tabs defaultValue="episodes" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="episodes">
                    <Tv className="h-4 w-4 mr-2" />
                    Episodes
                  </TabsTrigger>
                  <TabsTrigger value="cast">
                    <Users className="h-4 w-4 mr-2" />
                    Cast
                  </TabsTrigger>
                </TabsList>

                {/* Episodes Tab */}
                <TabsContent value="episodes">
                  <Card>
                    <CardHeader>
                      <CardTitle>Episodes by Season</CardTitle>
                      <CardDescription>
                        {show.seasons?.length || 0} seasons
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {show.seasons && show.seasons.length > 0 ? (
                        <ScrollArea className="h-[600px]">
                          <div className="space-y-6">
                            {show.seasons.map((season) => (
                              <div key={season.seasonNumber} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h3 className="font-semibold text-lg">
                                    Season {season.seasonNumber}
                                  </h3>
                                  <Badge variant="outline">
                                    {season.episodes.length} episodes
                                  </Badge>
                                </div>
                                <div className="space-y-2">
                                  {season.episodes.map((episode) => (
                                    <Card key={episode.id}>
                                      <CardContent className="p-4">
                                        <div className="flex items-start gap-3">
                                          <Badge variant="outline" className="mt-1">
                                            E{episode.episodeNumber}
                                          </Badge>
                                          <div className="flex-1 space-y-1">
                                            <div className="flex items-start justify-between gap-2">
                                              <h4 className="font-medium">{episode.title}</h4>
                                              {episode.watched && (
                                                <Badge variant="secondary" className="text-xs">
                                                  Watched
                                                </Badge>
                                              )}
                                            </div>
                                            {episode.overview && (
                                              <p className="text-sm text-muted-foreground line-clamp-2">
                                                {episode.overview}
                                              </p>
                                            )}
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                              {episode.airDate && (
                                                <span>{format(new Date(episode.airDate), 'MMM d, yyyy')}</span>
                                              )}
                                              {episode.runtime && (
                                                <span className="flex items-center gap-1">
                                                  <Clock className="h-3 w-3" />
                                                  {episode.runtime} min
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                                {season.seasonNumber < show.seasons.length && (
                                  <Separator className="my-4" />
                                )}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">
                          No episode information available
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Cast Tab */}
                <TabsContent value="cast">
                  <Card>
                    <CardHeader>
                      <CardTitle>Cast & Characters</CardTitle>
                      <CardDescription>
                        {show.cast?.length || 0} cast members
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {show.cast && show.cast.length > 0 ? (
                        <ScrollArea className="h-[600px]">
                          <div className="grid gap-4 sm:grid-cols-2">
                            {show.cast.map((castMember, index) => (
                              <Card key={index}>
                                <CardContent className="p-4">
                                  <div className="space-y-1">
                                    <h4 className="font-semibold">{castMember.person.name}</h4>
                                    <p className="text-sm text-muted-foreground">
                                      as {castMember.character}
                                    </p>
                                    {castMember.episodeCount && (
                                      <p className="text-xs text-muted-foreground">
                                        {castMember.episodeCount} episodes
                                      </p>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">
                          No cast information available
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}

