# BookTalks Mobile - Third-Party Integrations

**Last Updated:** 2024-02-14

---

## 1. Razorpay (Payment Processing)

### Overview

Razorpay handles refundable deposit payments (₹100-500) for book exchanges. Delivery costs are paid directly to Porter/Dunzo, NOT via Razorpay.

**SDK:** `react-native-razorpay`

**API Endpoint:** `https://api.razorpay.com/v1/`

**Authentication:** Basic Auth with Key ID and Key Secret

---

### Setup

**Test Mode:**
- Use test API keys for development
- Test cards provided by Razorpay (no real money charged)

**Production Mode:**
- Complete KYC verification
- Activate live API keys
- Configure webhook URL

**Environment Variables:**
- RZP_KEY_ID: Public key (safe to expose in client)
- RZP_KEY_SECRET: Secret key (server-side only, used in Edge Functions)

---

### Creating Payment Orders

**Process:**
1. Client calls Edge Function `create-payment-order` with transaction_id
2. Edge Function calculates deposit based on book condition
3. Edge Function creates Razorpay order via API
4. Client receives order ID and opens Razorpay checkout
5. User completes payment in Razorpay UI
6. Razorpay sends webhook to `verify-payment` Edge Function

**Order Metadata:**
- transaction_id: BookTalks transaction reference
- type: 'refundable_deposit'
- book_title: Book being borrowed

---

### Webhook Verification

**Security:** HMAC SHA256 signature verification (CRITICAL)

**Webhook Events:**
- payment.captured: Payment successful
- payment.failed: Payment failed
- refund.processed: Refund completed

**Verification Process:**
1. Extract signature from webhook header
2. Compute HMAC using webhook secret and payload
3. Compare computed signature with received signature
4. Only process webhook if signatures match

**Failure Handling:**
Log failed verifications and alert admin. Never process unverified webhooks.

---

### Refund Flow

**Trigger:** After successful delivery or dispute resolution

**Process:**
1. Call Edge Function `refund-deposit` with transaction_id
2. Edge Function calls Razorpay refund API
3. Refund processed within 5-7 business days
4. User receives refund to original payment method

**Refund Types:**
- Full refund: Entire deposit returned
- Partial refund: Deduction for damage/late return

---

### Test Cards

**Successful Payment:**
- Card: 4111 1111 1111 1111
- CVV: Any 3 digits
- Expiry: Any future date

**Failed Payment:**
- Card: 4000 0000 0000 0002

**UPI Test:**
- UPI ID: success@razorpay

---

## 2. Porter (Intra-City Delivery)

### Overview

Porter provides intra-city delivery services for book exchanges. Supports same-day and next-day delivery.

**API Endpoint:** `https://api.porter.in/v1/`

**Authentication:** API Key in header (`X-API-KEY`)

**Coverage:** Mumbai, Delhi, Bangalore, Hyderabad, Chennai, Pune, Kolkata

---

### Creating Delivery Orders

**Endpoint:** POST `/v1/orders/create`

**Required Fields:**
- pickup_address: Lender's address (from user_addresses)
- drop_address: Borrower's address
- pickup_contact: Lender's phone
- drop_contact: Borrower's phone
- item_description: "Book: [title]"
- item_weight: 0.5 kg (standard book weight)

**Vehicle Types:**
- Two-wheeler: For single book (₹40-60)
- Four-wheeler: For multiple books (₹80-120)

**Response:**
- order_id: Porter order reference
- awb_number: Tracking number
- tracking_url: Real-time tracking link
- estimated_cost: Delivery cost in ₹
- pickup_time: Scheduled pickup time

---

### Tracking Deliveries

**Webhook Events:**
- order_created: Order confirmed
- pickup_complete: Book picked up from lender
- in_transit: Delivery in progress
- delivered: Book delivered to borrower
- cancelled: Order cancelled

**Webhook URL:** Configure in Porter dashboard to point to `book-shipment` Edge Function

---

### Cost Estimation

**Endpoint:** POST `/v1/orders/estimate`

**Factors:**
- Distance between pickup and drop
- Vehicle type
- Time of day (surge pricing)
- Demand in area

