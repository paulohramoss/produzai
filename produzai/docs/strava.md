# Strava integration

## Local development

Use Vercel dev when testing the OAuth flow because the app depends on serverless routes under `/api/strava`.

```bash
npm run dev:vercel
```

The local callback URL is:

```txt
http://localhost:3000/api/strava/callback
```

## Production environment

Set these variables in Vercel:

```txt
STRAVA_CLIENT_ID=229036
STRAVA_CLIENT_SECRET=<Strava client secret>
STRAVA_APP_URL=https://productester.vercel.app
STRAVA_SCOPES=read,activity:read
STRAVA_COOKIE_SECRET=<random secret with at least 32 bytes>
```

Do not expose `STRAVA_CLIENT_SECRET`, access tokens, or refresh tokens with the `VITE_` prefix.

## Strava app settings

In the Strava API app settings:

```txt
Site: https://productester.vercel.app/
Authorization callback domain: productester.vercel.app
```

The app currently requests `read,activity:read`, which is enough to read visible activities for the connected athlete. Use `activity:read_all` only if the product must read private activities.

## Important Strava limit

The Strava dashboard currently shows that only 1 athlete can connect to this API app. The code is ready for multiple browser users, but Strava must approve/increase the athlete limit before multiple real customers can connect their own accounts.
