# HousinGo — Project Documentation

Version: 1.0.0 (Beta)  
Last updated: 2025-11-18

---

## Table of Contents
- Overview
- Files in this repo
- Setup & Local development
- Data model (Supabase tables)
- Runtime architecture & responsibilities
- Key UI flows
- Main functions / API reference (index.js)
- Messaging & notifications
- Image uploads
- Security & deployment notes
- Troubleshooting & common errors
- Next steps / Refactor suggestions

---

## Overview
HousinGo is a single-page frontend application (vanilla JS + Supabase + optional GetStream) for listing, browsing, applying to rental properties and for messaging between tenants, landlords, and admins. The project currently lives in three files:
- `index.html` — UI markup and page sections
- `index.js` — application logic (single large file, well-commented)
- `style.css` — styling and responsive rules

This document explains responsibilities, how to run locally, data schema, and the major functions in `index.js`.

---

## Files in this repo
- index.html — entry HTML that includes UI sections (home, browse, dashboards, modals).
- index.js — main JS file. Contains:
  - configuration (Supabase URL/key, branding)
  - global state caches (properties, amenities, images)
  - authentication logic
  - property management (load, display, post, edit)
  - UI navigation and modals
  - messaging (GetStream + Supabase fallback)
  - notifications
  - admin flows (user/property management)
- style.css — all styling and responsive rules.

---

## Setup & Local development
1. Clone the folder or open in VS Code.
2. Open `index.js` and confirm `SUPABASE_URL` and `SUPABASE_KEY` are set for your Supabase project (for dev only).
3. Serve files locally to avoid CORS issues:
   - Python:
     python -m http.server 8000
   - Node:
     npx http-server
4. Open http://localhost:8000 in browser.
5. (Optional) Create Supabase tables (see Data model).

---

## Data model (tables to create in Supabase)
Run the SQL below in Supabase SQL editor (already provided in README). Core tables:
- users (user_id, first_name, last_name, email, password, mobile, role, status, created_at)
- properties (property_id, landlord_id, property_name, type, monthly_rent, address, city, barangay, availability, status, created_at, ...)
- property_images (image_id, property_id, image_url, created_at)
- amenities (amenity_id, property_id, amenity_name, is_included)
- property_applicants (applicant_id, tenant_id, property_id, message, status, application_date)
- messages (message_id, sender_id, receiver_id, content, is_read, sent_at, stream_message_id)
- notifications (notif_id, user_id, title, message, is_read, sent_at)

(See README for full SQL).

---

## Runtime architecture & responsibilities
index.js is organized (with Doxygen-style comments) into sections:
- Configuration & constants — Supabase client and branding
- Global state — cached arrays for properties, images, amenities, current user, messaging state
- Helpers — getTimeAgo, showToast, UI helpers
- Auth — checkAuthState(), login/register/logout, updateNavForLoggedInUser
- Properties — loadProperties(), displayProperties(), showPropertyDetails(), applyForProperty(), handlePostProperty()
- UI — showPage(), hamburger logic, modals open/close handlers
- Messaging — initializeMessaging(), startMessagePolling(), GetStream handlers, displayMessages
- Notifications — createNotification(), notifyAllAdmins(), loadNotificationCount(), displayNotifications
- Admin — loadAdminDashboard(), displayUserManagement(), displayPropertyManagement(), user/property actions

This mapping helps when you later split file into modules.

---

## Key UI flows

1. Home / Browse
   - index.html has hero search; `performHeroSearch()` redirects to browse page and applies filters.
   - `loadProperties()` fetches approved + available properties and populates the home grid.

2. Property details & apply
   - Click card -> `showPropertyDetails(property)` opens modal with carousel and Apply button.
   - Apply triggers `applyForProperty(propertyId)` which creates a property_applicants record and notifications.

3. Post property (landlord)
   - Landlords use `post-property` form; handled by `handlePostProperty(event)` which uploads images (ImgBB) and inserts property, amenities and images records into Supabase.

