'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import { apiGet, apiPost } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Search, Plus, Loader2, AlertCircle } from 'lucide-react'

interface Show {
  title: string
  year: number
  ids: {
    trakt: number
    tmdb: number
  }
  overview: string
  first_aired: string
  runtime: number
  network: string
  status: string
  genres: string[]
  posterUrl?: string | null
}

export default function BrowsePage() {
  const router = useRouter()
  const [shows, setShows] = useState<Show[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    name: '',
    network: '',
    genre: '',
    dayOfWeek: '',
    status: 'any',
    runtime: 'any',
    showAge: 'any',
    top100: false,
    upcomingPremiers: false,
    excludeAdded: false,
  })
  const [selectedShow, setSelectedShow] = useState<Show | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState('ongoing')

  const genres = [
    'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
    'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery',
    'Romance', 'Science Fiction', 'Thriller', 'War', 'Western'
  ]

  const daysOfWeek = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  ]

  const fetchShows = async () => {
    try {
      setLoading(true)
      setError('')
      
      const params = new URLSearchParams()
      if (searchQuery) params.append('query', searchQuery)
      if (filters.name) params.append('name', filters.name)
      if (filters.network) params.append('network', filters.network)
      if (filters.genre) params.append('genre', filters.genre)
      if (filters.dayOfWeek) params.append('dayOfWeek', filters.dayOfWeek)
      if (filters.status !== 'any') params.append('status', filters.status)
      if (filters.runtime !== 'any') params.append('runtime', filters.runtime)
      if (filters.showAge !== 'any') params.append('showAge', filters.showAge)
      if (filters.top100) params.append('top100', 'true')
      if (filters.upcomingPremiers) params.append('upcomingPremiers', 'true')
      if (filters.excludeAdded) params.append('excludeAdded', 'true')

      const response = await apiGet(`/api/shows/browse?${params.toString()}`)
      const data = await response.json()
      
      if (response.ok) {
        setShows(data.shows)
      } else {
        setError(data.error || 'Failed to fetch shows')
      }
    } catch (error) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    fetchShows()
  }

  const handleAddShow = async () => {
    if (!selectedShow) return

    try {
      const response = await apiPost('/api/user/shows', {
        traktId: selectedShow.ids.trakt,
        status: selectedStatus,
      })

      if (response.ok) {
        setAddDialogOpen(false)
        setSelectedShow(null)
        fetchShows()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to add show')
      }
    } catch (error) {
      setError('Network error')
    }
  }

  const getPosterUrl = (show: Show) => {
    return show.posterUrl || '/placeholder-poster.jpg'
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Browse Shows</h1>
            <p className="text-muted-foreground">Discover and add new TV shows to your collection</p>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Filters Sidebar */}
            <aside className="w-full lg:w-80 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Search & Filters</CardTitle>
                  <CardDescription>Find your next favorite show</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Search Input */}
                  <div className="space-y-2">
                    <Label htmlFor="search">Search Shows</Label>
                    <div className="flex gap-2">
                      <Input
                        id="search"
                        placeholder="Enter show name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      />
                      <Button onClick={handleSearch} size="icon">
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Name Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="name-filter">Filter by Name</Label>
                    <Input
                      id="name-filter"
                      placeholder="Filter results..."
                      value={filters.name}
                      onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                    />
                  </div>

                  {/* Network */}
                  <div className="space-y-2">
                    <Label htmlFor="network">Network</Label>
                    <Input
                      id="network"
                      placeholder="e.g., HBO, Netflix..."
                      value={filters.network}
                      onChange={(e) => setFilters({ ...filters, network: e.target.value })}
                    />
                  </div>

                  {/* Genre */}
                  <div className="space-y-2">
                    <Label htmlFor="genre">Genre</Label>
                    <Select value={filters.genre || "any"} onValueChange={(value) => setFilters({ ...filters, genre: value === "any" ? "" : value })}>
                      <SelectTrigger id="genre">
                        <SelectValue placeholder="Any genre" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        {genres.map((genre) => (
                          <SelectItem key={genre} value={genre}>
                            {genre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Day of Week */}
                  <div className="space-y-2">
                    <Label htmlFor="day">Day of Week</Label>
                    <Select value={filters.dayOfWeek || "any"} onValueChange={(value) => setFilters({ ...filters, dayOfWeek: value === "any" ? "" : value })}>
                      <SelectTrigger id="day">
                        <SelectValue placeholder="Any day" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        {daysOfWeek.map((day) => (
                          <SelectItem key={day} value={day}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <RadioGroup value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="any" id="status-any" />
                        <Label htmlFor="status-any" className="font-normal">Any</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="running" id="status-running" />
                        <Label htmlFor="status-running" className="font-normal">Running</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="ended" id="status-ended" />
                        <Label htmlFor="status-ended" className="font-normal">Ended</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Runtime */}
                  <div className="space-y-2">
                    <Label>Runtime</Label>
                    <RadioGroup value={filters.runtime} onValueChange={(value) => setFilters({ ...filters, runtime: value })}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="any" id="runtime-any" />
                        <Label htmlFor="runtime-any" className="font-normal">Any</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="0-59" id="runtime-short" />
                        <Label htmlFor="runtime-short" className="font-normal">0-59 minutes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="60+" id="runtime-long" />
                        <Label htmlFor="runtime-long" className="font-normal">60+ minutes</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Show Age */}
                  <div className="space-y-2">
                    <Label>Show Age</Label>
                    <RadioGroup value={filters.showAge} onValueChange={(value) => setFilters({ ...filters, showAge: value })}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="any" id="age-any" />
                        <Label htmlFor="age-any" className="font-normal">Any</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="<1" id="age-new" />
                        <Label htmlFor="age-new" className="font-normal">Less than 1 year</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="1+" id="age-old" />
                        <Label htmlFor="age-old" className="font-normal">1+ years</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Checkboxes */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="top100"
                        checked={filters.top100}
                        onCheckedChange={(checked) => setFilters({ ...filters, top100: checked as boolean })}
                      />
                      <Label htmlFor="top100" className="font-normal">Top 100 shows</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="upcoming"
                        checked={filters.upcomingPremiers}
                        onCheckedChange={(checked) => setFilters({ ...filters, upcomingPremiers: checked as boolean })}
                      />
                      <Label htmlFor="upcoming" className="font-normal">Upcoming premiers</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="exclude"
                        checked={filters.excludeAdded}
                        onCheckedChange={(checked) => setFilters({ ...filters, excludeAdded: checked as boolean })}
                      />
                      <Label htmlFor="exclude" className="font-normal">Exclude added shows</Label>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" onClick={handleSearch} disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Search
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </aside>

            {/* Results */}
            <div className="flex-1">
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : shows.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Search className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">No shows found</p>
                    <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {shows.map((show) => (
                    <Card key={show.ids.trakt} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <div 
                        className="aspect-[2/3] relative overflow-hidden bg-muted cursor-pointer"
                        onClick={() => router.push(`/show/${show.ids.trakt}`)}
                      >
                        <img
                          src={getPosterUrl(show)}
                          alt={show.title}
                          className="object-cover w-full h-full"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.src = '/placeholder-poster.jpg'
                          }}
                        />
                      </div>
                      <CardHeader 
                        className="p-4 cursor-pointer"
                        onClick={() => router.push(`/show/${show.ids.trakt}`)}
                      >
                        <CardTitle className="line-clamp-1 text-base">{show.title}</CardTitle>
                        <CardDescription className="flex items-center gap-2 text-xs">
                          <span>{show.year}</span>
                          {show.network && (
                            <>
                              <span>•</span>
                              <span>{show.network}</span>
                            </>
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent 
                        className="p-4 pt-0 cursor-pointer"
                        onClick={() => router.push(`/show/${show.ids.trakt}`)}
                      >
                        <div className="flex flex-wrap gap-1 mb-3">
                          {show.genres && show.genres.slice(0, 3).map((genre) => (
                            <Badge key={genre} variant="secondary" className="text-xs">
                              {genre}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {show.overview}
                        </p>
                      </CardContent>
                      <CardFooter className="p-4 pt-0">
                        <Button
                          className="w-full"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedShow(show)
                            setAddDialogOpen(true)
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Show
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add Show Dialog */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Show to My Shows</DialogTitle>
              <DialogDescription>
                Choose which list to add {selectedShow?.title} to
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ongoing">Current Shows</SelectItem>
                    <SelectItem value="watchlater">Watch Later</SelectItem>
                    <SelectItem value="ended">Ended Shows</SelectItem>
                    <SelectItem value="archived">Archived Shows</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddShow}>Add Show</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Layout>
    </ProtectedRoute>
  )
}
