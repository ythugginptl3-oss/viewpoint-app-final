# ViewPoint

ViewPoint is a modern social app for discovering, posting, rating, saving, and discussing hidden city lookout spots. It is built with Next.js, React, Firebase, Tailwind CSS, and Mapbox.

## What Works Now

- Google sign-in through Firebase Authentication
- Public user profiles created on first sign-in
- Follow and unfollow creators
- Live Firestore-backed lookout spots
- Add a new spot with city, vibe, category, latitude, longitude, and media
- Upload photos or short videos to Firebase Storage
- Save/favorite spots
- 1-5 star ratings with Firestore transactions
- Comment threads per spot
- Trending feed based on ratings, saves, and comments
- Search by city, creator, vibe, or category
- Mapbox-powered map when a token is provided
- Dark mobile-first responsive UI
- Demo mode when Firebase/Mapbox keys are missing

## Local Setup

1. Install Node.js from https://nodejs.org.
2. Open this folder in a terminal:

```bash
cd "C:\Users\sw_oc\OneDrive\Documents\Scenic Views"
```

3. Install dependencies:

```bash
npm install
```

4. Copy the example env file:

```bash
copy .env.example .env.local
```

5. Fill in `.env.local` with Firebase and Mapbox values.

6. Run the app:

```bash
npm run dev
```

7. Open http://localhost:3000.

## Firebase Setup

1. Go to https://console.firebase.google.com and create a Firebase project.
2. Register a web app in Project settings.
3. Copy the Firebase config values into `.env.local`.
4. In Firebase Authentication, enable Google sign-in.
5. In Firestore Database, create a database.
6. In Storage, create a storage bucket.
7. Add your local dev URL to Firebase Authentication authorized domains:

```text
localhost
```

8. After deploying, add your live Vercel domain too.

## Environment Variables

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=
```

The Mapbox token is public because it runs in the browser. Keep Firebase security rules strict because client-side Firebase apps are public by design.

## Mapbox Setup

1. Create a free Mapbox account at https://www.mapbox.com.
2. Copy your default public access token.
3. Put it in `.env.local` as `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`.
4. Restart the dev server.

Without a token, ViewPoint shows a styled fallback map so the app still works.

## Suggested Firestore Collections

The app writes to:

```text
users/{uid}
users/{uid}/saves/{spotId}
users/{uid}/following/{targetUserId}
users/{uid}/followers/{followerId}
spots/{spotId}
spots/{spotId}/comments/{commentId}
spots/{spotId}/ratings/{uid}
```

## Security Rules

This project includes starter rules:

```text
firestore.rules
storage.rules
firestore.indexes.json
```

To deploy them with Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase init firestore storage
firebase deploy --only firestore:rules,storage
```

Use these as a starting point. Before a serious public launch, add stricter validation for required fields, text lengths, file moderation, and rate limits.

## Deploy Online Free With Vercel

1. Create a GitHub repo.
2. Push this project to GitHub.
3. Go to https://vercel.com.
4. Import the GitHub repo.
5. In Vercel project settings, add all environment variables from `.env.example`.
6. Deploy.
7. Copy your live domain, usually like:

```text
https://your-project.vercel.app
```

8. Go back to Firebase Authentication settings and add that Vercel domain to authorized domains.

Every push to GitHub will create a fresh Vercel deployment.

## Real-World Accuracy Notes

For a real production version, keep ViewPoint's own user-submitted spot database, but improve accuracy with:

- Mapbox search/geocoding or Google Places autocomplete for city/place search
- Browser geolocation for "near me"
- Geohash queries using `geofire-common`
- User reporting/moderation for unsafe or private locations
- Admin approval for sensitive lookout spots
- Duplicate detection for nearby pins

Hidden scenic spots can create safety and privacy issues. Avoid encouraging trespassing, unsafe parking, private property access, or restricted locations.
