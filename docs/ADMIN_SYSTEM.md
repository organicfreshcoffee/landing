# Admin System Setup and Usage

## Overview

The admin system allows designated users to manage game servers through a web interface. Admins can add, edit, and remove both official and third-party servers.

## Setup

### 1. Database Initialization

The admin system requires an `admins` collection in MongoDB. This is automatically created when you:

- Start the application (via `init-mongo.js`)
- Run database migrations (via `migration-db.js`)

### 2. Adding Admin Users

#### Method 1: Simple Usage (Recommended)
```bash
# Development - simple usage (will use .env file if present)
node scripts/add-admin.js your-email@example.com

# Production with custom MongoDB URI
MONGODB_URI=mongodb://user:pass@host:port/db node scripts/add-admin.js admin@example.com
```

#### Method 2: Using Flags  
```bash
# Using --email flag
node scripts/add-admin.js --email admin@example.com

# With environment variable
ADMIN_EMAIL=admin@example.com node scripts/add-admin.js
```

#### Method 3: Using .env File
Create a `.env` file in the project root with:
```bash
MONGODB_URI=mongodb://admin:password@localhost:27017/landing?authSource=admin
```
Then run:
```bash
node scripts/add-admin.js your-email@example.com
```

#### Method 4: Direct Database Insert
Connect to your MongoDB instance and run:
```javascript
db.admins.insertOne({
  email: "admin@example.com",
  created_at: new Date(),
  updated_at: new Date()
});
```

## Usage

### Accessing the Admin Panel

1. Log in to the application with an admin email address
2. Click the hamburger menu (☰) in the top right
3. Select "🔧 Admin Panel" from the dropdown
4. You'll be redirected to `/admin`

### Managing Servers

In the admin panel, you can:

- **Add New Servers**: Click "+ Add Server" and fill in the form
- **Edit Servers**: Click "Edit" next to any server
- **Delete Servers**: Click "Delete" (with confirmation)
- **Organize by Type**: Servers are automatically grouped into "Official" and "Third Party" sections

### Server Fields

- **Server Name**: Display name for the server
- **Server Address**: The actual server address/URL
- **Official Server**: Check if this is an official game server
- **Third Party Server**: Check if this is a community/third-party server

## Environment Configuration

### NODE_ENV in Staging

The staging environment correctly sets `NODE_ENV=staging` via:
- GitHub Actions deployment: `--set-env-vars NODE_ENV=staging`
- This affects server address selection in `init-mongo.js`

### Database Scripts Comparison

- **`init-mongo.js`**: Runs during MongoDB container startup, handles initial database setup
- **`migration-db.js`**: Standalone migration script for database updates, can be run via Docker
- **Both are needed**: Different purposes but both now create the admins collection

## API Endpoints

The admin system adds these endpoints:

- `GET /api/admin/check` - Check if current user is admin
- `GET /api/admin/servers` - Get all servers (admin only)
- `POST /api/admin/servers` - Add new server (admin only)
- `PUT /api/admin/servers/:id` - Update server (admin only)
- `DELETE /api/admin/servers/:id` - Delete server (admin only)

## Security

- All admin endpoints require Firebase authentication
- Additional middleware checks if the user's email exists in the `admins` collection
- Non-admin users cannot access admin functionality
- Admin status is checked on each request (no client-side only checks)

## Development

To test the admin functionality locally:

1. Start the development environment:
   ```bash
   docker-compose up
   ```

2. Add yourself as an admin:
   ```bash
   node scripts/add-admin.js your-email@example.com
   ```

3. Log in with your email and access the admin panel

## Production Deployment

When deploying to production:

1. Ensure the database migration has run (creates admins collection)
2. Add admin users via the script:
   ```bash
   MONGODB_URI=your-production-uri node scripts/add-admin.js admin@example.com
   ```
3. The admin functionality will be available to designated users
