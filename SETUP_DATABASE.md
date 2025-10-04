# Database Setup Instructions

The database schema and initial users are defined in `schema.sql`.

## To initialize the D1 database on Cloudflare:

```bash
# Apply the schema to your D1 database
wrangler d1 execute k9-vision-db --file=schema.sql
```

This will create:
- **Admin user**: username `admin36cg`, password `admin36cg`
- **Test client**: username `testclient`, password `test123`

## Database ID
Your D1 database ID is: `97b70e72-63b3-4196-8f07-e1f9e9e789bd`

## To verify users were created:

```bash
wrangler d1 execute k9-vision-db --command="SELECT username, role FROM users;"
```

## To reset the database (if needed):

```bash
wrangler d1 execute k9-vision-db --command="DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS clients; DROP TABLE IF EXISTS media; DROP TABLE IF EXISTS notes;"
wrangler d1 execute k9-vision-db --file=schema.sql
```