**Typical Costs:**
- 0-5 km: ₹40-50
- 5-10 km: ₹60-80
- 10-15 km: ₹80-100

---

## 3. Dunzo (Intra-City Delivery)

### Overview

Dunzo provides alternative intra-city delivery option. Similar to Porter but with different coverage areas.

**API Endpoint:** `https://apis.dunzo.in/api/v1/`

**Authentication:** API Key + Client ID in headers

**Coverage:** Bangalore, Mumbai, Delhi, Pune, Chennai, Gurgaon

---

### Creating Delivery Tasks

**Endpoint:** POST `/api/v1/tasks`

**Required Fields:**
- pickup_details: Lender's address and contact
- drop_details: Borrower's address and contact
- task_type: 'package_delivery'
- package_details: Book description and weight

**Response:**
- task_id: Dunzo task reference
- tracking_number: Tracking number
- tracking_url: Real-time tracking link
- estimated_cost: Delivery cost in ₹

---

### Webhook Events

- task_created: Task confirmed
- runner_assigned: Delivery person assigned
- picked_up: Book picked up
- delivered: Book delivered
- cancelled: Task cancelled

---

## 4. Firebase Cloud Messaging (FCM)

### Overview

FCM handles push notifications for transaction updates, club messages, and wishlist matches.

**Integration:** Via `expo-notifications` wrapper

**Server Key:** Required for sending notifications from Edge Functions

---

### Notification Categories

**Transaction Updates:**
- Request received (lender)
- Request approved (borrower)
- Payment successful
- Book shipped
- Delivery confirmed

**Club Activity:**
- New message in club
- Reading milestone reached
- Event RSVP reminder

**Wishlist Matches:**
- Wishlisted book listed nearby

---

### Token Management

**Registration:**
1. Request notification permission on app launch
2. Get FCM token via expo-notifications
3. Store token in user_push_tokens table
4. Update token on refresh

**Cleanup:**
Remove token from database on logout or app uninstall.

---

### Sending Notifications

**From Edge Functions:**
Use FCM Admin SDK to send notifications with user's FCM token.

**Payload Structure:**
- title: Notification title
- body: Notification message
- data: Custom data (transaction_id, club_id, etc.)
- badge: Unread count

**Silent Notifications:**
For background credit balance updates (no user-visible notification).

---

## 5. Google Books API

### Overview

Fetches book metadata (title, authors, cover, ISBN) for library management.

**API Endpoint:** `https://www.googleapis.com/books/v1/volumes`

**Authentication:** API Key (optional, increases rate limit)

**Rate Limit:** 1000 requests/day (free tier)

---

### Search Books

**Endpoint:** GET `/volumes?q={query}`

**Query Parameters:**
- q: Search query (title, author, ISBN)
- maxResults: Number of results (default 10, max 40)
- startIndex: Pagination offset

**Response:**
Array of book objects with title, authors, cover URL, ISBN, description, page count, categories.

---

### Fetch Book Details

**Endpoint:** GET `/volumes/{google_books_id}`

**Usage:**
Fetch complete book details by Google Books ID for displaying in app.

---

### Fallback

If API rate limit exceeded or book not found, show manual entry form for users to input book details.

---

## 6. Google Maps API

### Overview

Provides geocoding and distance calculations for venue search and delivery cost estimation.

**API Endpoint:** `https://maps.googleapis.com/maps/api/`

**Authentication:** API Key

---

### Geocoding

**Endpoint:** GET `/geocode/json?address={address}`

**Usage:**
Convert user's address to latitude/longitude for storing in venues table (PostGIS).

---

### Distance Matrix

**Endpoint:** GET `/distancematrix/json?origins={origin}&destinations={destination}`

**Usage:**
Calculate distance between lender and borrower for delivery cost estimation and intra-city validation.

---

### Places Autocomplete

**Endpoint:** GET `/place/autocomplete/json?input={query}`

**Usage:**
Venue search autocomplete for finding cafes, libraries, bookstores.

---

## Related Documentation

- **[EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md)** - Edge Functions using these APIs
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - API key configuration
- **[API_REFERENCE.md](./API_REFERENCE.md)** - Frontend API usage

