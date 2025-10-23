// API client utility for making authenticated requests

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token')
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Merge with any existing headers
  if (options.headers) {
    Object.entries(options.headers as Record<string, string>).forEach(([key, value]) => {
      headers[key] = value
    })
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  return response
}

export async function apiGet(url: string) {
  return fetchWithAuth(url, { method: 'GET' })
}

export async function apiPost(url: string, data?: any) {
  return fetchWithAuth(url, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  })
}

export async function apiPatch(url: string, data?: any) {
  return fetchWithAuth(url, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  })
}

export async function apiDelete(url: string) {
  return fetchWithAuth(url, { method: 'DELETE' })
}

