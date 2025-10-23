'use client'

import React, { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import { apiGet, apiPost, apiDelete, apiPatch } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Loader2, AlertCircle, CheckCircle2, XCircle, RefreshCw, Link as LinkIcon, ExternalLink, Server, Clock } from 'lucide-react'

interface Integration {
  id: string
  provider: string
  serverUrl: string
  serverName?: string
  plexUsername?: string
  plexEmail?: string
  lastSync?: string
  enabled: boolean
  autoSync: boolean
  createdAt: string
}

interface SyncLog {
  id: string
  status: string
  showsSynced: number
  episodesSynced: number
  errors: string[] | null
  duration?: number
  syncedAt: string
}

export default function IntegrationsPage() {
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [updatingSettings, setUpdatingSettings] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [plexIntegration, setPlexIntegration] = useState<Integration | null>(null)
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  
  // Plex OAuth state
  const [plexAuthUrl, setPlexAuthUrl] = useState('')
  const [plexPinId, setPlexPinId] = useState<number | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(false)

  useEffect(() => {
    fetchIntegrations()
  }, [])

  const fetchIntegrations = async () => {
    try {
      setLoading(true)
      const response = await apiGet('/api/integrations/plex/connect')
      const data = await response.json()
      
      if (data.connected) {
        setPlexIntegration(data.integration)
        await fetchSyncLogs()
      }
    } catch (error) {
      console.error('Error fetching integrations:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSyncLogs = async () => {
    try {
      const response = await apiGet('/api/integrations/plex/sync')
      const data = await response.json()
      setSyncLogs(data.logs || [])
    } catch (error) {
      console.error('Error fetching sync logs:', error)
    }
  }

  const startPlexOAuth = async () => {
    try {
      setConnecting(true)
      setError('')
      
      const response = await apiGet('/api/integrations/plex/auth/pin')
      const data = await response.json()
      
      setPlexAuthUrl(data.authUrl)
      setPlexPinId(data.pinId)
      
      // Open Plex auth in new window
      window.open(data.authUrl, 'plexAuth', 'width=600,height=700')
      
      // Start checking for authorization
      checkPlexAuth(data.pinId)
    } catch (error: any) {
      setError('Failed to start Plex authorization')
      console.error(error)
    } finally {
      setConnecting(false)
    }
  }

  const checkPlexAuth = async (pinId: number, attempt = 0) => {
    if (attempt > 60) { // 2 minutes max
      setError('Authorization timeout. Please try again.')
      setPlexPinId(null)
      setCheckingAuth(false)
      return
    }

    setCheckingAuth(true)

    try {
      const response = await apiPost('/api/integrations/plex/auth/check', {
        pinId
      })
      const data = await response.json()

      if (data.authorized) {
        // Show server selection or connect directly if only one server
        if (data.servers && data.servers.length > 0) {
          const server = data.servers[0]
          await connectPlex(
            data.authToken,
            server.connections[0].uri,
            server.name,
            data.user.username,
            data.user.email
          )
        }
        setCheckingAuth(false)
        setPlexPinId(null)
      } else {
        // Keep checking
        setTimeout(() => checkPlexAuth(pinId, attempt + 1), 2000)
      }
    } catch (error) {
      setTimeout(() => checkPlexAuth(pinId, attempt + 1), 2000)
    }
  }

  const connectPlex = async (
    authToken: string,
    serverUrl: string,
    serverName: string,
    username: string,
    email: string
  ) => {
    try {
      const response = await apiPost('/api/integrations/plex/connect', {
        authToken,
        serverUrl,
        serverName,
        username,
        email
      })
      const data = await response.json()

      if (data.success) {
        setSuccess('Plex connected successfully!')
        await fetchIntegrations()
      } else {
        setError(data.error || 'Failed to connect Plex')
      }
    } catch (error: any) {
      setError('Failed to connect Plex')
      console.error(error)
    }
  }

  const disconnectPlex = async () => {
    if (!confirm('Are you sure you want to disconnect Plex? This will not delete your synced data.')) {
      return
    }

    try {
      const response = await apiDelete('/api/integrations/plex/connect')
      const data = await response.json()

      if (data.success) {
        setSuccess('Plex disconnected successfully')
        setPlexIntegration(null)
        setSyncLogs([])
      } else {
        setError('Failed to disconnect Plex')
      }
    } catch (error) {
      setError('Failed to disconnect Plex')
      console.error(error)
    }
  }

  const syncPlex = async () => {
    try {
      setSyncing(true)
      setError('')
      setSuccess('')

      const response = await apiPost('/api/integrations/plex/sync', {})
      const data = await response.json()

      if (data.success) {
        setSuccess(`Sync complete! ${data.showsSynced} shows, ${data.episodesSynced} episodes synced.`)
        await fetchIntegrations()
      } else {
        setError(data.error || 'Sync failed')
      }
    } catch (error: any) {
      setError('Failed to sync Plex')
      console.error(error)
    } finally {
      setSyncing(false)
    }
  }

  const toggleAutoSync = async (enabled: boolean) => {
    try {
      setUpdatingSettings(true)
      setError('')

      const response = await apiPatch('/api/integrations/plex/settings', {
        autoSync: enabled
      })
      const data = await response.json()

      if (data.success) {
        setPlexIntegration(prev => prev ? { ...prev, autoSync: data.autoSync } : null)
        setSuccess(enabled ? 'Daily auto-sync enabled at 3 AM' : 'Daily auto-sync disabled')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.error || 'Failed to update settings')
      }
    } catch (error: any) {
      setError('Failed to update settings')
      console.error(error)
    } finally {
      setUpdatingSettings(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-lg">Loading integrations...</span>
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
            <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
            <p className="text-muted-foreground">
              Connect your media servers to automatically sync watch progress
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-500 bg-green-50 text-green-900">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Plex Integration Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Server className="h-8 w-8" />
                  <div>
                    <CardTitle>Plex Media Server</CardTitle>
                    <CardDescription>
                      Automatically sync your watched episodes from Plex
                    </CardDescription>
                  </div>
                </div>
                {plexIntegration ? (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <XCircle className="h-3 w-3 mr-1" />
                    Not Connected
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!plexIntegration ? (
                <div className="space-y-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">How it works</h3>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Click "Connect Plex" below</li>
                      <li>Sign in to your Plex account</li>
                      <li>Grant access to Episode Tracker</li>
                      <li>We'll automatically import your watched episodes</li>
                    </ul>
                  </div>
                  {checkingAuth && (
                    <Alert>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <AlertDescription>
                        Waiting for authorization... Please sign in to Plex in the popup window.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Server</p>
                      <p className="font-medium">{plexIntegration.serverName || plexIntegration.serverUrl}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Account</p>
                      <p className="font-medium">{plexIntegration.plexUsername || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Last Sync</p>
                      <p className="font-medium">
                        {plexIntegration.lastSync 
                          ? new Date(plexIntegration.lastSync).toLocaleString()
                          : 'Never'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <p className="font-medium">
                        {plexIntegration.enabled ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Auto-Sync Setting */}
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <Label htmlFor="auto-sync" className="text-base font-medium cursor-pointer">
                          Daily Auto-Sync
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically sync watch progress every day at 3 AM
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="auto-sync"
                      checked={plexIntegration.autoSync}
                      onCheckedChange={toggleAutoSync}
                      disabled={updatingSettings}
                    />
                  </div>

                  <Separator />

                  {/* Sync Logs */}
                  {syncLogs.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3">Recent Syncs</h3>
                      <div className="space-y-2">
                        {syncLogs.map((log) => (
                          <div key={log.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <div className="flex items-center gap-3">
                              {log.status === 'success' ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : log.status === 'error' ? (
                                <XCircle className="h-4 w-4 text-red-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-yellow-500" />
                              )}
                              <div>
                                <p className="text-sm font-medium">
                                  {log.showsSynced} shows, {log.episodesSynced} episodes
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(log.syncedAt).toLocaleString()}
                                  {log.duration && ` • ${(log.duration / 1000).toFixed(1)}s`}
                                </p>
                              </div>
                            </div>
                            <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                              {log.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              {!plexIntegration ? (
                <Button
                  onClick={startPlexOAuth}
                  disabled={connecting || checkingAuth}
                >
                  {connecting || checkingAuth ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {checkingAuth ? 'Waiting for Authorization...' : 'Connecting...'}
                    </>
                  ) : (
                    <>
                      <LinkIcon className="mr-2 h-4 w-4" />
                      Connect Plex
                    </>
                  )}
                </Button>
              ) : (
                <>
                  <Button
                    onClick={syncPlex}
                    disabled={syncing}
                  >
                    {syncing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Sync Now
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={disconnectPlex}
                  >
                    Disconnect
                  </Button>
                </>
              )}
            </CardFooter>
          </Card>

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Coming Soon</CardTitle>
              <CardDescription>More integrations will be available soon</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Jellyfin - Open-source media server</li>
                <li>• Emby - Personal media server</li>
                <li>• Kodi - Media player integration</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}

