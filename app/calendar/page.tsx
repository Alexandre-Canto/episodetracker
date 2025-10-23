'use client'

import React, { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import { apiGet } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, AlertCircle, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addMonths, subMonths, addWeeks, subWeeks, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, isPast } from 'date-fns'

interface Episode {
  id: string
  title: string
  airDate: string
  episodeNumber: number
  watched: boolean
  season: {
    seasonNumber: number
    show: {
      id: string
      title: string
      poster: string
    }
  }
}

interface CalendarData {
  episodesByDate: Record<string, Episode[]>
  month: number
  year: number
}

export default function CalendarPage() {
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<'agenda' | 'week' | 'month'>('agenda')

  useEffect(() => {
    fetchCalendar()
  }, [currentDate])

  const fetchCalendar = async () => {
    try {
      setLoading(true)
      setError('')
      
      const month = currentDate.getMonth() + 1
      const year = currentDate.getFullYear()
      
      const response = await apiGet(`/api/calendar?month=${month}&year=${year}`)
      const data = await response.json()
      
      if (response.ok) {
        setCalendarData(data)
      } else {
        setError(data.error || 'Failed to fetch calendar')
      }
    } catch (error) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const handlePrevious = () => {
    if (view === 'week') {
      setCurrentDate(subWeeks(currentDate, 1))
    } else {
      setCurrentDate(subMonths(currentDate, 1))
    }
  }

  const handleNext = () => {
    if (view === 'week') {
      setCurrentDate(addWeeks(currentDate, 1))
    } else {
      setCurrentDate(addMonths(currentDate, 1))
    }
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const getEpisodesForDate = (date: Date): Episode[] => {
    const dateKey = format(date, 'yyyy-MM-dd')
    return calendarData?.episodesByDate[dateKey] || []
  }

  const renderAgendaView = () => {
    const episodesByDate = calendarData?.episodesByDate || {}
    const sortedDates = Object.keys(episodesByDate).sort()

    if (sortedDates.length === 0) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No episodes this month</p>
            <p className="text-sm text-muted-foreground">
              Add shows to see their upcoming episodes
            </p>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-6">
        {sortedDates.map((dateKey) => {
          const episodes = episodesByDate[dateKey]
          const date = new Date(dateKey)
          const isTodayDate = isToday(date)
          const isPastDate = isPast(date) && !isTodayDate

          return (
            <div key={dateKey} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-3 ${isTodayDate ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <p className="text-xs font-medium">{format(date, 'EEE')}</p>
                  <p className="text-2xl font-bold">{format(date, 'd')}</p>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{format(date, 'MMMM d, yyyy')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {episodes.length} episode{episodes.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              
              <div className="ml-[76px] space-y-2">
                {episodes.map((episode) => (
                  <Card key={episode.id} className={episode.watched ? 'opacity-60' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {episode.season.show.poster && (
                          <img
                            src={episode.season.show.poster}
                            alt={episode.season.show.title}
                            className="h-20 w-14 object-cover rounded"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = '/placeholder-poster.jpg'
                            }}
                          />
                        )}
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{episode.season.show.title}</h4>
                            {episode.watched && (
                              <Badge variant="secondary" className="text-xs">Watched</Badge>
                            )}
                            {isPastDate && !episode.watched && (
                              <Badge variant="outline" className="text-xs">Missed</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              S{episode.season.seasonNumber}E{episode.episodeNumber}
                            </Badge>
                            <p className="text-sm">{episode.title}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }) // Monday
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

    return (
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {days.map((day) => {
          const episodes = getEpisodesForDate(day)
          const isTodayDate = isToday(day)
          const isPastDate = isPast(day) && !isTodayDate

          return (
            <Card key={day.toISOString()} className={isTodayDate ? 'border-primary' : ''}>
              <CardHeader className="p-4 pb-2">
                <div className={`text-center ${isTodayDate ? 'text-primary font-bold' : ''}`}>
                  <p className="text-xs font-medium">{format(day, 'EEE')}</p>
                  <p className="text-2xl font-bold">{format(day, 'd')}</p>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-2">
                {episodes.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center">No episodes</p>
                ) : (
                  episodes.map((episode) => (
                    <div
                      key={episode.id}
                      className={`p-2 rounded-md border text-xs space-y-1 ${
                        episode.watched ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        {episode.season.show.poster && (
                          <img
                            src={episode.season.show.poster}
                            alt={episode.season.show.title}
                            className="h-8 w-6 object-cover rounded"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = '/placeholder-poster.jpg'
                            }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{episode.season.show.title}</p>
                          <p className="text-muted-foreground truncate">
                            S{episode.season.seasonNumber}E{episode.episodeNumber}
                          </p>
                        </div>
                      </div>
                      {episode.watched && (
                        <Badge variant="secondary" className="text-xs w-full justify-center">
                          Watched
                        </Badge>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

    // Group days into weeks
    const weeks: Date[][] = []
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7))
    }

    return (
      <div className="space-y-2">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 gap-2">
            {week.map((day) => {
              const episodes = getEpisodesForDate(day)
              const isTodayDate = isToday(day)
              const isPastDate = isPast(day) && !isTodayDate
              const isCurrentMonth = isSameMonth(day, currentDate)

              return (
                <Card
                  key={day.toISOString()}
                  className={`min-h-[120px] ${
                    isTodayDate ? 'border-primary' : ''
                  } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                >
                  <CardContent className="p-2 space-y-1">
                    <div
                      className={`text-sm font-medium ${
                        isTodayDate
                          ? 'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center'
                          : ''
                      }`}
                    >
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {episodes.slice(0, 3).map((episode) => (
                        <div
                          key={episode.id}
                          className={`text-xs p-1 rounded bg-muted truncate ${
                            episode.watched ? 'opacity-60' : ''
                          }`}
                          title={`${episode.season.show.title} - S${episode.season.seasonNumber}E${episode.episodeNumber}`}
                        >
                          {episode.season.show.title}
                        </div>
                      ))}
                      {episodes.length > 3 && (
                        <div className="text-xs text-muted-foreground text-center">
                          +{episodes.length - 3} more
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ))}
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

  const episodesByDate = calendarData?.episodesByDate || {}
  const totalEpisodes = Object.values(episodesByDate).reduce((sum, eps) => sum + eps.length, 0)

  const getViewTitle = () => {
    if (view === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
    }
    return format(currentDate, 'MMMM yyyy')
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
              <p className="text-muted-foreground">
                {totalEpisodes} episodes in {format(currentDate, 'MMMM yyyy')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleToday}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={handleNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* View Tabs */}
          <Tabs value={view} onValueChange={(v) => setView(v as 'agenda' | 'week' | 'month')}>
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="agenda">Agenda</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
              </TabsList>
              <p className="text-sm text-muted-foreground">{getViewTitle()}</p>
            </div>

            <TabsContent value="agenda" className="mt-0">
              {renderAgendaView()}
            </TabsContent>

            <TabsContent value="week" className="mt-0">
              {renderWeekView()}
            </TabsContent>

            <TabsContent value="month" className="mt-0">
              {renderMonthView()}
            </TabsContent>
          </Tabs>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
