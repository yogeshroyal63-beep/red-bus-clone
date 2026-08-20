# 🚌 redBus Clone — Full MEAN Stack

A production-grade clone of RedBus with every feature from the spec.

## Status
All 6 required feature tasks are implemented and audited end-to-end:
community/UGC, notifications, i18n (6 languages), route planner, dark mode,
and post-journey reviews. Authenticated flows (reviews, community, bookings,
notification prefs) require a real logged-in account — see `/login`.

## 🏗️ Pages & Features

| Route | Page | Features |
|-------|------|---------|
| `/` | Homepage | Search widget, city autocomplete, swap, recent searches, offers, popular routes, testimonials, app download |
| `/search` | Bus Results | Filter sidebar (time/type/amenities/price/rating), 5 sort options, loading skeletons, urgency badges |
| `/seats/:id` | Seat Selection | Interactive seat map, boarding/dropping points, price summary, **ratings & reviews** |
| `/confirm` | Booking | Passenger form, coupon codes, payment methods, animated confirmation + PNR |
| `/my-bookings` | My Trips | Upcoming/completed/cancelled tabs, cancel, download ticket |
| `/offers` | Offers | Category-filtered promo cards, copy-code |
| `/track` | Bus Tracking | Animated map, live location simulation, stops timeline |
| `/notifications` | Notifications | Multi-channel feed, preferences panel, delivery status |
| `/community` | Community | Posts, likes, comments, forums, trending tags, top contributors |
| `/route-planner` | Route Planner | Interactive Leaflet/OSM map, waypoints, live traffic comparison, saved routes |

## ✅ All 6 Spec Features Implemented

### 1. Community & UGC
- Create posts (stories, tips, questions, photos)
- Like, comment, share posts
- **Verified user** gate on posting
- Report/moderate posts (auto-hides at 5 reports)
- Pinned posts, trusted reviewer badges
- Forum categories, trending tags, top contributors leaderboard
- Social share (copies shareable link)

### 2. Notifications System
- 6 notification types: booking, cancellation, reminder, offer, schedule change, community
- 3 delivery channels: push, email, SMS
- Per-type and per-channel preference toggles with instant preview
- Delivery status: delivered / pending / failed
- Unread count badge on navbar bell
- Mark all read, delete individual
- Full notification history
- Automatic retry with exponential backoff for failed deliveries (up to 3 attempts per channel, each attempt logged)

### 3. Internationalization (i18n)
- 6 languages: English, Hindi (हिन्दी), Tamil (தமிழ்), Telugu (తెలుగు), Kannada (ಕನ್ನಡ), Malayalam (മലയാളം)
- Language selector in navbar dropdown
- Persists to localStorage across sessions
- Fallback to English for missing keys
- **No page reload** — signal-based instant switch

### 4. Interactive Route Planner
- City autocomplete for origin + destination
- Add up to 3 stopovers (waypoints)
- Real map rendering via Leaflet + OpenStreetMap tiles, with live road-following routes from OSRM and geocoding via Nominatim (falls back to a straight line, clearly disclosed, if OSRM is unreachable)
- Real-time traffic via TomTom's Traffic Flow API when `TRAFFIC_API_KEY` is set, otherwise a clearly-labeled simulation (`source: 'simulated'` vs `'tomtom'` in the API response)
- 3 route options with distance, time, fare comparison
- Sort by: fastest, cheapest, least traffic
- Save routes to localStorage for quick reuse
- Dynamic traffic alerts
- Alternative route display

### 5. Dark Mode
- Full light/dark theme with CSS custom properties
- Toggle in navbar (sun/moon icon + label)
- Instant preview — no page reload (Angular signals)
- Persists to localStorage
- Graceful fallback to light if no preference
- All 10 pages and every component themed

### 6. Ratings & Reviews
- Star picker (1–5) with hover preview and labels
- Minimum 50-character requirement with live feedback
- **One review per user per bus** enforcement
- Edit within 24-hour window only
- Helpful upvotes with toggle
- Report → auto-hide at 3 reports
- Verified account gate
- Trusted reviewer badge (top upvote earners)
- Average rating bar chart breakdown
- Integrated into seat selection page

## 🚀 Run It

```bash
# Frontend
npm install
ng serve          # → http://localhost:4200

# Backend (optional — frontend has full mock data)
cd server
npm install
npm start         # → http://localhost:3000
```

### Seeding real data into MongoDB

If `MONGODB_URI` is set (see `.env.example`), the backend queries the real `buses`
collection instead of its in-memory fallback — and returns real results only once
that collection actually has documents in it. To populate it:

```bash
cd server
npm install
npm run seed      # inserts the app's curated bus data (see routes/buses.js) into MongoDB
```

Safe to re-run — it only replaces the buses it previously seeded, by id, rather than
wiping the whole collection. Without `MONGODB_URI` set, or without running the seed
step, the backend still works — it transparently falls back to the same in-memory
mock data the frontend uses on its own.

## 🔌 API Endpoints

```
Auth
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
PUT  /api/auth/me/preferences
POST /api/auth/logout

Buses
GET  /api/buses/search?from=&to=&date=
GET  /api/buses/:id
GET  /api/buses/
POST /api/buses/                              (admin)

Seats
POST   /api/seats/lock
DELETE /api/seats/lock
GET    /api/seats/:busId/availability

Bookings
POST /api/bookings/
GET  /api/bookings/pnr/:pnr/track
GET  /api/bookings/pnr/:pnr
GET  /api/bookings/my
PUT  /api/bookings/:id/cancel

Reviews
GET  /api/reviews/:busId
POST /api/reviews/
PUT  /api/reviews/:id
POST /api/reviews/:id/helpful
POST /api/reviews/:id/report
GET  /api/reviews/moderation/queue           (admin)
POST /api/reviews/:id/moderate               (admin)

Community
GET  /api/community/posts
POST /api/community/posts
POST /api/community/posts/:id/like
POST /api/community/posts/:id/comments
POST /api/community/posts/:postId/comments/:commentId/like
POST /api/community/posts/:id/report
GET  /api/community/moderation/queue          (admin)
POST /api/community/posts/:id/moderate        (admin)
GET  /api/community/forums

Notifications
POST /api/notifications/send
GET  /api/notifications/log                   (admin)
GET  /api/notifications/history
PUT  /api/notifications/history

Traffic
GET  /api/traffic/flow?lat=&lng=

GET  /api/health
```

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Angular 17.3 + signals |
| Styling | SCSS + CSS custom properties (dark mode) |
| State | Angular signals (zero NgRx needed) |
| i18n | Custom signal-based service (6 languages) |
| Backend | Express 4.19 + MongoDB/Mongoose |
| Icons | Font Awesome 6.5 |
| Map & Routing | Leaflet + OpenStreetMap tiles, OSRM (routing), Nominatim (geocoding), TomTom Traffic Flow API (optional live traffic) |
