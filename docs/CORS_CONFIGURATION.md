# CORS Configuration Guide

## Overview

Cross-Origin Resource Sharing (CORS) is configured to control which domains can access the Episode Tracker API. This is a critical security feature that prevents unauthorized cross-origin requests.

## How It Works

CORS is implemented in `/root/episodetracker/middleware.ts` and applies to all API routes (`/api/*`).

### Key Features

1. **Origin Validation**: Only requests from allowed origins receive CORS headers
2. **Preflight Support**: OPTIONS requests are handled automatically
3. **Credentials**: Supports cookies and authentication headers
4. **Configurable**: Origins can be set via environment variable

## Configuration

### Environment Variable

```bash
ALLOWED_ORIGINS=https://episodetracker.com,https://www.episodetracker.com,https://app.episodetracker.com
```

- **Format**: Comma-separated list of allowed origins
- **No trailing slashes**: Use `https://example.com` not `https://example.com/`
- **Protocol required**: Must include `http://` or `https://`

### Default Behavior

If `ALLOWED_ORIGINS` is not set, the following defaults are used (for development):
- `http://localhost:3000`
- `http://localhost:4000`
- `http://localhost:4001`

## CORS Headers

### For Preflight Requests (OPTIONS)
```
Access-Control-Allow-Origin: <requesting-origin>
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
Access-Control-Max-Age: 86400
Access-Control-Allow-Credentials: true
```

### For Actual Requests
```
Access-Control-Allow-Origin: <requesting-origin>
Access-Control-Allow-Credentials: true
```

## Production Setup

### Single Domain
```bash
ALLOWED_ORIGINS=https://episodetracker.example.com
```

### Multiple Domains
```bash
ALLOWED_ORIGINS=https://episodetracker.example.com,https://www.episodetracker.example.com,https://app.episodetracker.example.com
```

### With Subdomain
```bash
ALLOWED_ORIGINS=https://episodetracker.com,https://www.episodetracker.com,https://api.episodetracker.com
```

## Testing CORS

### Using curl

```bash
# Test preflight request
curl -X OPTIONS https://your-domain.com/api/user/shows \
  -H "Origin: https://allowed-domain.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization" \
  -v

# Test actual request
curl https://your-domain.com/api/user/shows \
  -H "Origin: https://allowed-domain.com" \
  -H "Authorization: Bearer your-token" \
  -v
```

### Using Browser Console

```javascript
// Should succeed if origin is allowed
fetch('https://your-domain.com/api/user/shows', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer your-token',
    'Content-Type': 'application/json'
  },
  credentials: 'include'
})
.then(response => response.json())
.then(data => console.log('Success:', data))
.catch(error => console.error('Error:', error));
```

## Security Considerations

### ✅ Best Practices

1. **Use HTTPS in Production**: Always use `https://` origins in production
2. **Limit Origins**: Only whitelist domains you control
3. **No Wildcards**: Never use `*` for `Access-Control-Allow-Origin` when using credentials
4. **Regular Review**: Periodically review and update allowed origins
5. **Environment-Specific**: Use different origins for dev, staging, and production

### ❌ Common Mistakes

1. **Including trailing slash**: `https://example.com/` ❌ → `https://example.com` ✅
2. **Missing protocol**: `example.com` ❌ → `https://example.com` ✅
3. **Using wildcards with credentials**: Not supported by browsers
4. **Mixing http and https**: Keep them separate and explicit

## Troubleshooting

### Error: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Cause**: The requesting origin is not in the allowed list.

**Solution**:
1. Check the origin in browser DevTools (Network tab)
2. Add the origin to `ALLOWED_ORIGINS` environment variable
3. Restart the application

### Error: "CORS policy: The value of the 'Access-Control-Allow-Origin' header must not be the wildcard '*'"

**Cause**: Trying to use credentials with wildcard origin.

**Solution**: Specify explicit origins in `ALLOWED_ORIGINS`.

### Preflight Request Fails

**Cause**: OPTIONS request not handled properly.

**Solution**: Verify middleware is running and `OPTIONS` method is not blocked by nginx.

## Nginx Configuration

When using nginx as a reverse proxy, ensure it doesn't interfere with CORS:

```nginx
# Don't add CORS headers at nginx level - let the app handle it
# But do pass the Origin header
proxy_set_header Origin $http_origin;
```

## Development vs Production

### Development
```bash
# .env.local
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4001
```

### Staging
```bash
# .env.staging
ALLOWED_ORIGINS=https://staging.episodetracker.com
```

### Production
```bash
# .env.production
ALLOWED_ORIGINS=https://episodetracker.com,https://www.episodetracker.com
```

## Additional Security Layers

CORS works in conjunction with other security measures:

1. **JWT Authentication**: CORS doesn't bypass auth requirements
2. **Rate Limiting**: CORS-compliant requests still count toward rate limits
3. **CSP Headers**: Content Security Policy provides additional protection
4. **HTTPS**: Always use HTTPS in production for secure origin validation

## Monitoring

Monitor CORS-related issues by checking logs for:
- Failed preflight requests
- Requests from unexpected origins
- CORS header missing errors

Example log patterns to watch:
```
[SECURITY] Unauthorized access attempt from origin: https://malicious-site.com
```

## Support for Mobile Apps

If you plan to support mobile apps:

### React Native
```bash
# No CORS restrictions in React Native
# But still validate on server side
```

### Capacitor/Ionic
```bash
ALLOWED_ORIGINS=capacitor://localhost,ionic://localhost,https://your-domain.com
```

## References

- [MDN CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [OWASP CORS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/CORS_Cheat_Sheet.html)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)

---

**Last Updated**: October 2025  
**Implemented In**: `/root/episodetracker/middleware.ts`

