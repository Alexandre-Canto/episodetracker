'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import { apiGet, apiPatch } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import { Loader2, AlertCircle, Tv, MoreVertical, CheckCircle, Grid3x3, List, Star } from 'lucide-react'

interface Show {
  id: string
  title: string
  poster: string
  status: string
  rating?: number | null
  unwatchedCount: number
}

interface ShowsByStatus {
  ongoing: any[]
  watchlater: any[]
  ended: any[]
  archived: any[]
}

const statusLabels = {
  ongoing: 'Current Shows',
  watchlater: 'Watch Later',
  ended: 'Ended',
  archived: 'Archived'
}

export default function ShowsPage() {
  const router = useRouter()
  const [shows, setShows] = useState<ShowsByStatus>({
    ongoing: [],
    watchlater: [],
    ended: [],
    archived: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingShow, setUpdatingShow] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'gallery' | 'list'>('gallery')

  useEffect(() => {
    fetchShows()
  }, [])

  const fetchShows = async () => {
    try {
      setLoading(true)
      setError('')
      
      const response = await apiGet('/api/user/shows')
      const data = await response.json()
      
      if (response.ok) {
        setShows(data.showsByStatus)
      } else {
        setError(data.error || 'Failed to fetch shows')
      }
    } catch (error) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (userShowId: string, newStatus: string) => {
    try {
      setUpdatingShow(userShowId)
      setError('')
      
      const response = await apiPatch(`/api/user/shows/${userShowId}`, {
        status: newStatus
      })

      if (response.ok) {
        await fetchShows()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to update show status')
      }
    } catch (error) {
      setError('Network error')
    } finally {
      setUpdatingShow(null)
    }
  }

  const handleRatingChange = async (userShowId: string, rating: number | null) => {
    try {
      setUpdatingShow(userShowId)
      setError('')
      
      const response = await apiPatch(`/api/user/shows/${userShowId}`, {
        rating: rating
      })

      if (response.ok) {
        await fetchShows()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to update rating')
      }
    } catch (error) {
      setError('Network error')
    } finally {
      setUpdatingShow(null)
    }
  }

  const renderStars = (rating: number | null | undefined) => {
    if (!rating) return null
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: 10 }, (_, i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${
              i < rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    )
  }

  const renderDropdownMenu = (userShow: any, status: string) => {
    const isUpdating = updatingShow === userShow.id
    
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={viewMode === 'gallery' ? 'secondary' : 'outline'}
            size="icon"
            className={viewMode === 'gallery' ? 'h-8 w-8 rounded-full' : ''}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreVertical className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Change Status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(['ongoing', 'watchlater', 'ended', 'archived'] as const).map((newStatus) => (
            <DropdownMenuItem
              key={newStatus}
              onClick={() => handleStatusChange(userShow.id, newStatus)}
              disabled={newStatus === status}
            >
              <div className="flex items-center gap-2">
                {newStatus === status && (
                  <CheckCircle className="h-4 w-4" />
                )}
                <span className={newStatus === status ? 'font-medium' : ''}>
                  {statusLabels[newStatus]}
                </span>
              </div>
            </DropdownMenuItem>
          ))}
          
          <DropdownMenuSeparator />
          
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Star className="h-4 w-4 mr-2" />
              <span>Rate Show</span>
              {userShow.rating && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {userShow.rating}/10
                </Badge>
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48">
              <DropdownMenuLabel>Select Rating</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {Array.from({ length: 10 }, (_, i) => i + 1).map((rating) => (
                <DropdownMenuItem
                  key={rating}
                  onClick={() => handleRatingChange(userShow.id, rating)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="font-medium">{rating}</span>
                    <div className="flex items-center gap-0.5 ml-auto">
                      {Array.from({ length: rating }, (_, i) => (
                        <Star
                          key={i}
                          className="h-3 w-3 fill-yellow-400 text-yellow-400"
                        />
                      ))}
                    </div>
                    {userShow.rating === rating && (
                      <CheckCircle className="h-4 w-4 ml-2" />
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleRatingChange(userShow.id, null)}
                disabled={!userShow.rating}
              >
                <span className="text-muted-foreground">Clear Rating</span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const renderGalleryView = (statusShows: any[], status: string) => {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {statusShows.map((userShow: any) => {
          const posterUrl = userShow.show.poster || '/placeholder-poster.jpg'
          
          return (
            <Card key={userShow.id} className="overflow-hidden group relative cursor-pointer hover:shadow-lg transition-shadow">
              <div 
                className="aspect-[2/3] relative overflow-hidden bg-muted"
                onClick={() => router.push(`/show/${userShow.show.id}`)}
              >
                <img
                  src={posterUrl}
                  alt={userShow.show.title}
                  className="object-cover w-full h-full"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = '/placeholder-poster.jpg'
                  }}
                />
                {/* Rating Badge */}
                {userShow.rating && (
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-black/70 text-white border-none">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 mr-1" />
                      {userShow.rating}/10
                    </Badge>
                  </div>
                )}
                {/* Status Menu Button */}
                <div 
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  {renderDropdownMenu(userShow, status)}
                </div>
              </div>
              <CardHeader 
                className="p-4"
                onClick={() => router.push(`/show/${userShow.show.id}`)}
              >
                <CardTitle className="line-clamp-1 text-base">
                  {userShow.show.title}
                </CardTitle>
                <CardDescription className="space-y-1">
                  {userShow.show.unwatchedCount > 0 && (
                    <Badge variant="secondary">
                      {userShow.show.unwatchedCount} unwatched
                    </Badge>
                  )}
                </CardDescription>
              </CardHeader>
            </Card>
          )
        })}
      </div>
    )
  }

  const renderListView = (statusShows: any[], status: string) => {
    return (
      <div className="space-y-2">
        {statusShows.map((userShow: any) => {
          const posterUrl = userShow.show.poster || '/placeholder-poster.jpg'
          
          return (
            <Card key={userShow.id} className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-4 p-4">
                <img
                  src={posterUrl}
                  alt={userShow.show.title}
                  className="h-24 w-16 object-cover rounded cursor-pointer"
                  onClick={() => router.push(`/show/${userShow.show.id}`)}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = '/placeholder-poster.jpg'
                  }}
                />
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => router.push(`/show/${userShow.show.id}`)}
                >
                  <h3 className="font-semibold text-lg">{userShow.show.title}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {userShow.show.unwatchedCount > 0 && (
                      <Badge variant="secondary">
                        {userShow.show.unwatchedCount} unwatched
                      </Badge>
                    )}
                    {userShow.rating && (
                      <Badge variant="outline" className="gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {userShow.rating}/10
                      </Badge>
                    )}
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  {renderDropdownMenu(userShow, status)}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    )
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">My Shows</h1>
              <p className="text-muted-foreground">Manage your TV show collection</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'gallery' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('gallery')}
              >
                <Grid3x3 className="h-4 w-4 mr-2" />
                Gallery
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4 mr-2" />
                List
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="ongoing" className="space-y-4">
            <TabsList>
              <TabsTrigger value="ongoing">
                Current Shows ({shows.ongoing.length})
              </TabsTrigger>
              <TabsTrigger value="watchlater">
                Watch Later ({shows.watchlater.length})
              </TabsTrigger>
              <TabsTrigger value="ended">
                Ended ({shows.ended.length})
              </TabsTrigger>
              <TabsTrigger value="archived">
                Archived ({shows.archived.length})
              </TabsTrigger>
            </TabsList>

            {(['ongoing', 'watchlater', 'ended', 'archived'] as const).map((status) => (
              <TabsContent key={status} value={status}>
                {shows[status].length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Tv className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-lg font-medium">No shows in this category</p>
                      <p className="text-sm text-muted-foreground">
                        Add shows from the Browse page
                      </p>
                    </CardContent>
                  </Card>
                ) : viewMode === 'gallery' ? (
                  renderGalleryView(shows[status], status)
                ) : (
                  renderListView(shows[status], status)
                )}
              </TabsContent>
              ))}
            </Tabs>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
