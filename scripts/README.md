# Episode Tracker Scripts

This directory contains utility scripts for managing your Episode Tracker database.

## Scripts Overview

- **`import-csv-data.js`** - Import episode data from CSV files
- **`update-show-posters.js`** - Fetch posters and metadata for existing shows
- **`list-users.js`** - List all users in the database

---

# CSV Data Import Script

This script imports episode tracking data from a CSV file into the Episode Tracker database.

## CSV Format

The script expects a CSV file with the following columns:

- `show` - Show title (string)
- `season` - Season number (integer)
- `number` - Episode number (integer)
- `name` - Episode title (string)
- `air_date` - Air date in MM/DD/YYYY format (string)
- `watched` - Whether the episode was watched (TRUE/FALSE)

### Example CSV:
```csv
show,season,number,name,air_date,watched
1899,1,1,The Ship,11/17/2022,TRUE
1899,1,2,The Boy,11/17/2022,TRUE
24,1,1,12:00 A.M. - 1:00 A.M.,11/6/2001,TRUE
```

## Usage

### Prerequisites

1. Ensure your database is set up and migrated:
   ```bash
   npm run db:push
   ```

2. Create a user account in the database (you'll need the user ID)

3. Place your CSV file at `/root/episodetracker/data.csv`

4. **Optional but Recommended**: Set up TMDB API key for show posters and metadata:
   - Get a free API key from [The Movie Database](https://www.themoviedb.org/settings/api)
   - Add it to your `.env` file: `TMDB_API_KEY=your-api-key-here`
   - Without this, shows will be imported without posters and with minimal metadata

### Running the Import

#### Dry Run (Recommended First)
Test the import without making changes:
```bash
npm run import:csv:dry -- --user-id=USER_ID
```

#### Full Import
Import the data into the database:
```bash
npm run import:csv -- --user-id=USER_ID
```

### Command Line Options

- `--user-id=USER_ID` - **Required**: The ID of the user to import data for
- `--dry-run` - Optional: Preview what would be imported without making changes

## What the Script Does

1. **Validates Input**: Checks that the user exists and CSV file is readable
2. **Parses CSV**: Reads and validates the CSV data structure
3. **Creates Shows**: Creates show records with generated Trakt IDs
4. **Creates Seasons**: Creates season records for each show
5. **Creates Episodes**: Creates episode records with titles and air dates
6. **Creates User Relationships**: Links shows, seasons, and episodes to the user
7. **Tracks Watch Status**: Records which episodes the user has watched

## Database Schema Mapping

| CSV Column | Database Table | Field | Notes |
|------------|----------------|-------|-------|
| `show` | `shows` | `title` | Creates new show if doesn't exist |
| `season` | `seasons` | `seasonNumber` | Creates season for the show |
| `number` | `episodes` | `episodeNumber` | Episode number within season |
| `name` | `episodes` | `title` | Episode title |
| `air_date` | `episodes` | `airDate` | Parsed as Date object |
| `watched` | `user_episodes` | `watched` | Boolean watch status |

## Error Handling

The script includes comprehensive error handling:

- **User Validation**: Ensures the specified user exists
- **File Validation**: Checks that the CSV file exists and is readable
- **Data Validation**: Skips invalid rows and logs warnings
- **Database Errors**: Handles constraint violations and connection issues
- **Graceful Shutdown**: Handles SIGINT/SIGTERM signals properly

## Output

The script provides detailed progress information:

```
🎬 Episode Tracker CSV Import Script
=====================================
✅ Found user: John Doe
📊 Reading CSV data...
📈 Found 7220 episodes
📺 Found 150 unique shows
🔄 Starting database import...
📺 Processing show: 1899
  📅 Processing season 1 (8 episodes)
📺 Processing show: 24
  📅 Processing season 1 (24 episodes)
📊 Import Summary:
  📺 Shows created: 150
  📅 Seasons created: 300
  🎬 Episodes created: 7220
  👤 User episodes created: 7220
✅ Import completed successfully!
```

## Troubleshooting

### Common Issues

1. **User not found**: Ensure the user ID is correct and the user exists in the database
2. **CSV file not found**: Check that `data.csv` is in the project root
3. **Database connection**: Ensure your database is running and accessible
4. **Permission errors**: Ensure the script has write permissions to the database
5. **No show posters**: If shows are imported without posters, check your TMDB API key configuration

### Getting User ID

To find a user ID, you can:

1. Use Prisma Studio: `npm run db:studio`
2. Query the database directly
3. Check the user registration logs

### Rollback

If you need to undo the import:

1. **Delete user relationships**: Remove records from `user_shows`, `user_seasons`, `user_episodes`
2. **Delete episodes**: Remove records from `episodes` 
3. **Delete seasons**: Remove records from `seasons`
4. **Delete shows**: Remove records from `shows`

⚠️ **Warning**: This will permanently delete all imported data!

## Development

The script is located at `scripts/import-csv-data.js` and can be modified to:

- Handle different CSV formats
- Add additional data validation
- Support bulk operations
- Add progress bars for large imports
- Export import logs

## Support

For issues or questions about the import script, check:

1. The console output for error messages
2. Database logs for constraint violations
3. The CSV file format matches the expected structure

---

# Show Poster Update Script

This script fetches poster URLs and metadata for shows that are already imported but don't have poster URLs or have minimal metadata.

## Usage

### Prerequisites

1. **TMDB API Key Required**: You must have a TMDB API key configured in your `.env` file
2. **Database Access**: Ensure your database is running and accessible

### Running the Script

#### Dry Run (Recommended First)
Preview which shows will be updated:
```bash
# For local development (outside Docker)
DATABASE_URL="postgresql://postgres:password@localhost:5440/episodetracker" npm run posters:update:dry

# For Docker environment
npm run posters:update:dry
```

#### Update Shows Without Posters
Update only shows that are missing posters or have minimal metadata:
```bash
# For local development (outside Docker)
DATABASE_URL="postgresql://postgres:password@localhost:5440/episodetracker" npm run posters:update

# For Docker environment
npm run posters:update
```

#### Force Update All Shows
Update all shows, even those that already have posters:
```bash
# For local development (outside Docker)
DATABASE_URL="postgresql://postgres:password@localhost:5440/episodetracker" npm run posters:force

# For Docker environment
npm run posters:force
```

### What the Script Does

1. **Finds Shows to Update**: Identifies shows that need poster/metadata updates
2. **Fetches TMDB Data**: Gets show information from The Movie Database API
3. **Updates Database**: Saves poster URLs, descriptions, genres, and other metadata
4. **Progress Reporting**: Shows detailed progress for each show

### Command Line Options

- `--dry-run` - Preview what would be updated without making changes
- `--force` - Update all shows, even those that already have posters

### Expected Output

```
🖼️  Show Poster Update Script
==============================
✅ TMDB API key found
📊 Found 45 shows that need poster updates:
  📺 1899 (ID: cmh2bim1d000072upoolswanz)
  📺 24 (ID: cmh2bim1d000072upoolswanz)
  📺 Adventure Time (ID: cmh2bim1d000072upoolswanz)

🔄 Updating "1899"...
  🔍 Fetching metadata for "1899"...
  ✅ Updated with poster: https://image.tmdb.org/t/p/w500/poster-path.jpg

📊 Update Summary:
  ✅ Successfully updated: 42 shows
  ❌ Failed to update: 3 shows
  📺 Total processed: 45 shows
```

### Troubleshooting

#### Common Issues

1. **TMDB API key not configured**: Ensure `TMDB_API_KEY` is set in your `.env` file
2. **API rate limits**: The script includes delays to respect API limits
3. **Show not found**: Some shows might not be found in TMDB database
4. **Network errors**: Check your internet connection and TMDB API status

#### Getting TMDB API Key

1. Visit [The Movie Database](https://www.themoviedb.org/settings/api)
2. Create a free account
3. Request an API key
4. Add it to your `.env` file: `TMDB_API_KEY=your-api-key-here`

### What Gets Updated

The script updates the following show fields:
- **Poster URL**: High-quality poster image
- **Overview**: Detailed show description
- **Status**: Current show status (airing/ended/canceled)
- **Genres**: Show genre tags
- **Network**: Broadcasting network
- **First Aired**: Original air date
- **Trakt ID**: TMDB show ID for future reference
