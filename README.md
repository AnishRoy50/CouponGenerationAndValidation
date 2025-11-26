# Coupon Generation and Validation System

Production-ready microservice for coupon management with Node.js, TypeScript, and PostgreSQL. Supports user-specific and time-specific coupons with comprehensive validation and async logging.

## Performance
- **Response Time**: <100ms average (93ms tested with 1M users, 5K coupons)
- **Throughput**: 637 req/s
- **Async Logging**: Non-blocking batch inserts (100 records or 5s)

## Quick Start

```bash
npm install
npm run migrate     # Setup database
npm run seed        # Generate 1M users + 5K coupons (optional, for testing)
npm run dev         # Start server
npm run benchmark   # Test performance (optional)
```

**Environment**: Copy `.env` and set `DB_PASSWORD`

## Features

### Coupon Types
1. **User-Specific**: Single-use, tied to individual users
2. **Time-Specific**: Valid within date range, configurable usage limits

### Capabilities
- Percentage or fixed discounts with maximum caps
- Minimum order value requirements
- Usage tracking with audit trail (IP, user agent, timestamps)
- Automatic status management (active → expired/exhausted)
- Transaction-safe validation (ACID compliance)
- Async validation logging (zero performance impact)

## Architecture

**Stack**: Node.js, TypeScript, Express, PostgreSQL, Joi, Winston  
**Pattern**: Layered (Routes → Services → Database)  
**Security**: Helmet, CORS, parameterized queries, input validation

### Structure
```
src/
├── routes/          # API endpoints
├── services/        # Business logic (coupon, validation, async logging)
├── database/        # Connection pool, migrations
├── middleware/      # Error handling, logging
├── validators/      # Joi schemas
└── utils/           # Helpers, logger

database/
├── schema.sql       # Tables: coupons, coupon_usage, validation_logs
└── migrations/      # Performance indexes, schema updates
```

### Database
**Tables**: `coupons`, `coupon_usage`, `validation_logs`  
**Indexes**: Composite on `(code, status, type)`, partial unique on `order_id`  
**Constraints**: CHECK for date ranges, user validation

## API Endpoints

**Base**: `http://localhost:3000/api/coupons`

### 1. Create User-Specific Coupon
```http
POST /api/coupons/user-specific
```

**Request Body:**
```json
{
  "userId": "user123",
  "discountType": "percentage",
  "discountValue": 20,
  "maxDiscountAmount": 50,
  "minOrderValue": 100,
  "description": "Welcome bonus for new user",
  "createdBy": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "code": "USER-ABC123XYZ",
    "type": "user_specific",
    "discountType": "percentage",
    "discountValue": 20,
    "maxDiscountAmount": 50,
    "minOrderValue": 100,
    "userId": "user123",
    "status": "active",
    "createdAt": "2025-11-26T10:00:00Z"
  },
  "message": "User-specific coupon created successfully"
}
```

### 2. Create Time-Specific Coupon
```http
POST /api/coupons/time-specific
```

**Request Body:**
```json
{
  "code": "SUMMER2025",
  "discountType": "fixed",
  "discountValue": 25,
  "minOrderValue": 200,
  "description": "Summer sale 2025",
  "validFrom": "2025-06-01T00:00:00Z",
  "validUntil": "2025-08-31T23:59:59Z",
  "maxUsesPerUser": 3,
  "maxTotalUses": 10000,
  "createdBy": "marketing"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "code": "SUMMER2025",
    "type": "time_specific",
    "discountType": "fixed",
    "discountValue": 25,
    "minOrderValue": 200,
    "validFrom": "2025-06-01T00:00:00Z",
    "validUntil": "2025-08-31T23:59:59Z",
    "maxUsesPerUser": 3,
    "maxTotalUses": 10000,
    "currentTotalUses": 0,
    "status": "active",
    "createdAt": "2025-11-26T10:00:00Z"
  },
  "message": "Time-specific coupon created successfully"
}
```

### 3. Validate and Apply Coupon
```http
POST /api/coupons/validate
```

**Request Body:**
```json
{
  "code": "SUMMER2025",
  "userId": "user123",
  "orderId": "order456",
  "orderValue": 300
}
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "coupon": { /* coupon details */ },
    "discountAmount": 25,
    "finalAmount": 275
  },
  "message": "Coupon applied successfully"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Coupon has expired or is not yet valid"
}
```

### Other Endpoints
- `GET /api/coupons/:code` - Get coupon details
- `GET /api/coupons/user/:userId` - Get user's coupons
- `GET /api/coupons/active/time-specific` - List active time coupons
- `GET /api/coupons/:couponId/usage-history` - Coupon usage logs
- `GET /api/coupons/user/:userId/usage-history` - User usage logs
- `GET /health` - Health check + async log queue status

## Setup

### Prerequisites
- Node.js v18+
- PostgreSQL v14+

### Installation
```bash
# 1. Install dependencies
npm install

# 2. Configure .env (set DB_PASSWORD)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=shopup
DB_USER=postgres
DB_PASSWORD=your_password

# 3. Create database & run migrations
psql -U postgres -c "CREATE DATABASE shopup;"
npm run migrate

# 4. Start server
npm run dev
```

### Test
```bash
curl http://localhost:3000/health
```

## Performance Testing

```bash
# Seed 1M users + 5K coupons (takes ~10s)
npm run seed

# Run benchmark (1K requests, 100 concurrent)
npm run benchmark
```

**Results**: 93ms avg, 637 req/s, P95: 293ms

## Validation Pipeline

1. Coupon exists & active
2. Minimum order value met
3. Order hasn't used coupon (via `order_id`)
4. User-specific: Belongs to user, single-use
5. Time-specific: Valid date range, usage limits
6. Discount calculation with caps
7. Transaction: Record usage → Update count → Check exhaustion
8. Async log (non-blocking)

## Error Handling
- **400**: Invalid request/validation failure
- **404**: Resource not found
- **500**: Server error

```json
{"success": false, "error": "Error message"}
```

## License
MIT

