# Episode Tracker

A modern, full-featured TV show tracking application built with Next.js, Prisma, and PostgreSQL.

## Features

- 📺 **Show Management**: Track your favorite TV shows across multiple lists (Current Shows, Watch Later, Ended, Archived)
- ✅ **Episode Tracking**: Mark episodes and entire seasons as watched
- 📅 **Calendar View**: View upcoming episodes in Agenda, Week, or Month view
- 🔍 **Browse & Search**: Discover new shows with advanced filtering options
- ⭐ **Ratings**: Rate your shows from 1-10 stars
- 📊 **Statistics**: Track watched episodes and viewing time
- 👤 **Profile**: View your watching history organized by show
- 🎬 **Show Details**: IMDb-like show pages with cast, episodes, and information
- 🖼️ **Poster Images**: High-quality show posters from TMDB with Redis caching
- 🔐 **Authentication**: Secure JWT-based authentication
- 🎨 **Modern UI**: Beautiful, responsive interface built with shadcn/ui and Tailwind CSS

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **UI**: shadcn/ui, Tailwind CSS, Lucide Icons
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **APIs**: Trakt TV API, TMDB API
- **Caching**: Redis (ioredis)
- **Authentication**: JWT (jsonwebtoken)
- **Container**: Docker & Docker Compose

## Prerequisites

- Docker and Docker Compose
- Trakt TV API credentials (Client ID and Client Secret)
- TMDB API Key (v3 or v4 Bearer Token)

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd episodetracker
```

### 2. Set up environment variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://postgres:password@db:5432/episodetracker

# Redis
REDIS_URL=redis://redis:6379

# JWT Secret (generate a secure random string)
JWT_SECRET=your-secure-jwt-secret-here

# Trakt TV API
TRAKT_CLIENT_ID=your-trakt-client-id
TRAKT_CLIENT_SECRET=your-trakt-client-secret

# TMDB API
TMDB_API_KEY=your-tmdb-api-key-or-bearer-token
```

### 3. Run with Docker Compose

**Development:**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

**Production:**
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

The app will be available at:
- Development: http://localhost:4001
- Production: http://localhost:4000

### 4. Initialize the database

The database will be automatically initialized on first run. To manually run migrations:

```bash
docker exec episodetracker_app_dev npx prisma db push
docker exec episodetracker_app_dev npx prisma generate
```

## API Keys Setup

### Trakt TV API

1. Go to https://trakt.tv/oauth/applications
2. Create a new application
3. Copy your **Client ID** and **Client Secret**

### TMDB API

1. Go to https://www.themoviedb.org/settings/api
2. Request an API key
3. Use either:
   - **API Key (v3)**: 32 character hex string
   - **API Read Access Token (v4)**: JWT bearer token

## Project Structure

```
episodetracker/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── browse/            # Browse shows page
│   ├── calendar/          # Calendar view page
│   ├── login/             # Login page
│   ├── profile/           # User profile page
│   ├── register/          # Registration page
│   ├── show/[id]/         # Show detail page
│   ├── shows/             # My shows page
│   └── unwatched/         # Unwatched episodes page
├── components/            # React components
│   └── ui/               # shadcn/ui components
├── lib/                   # Utilities and helpers
│   ├── api-client.ts     # API client
│   ├── auth.ts           # Authentication utilities
│   ├── db.ts             # Prisma client
│   ├── jwt.ts            # JWT utilities
│   ├── redis.ts          # Redis client
│   ├── tmdb.ts           # TMDB API integration
│   ├── trakt.ts          # Trakt API integration
│   └── utils.ts          # General utilities
├── prisma/               # Database schema
│   └── schema.prisma
├── docker-compose.dev.yml   # Development configuration
├── docker-compose.prod.yml  # Production configuration
└── Dockerfile.dev/prod      # Docker images

```

## Features Overview

### Show Lists
- **Current Shows**: Shows you're actively watching
- **Watch Later**: Shows you want to watch in the future
- **Ended**: Completed series
- **Archived**: Shows you're no longer tracking

### Views
- **Gallery View**: Grid layout with large posters
- **List View**: Compact horizontal list

### Calendar
- **Agenda View**: Chronological list of episodes
- **Week View**: 7-day grid view
- **Month View**: Full calendar month view

### Filtering
Browse shows with filters for:
- Name, Network, Genre
- Status (airing/ended/canceled)
- Runtime, Show age
- Day of week
- Exclude already added shows

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Acknowledgments

- [Trakt TV](https://trakt.tv) for show data and tracking API
- [TMDB](https://www.themoviedb.org) for high-quality show posters
- [shadcn/ui](https://ui.shadcn.com) for beautiful UI components
