'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import { apiGet } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Loader2, AlertCircle, Sparkles, Info, ChevronDown, ChevronUp } from 'lucide-react'

interface ShowRecommendation {
  title: string
  year: number
  genres: string[]
  reason: string
  similarTo: string[]
  posterUrl?: string | null
  traktId?: number
}

interface GenreRecommendations {
  genre: string
  recommendations: ShowRecommendation[]
}

interface RecommendationsData {
  recommendations: GenreRecommendations[]
  basedOn: number
  generatedAt: string
}

export default function RecommendationsPage() {
  const router = useRouter()
  const [data, setData] = useState<RecommendationsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedGenres, setExpandedGenres] = useState<Record<string, boolean>>({})
  const [isCached, setIsCached] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  const fetchRecommendations = async (regenerate = false) => {
    try {
      setLoading(true)
      setError('')
      
      const url = regenerate 
        ? '/api/ai/recommendations?regenerate=true' 
        : '/api/ai/recommendations'
      
      const response = await apiGet(url)
      const result = await response.json()
      
      if (response.ok) {
        setData(result)
        setIsCached(result.cached || false)
        // Initialize all genres as expanded by default
        const initialExpanded: Record<string, boolean> = {}
        result.recommendations.forEach((genre: GenreRecommendations) => {
          initialExpanded[genre.genre] = true
        })
        setExpandedGenres(initialExpanded)
      } else {
        setError(result.message || result.error || 'Failed to fetch recommendations')
      }
    } catch (error) {
      setError('Network error')
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }

  // Load cached recommendations on mount
  useEffect(() => {
    fetchRecommendations(false)
  }, [])

  const handleShowClick = async (show: ShowRecommendation) => {
    // If we already have the Trakt ID, navigate directly
    if (show.traktId) {
      router.push(`/show/${show.traktId}`)
      return
    }

    // Otherwise, search for the show and navigate to the first result
    try {
      const response = await apiGet(`/api/shows/browse?query=${encodeURIComponent(show.title)}`)
      const result = await response.json()
      
      if (result.shows && result.shows.length > 0) {
        // Try to find a show that matches the year
        const matchingShow = result.shows.find((s: any) => s.year === show.year)
        const showToNavigate = matchingShow || result.shows[0]
        
        if (showToNavigate.ids?.trakt) {
          router.push(`/show/${showToNavigate.ids.trakt}`)
        } else {
          // Fallback to browse with search if no ID
          router.push(`/browse?search=${encodeURIComponent(show.title)}`)
        }
      } else {
        // No results, go to browse with search
        router.push(`/browse?search=${encodeURIComponent(show.title)}`)
      }
    } catch (error) {
      console.error('Error searching for show:', error)
      router.push(`/browse?search=${encodeURIComponent(show.title)}`)
    }
  }

  const toggleGenre = (genre: string) => {
    setExpandedGenres(prev => ({
      ...prev,
      [genre]: !prev[genre]
    }))
  }

  const expandAll = () => {
    if (!data) return
    const allExpanded: Record<string, boolean> = {}
    data.recommendations.forEach((genre) => {
      allExpanded[genre.genre] = true
    })
    setExpandedGenres(allExpanded)
  }

  const collapseAll = () => {
    if (!data) return
    const allCollapsed: Record<string, boolean> = {}
    data.recommendations.forEach((genre) => {
      allCollapsed[genre.genre] = false
    })
    setExpandedGenres(allCollapsed)
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight">AI Recommendations</h1>
            </div>
            <p className="text-muted-foreground">
              Personalized show recommendations based on your watching history
            </p>
          </div>

          {/* Info Card */}
          {!data && !loading && (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="flex items-start gap-4 p-6">
                <Info className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold">How it works (Powered by AI - Free!)</h3>
                  <p className="text-sm text-muted-foreground">
                    Our AI analyzes your tracked shows' genres, themes, and descriptions to suggest 
                    new shows you might enjoy. Recommendations are grouped by genre and explain why 
                    each show matches your taste.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Uses Groq (truly free, no credit card) or OpenAI (free tier, requires payment method).
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Based on shows in your Current, Watch Later, and Ended lists</li>
                    <li>Separated by genre to avoid mixing tones (comedy vs horror)</li>
                    <li>Includes shows similar to your favorites</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generate Button */}
          {!data && !initialLoading && (
            <div className="flex justify-center">
              <Button
                size="lg"
                onClick={() => fetchRecommendations(false)}
                disabled={loading}
                className="gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generating Recommendations...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Generate Recommendations
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Initial Loading */}
          {initialLoading && (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-lg">Loading recommendations...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Recommendations */}
          {data && (
            <div className="space-y-6">
              {/* Stats Card */}
              <Card>
                <CardContent className="flex items-center justify-between p-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Based on</p>
                    <p className="text-2xl font-bold">{data.basedOn} shows</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {isCached ? 'Cached from' : 'Generated'}
                    </p>
                    <p className="text-sm font-medium">
                      {new Date(data.generatedAt).toLocaleString()}
                    </p>
                    {isCached && (
                      <Badge variant="secondary" className="mt-1">
                        From Cache
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={expandAll}
                    >
                      <ChevronDown className="h-4 w-4 mr-2" />
                      Expand All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={collapseAll}
                    >
                      <ChevronUp className="h-4 w-4 mr-2" />
                      Collapse All
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => fetchRecommendations(true)}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Regenerating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Regenerate
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Genre Groups */}
              <div className="space-y-6">
                {data.recommendations.map((genreGroup, idx) => (
                  <Card key={idx}>
                    <CardHeader 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleGenre(genreGroup.genre)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {expandedGenres[genreGroup.genre] ? (
                            <ChevronDown className="h-6 w-6 text-muted-foreground" />
                          ) : (
                            <ChevronUp className="h-6 w-6 text-muted-foreground" />
                          )}
                          <div>
                            <CardTitle className="text-2xl">{genreGroup.genre}</CardTitle>
                            <CardDescription>
                              {genreGroup.recommendations.length} recommendations
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-lg px-4 py-2">
                          {genreGroup.genre}
                        </Badge>
                      </div>
                    </CardHeader>
                    {expandedGenres[genreGroup.genre] && (
                      <CardContent>
                        <div className="space-y-4">
                          {genreGroup.recommendations.map((show, showIdx) => (
                          <Card 
                            key={showIdx} 
                            className="border-2 hover:border-primary/50 transition-all hover:shadow-lg cursor-pointer"
                            onClick={() => handleShowClick(show)}
                          >
                            <CardContent className="p-6">
                              <div className="flex gap-6">
                                {/* Poster */}
                                {show.posterUrl && (
                                  <div className="flex-shrink-0">
                                    <img
                                      src={show.posterUrl}
                                      alt={show.title}
                                      className="w-32 h-48 object-cover rounded-lg shadow-md"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement
                                        target.style.display = 'none'
                                      }}
                                    />
                                  </div>
                                )}
                                
                                {/* Content */}
                                <div className="flex-1 space-y-3">
                                  {/* Title and Year */}
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                      <h3 className="text-xl font-semibold mb-2">
                                        {show.title} ({show.year})
                                      </h3>
                                      <div className="flex flex-wrap gap-2 mb-3">
                                        {show.genres.map((genre) => (
                                          <Badge key={genre} variant="outline">
                                            {genre}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleShowClick(show)
                                      }}
                                    >
                                      View Details
                                    </Button>
                                  </div>

                                  {/* Reason */}
                                  <div className="bg-muted/50 p-4 rounded-lg">
                                    <p className="text-sm font-medium mb-1">Why you might like it:</p>
                                    <p className="text-sm text-muted-foreground">{show.reason}</p>
                                  </div>

                                  {/* Similar To */}
                                  {show.similarTo.length > 0 && (
                                    <div>
                                      <p className="text-sm font-medium mb-2">Similar to your shows:</p>
                                      <div className="flex flex-wrap gap-2">
                                        {show.similarTo.map((title, i) => (
                                          <Badge key={i} variant="secondary">
                                            {title}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Click hint */}
                                  <p className="text-xs text-muted-foreground italic">
                                    Click card or button to view show details
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}