4. Messaging
   - Real-time via GetStream when configured; otherwise polls Supabase (`startMessagePolling()`).
   - Conversations shown in messages modal; new message creation via `startNewConversation()`.

5. Admin dashboard
   - `loadAdminDashboard()` loads users and properties; management features available: approve/reject property, reset password, toggle user status.

---

## Main functions / API reference (quick)
Only key functions listed; most have Doxygen comments in `index.js`.

- Configuration
  - supabase (client) — created using SUPABASE_URL / SUPABASE_KEY

- Auth
  - checkAuthState() — read localStorage, set currentUser, init messaging
  - handleLogin(event) — login via users table (dev)
  - handleRegister(event) — register new user
  - logout() — clear session, stop poll/stream

- Properties
  - loadProperties() — fetch properties, amenities, images; update caches; render
  - displayProperties(properties, isHomePage=true) — render grid of cards
  - showPropertyDetails(property) — open modal with full info + carousel
  - applyForProperty(propertyId) — create application record + notifications
  - handlePostProperty(event) — create/update property and upload images

- UI
  - showPage(pageName) — hide/show app pages
  - showToast(message) — transient on-screen notification
  - toggleFAQ(elem) — expand/collapse FAQ

- Messaging & Notifications
  - initializeMessaging() — setup GetStream client (if configured)
  - startMessagePolling() / stopMessagePolling() — polling fallback
  - createNotification(userId, title, message) — insert notification record
  - notifyAllAdmins(title, message) — create notifications for admin users

- Admin
  - loadAdminDashboard(), displayUserManagement(), displayPropertyManagement()
  - approveProperty(propertyId), rejectProperty(propertyId), suspendProperty(propertyId)
  - resetUserPassword(), toggleUserStatus()

---

## Messaging & notifications (details)
- Primary real-time channel: GetStream Chat SDK (optional). If not configured, code uses periodic polling of `messages` table.
- Notifications are stored in the `notifications` table. UI shows badge and a modal. Browser native notifications used when permission is granted.
- Avoid duplicate toasts by tracking notified message IDs (`notifiedMessageIds` set).

---

## Image uploads
- Client uploads images to ImgBB via `uploadImageToImgBB(file)` which uses an ImgBB API key in `index.js`.
- Uploaded image URLs are saved into `property_images` table.

---

## Security & deployment notes
Important for production:
- Do NOT expose SUPABASE_KEY in client; move keys to server-side or use Supabase Auth for sign-in and RLS policies.
- Do NOT store plain text passwords in DB. Use proper authentication (Supabase Auth) and hashed passwords if using custom auth.
- Validate and sanitize all user inputs server-side.
- Use HTTPS and proper CORS configuration.
- Remove development debug logs before deploying.

---

## Troubleshooting & common errors
- Blank property list:
  - Confirm `properties` table has entries with status = 'Approved' and availability = 'Available'.
  - Check Supabase URL/KEY and network console for 401/403.

- Image upload failing:
  - Verify ImgBB API key and response body in network tab.

- Messaging not real-time:
  - Ensure GetStream keys configured and `streamClient` initialization runs after login.
  - Otherwise polling should fetch messages; check console logs for polling startup.

- Modals or DOM errors:
  - Open browser console for uncaught exceptions referencing missing element IDs; ensure HTML elements exist.

---

## Next steps / refactor suggestions
- Split `index.js` into modules (api, auth, properties, ui, messaging, notifications) under `src/js/`.
- Move all secrets to environment variables and server endpoints.
- Replace custom auth with Supabase Auth and use RLS (Row Level Security).
- Add unit tests (Jest + jsdom) for utility functions.
- Implement server-side functions for image uploads or secure proxy.

---

## Where to find more
- Full inline documentation and Doxygen-style comments are already placed inside `index.js`. Use that as authoritative reference.
- README.md in project root contains installation SQL and details.

