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
| `/route-planner` | Route Planner | Interactive SVG map, waypoints, traffic comparison, saved routes |

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

### 3. Internationalization (i18n)
- 6 languages: English, Hindi (हिन्दी), Tamil (தமிழ்), Telugu (తెలుగు), Kannada (ಕನ್ನಡ), Malayalam (മലയാളം)
- Language selector in navbar dropdown
- Persists to localStorage across sessions
- Fallback to English for missing keys
- **No page reload** — signal-based instant switch

### 4. Interactive Route Planner
- City autocomplete for origin + destination
- Add up to 3 stopovers (waypoints)
- Animated SVG route map with live bus movement
- Real-time traffic: light / moderate / heavy
- 3 route options with distance, time, fare comparison
- Sort by: fastest, cheapest, least traffic
- Save routes to localStorage for quick reuse
- Dynamic traffic alerts (simulated)
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

## 🔌 API Endpoints

```
GET  /api/buses/search?from=&to=&date=
GET  /api/buses/:id
POST /api/bookings
GET  /api/bookings/pnr/:pnr
PUT  /api/bookings/:id/cancel
POST /api/auth/register
POST /api/auth/login
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
| Map | SVG (no external map API required) |
