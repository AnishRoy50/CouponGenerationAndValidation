# Coupon Generation and Validation System

A robust, enterprise-grade microservice for coupon generation and validation built with Node.js, TypeScript, and PostgreSQL. This system supports multiple coupon types with comprehensive validation logic and usage tracking.

## Technical Philosophy & Design Decisions

### Why This Architecture?

This system was built with production readiness and maintainability as core principles. Every architectural decision was made to balance:
- **Type Safety**: TypeScript eliminates entire categories of runtime errors
- **Separation of Concerns**: Clean layered architecture makes the codebase maintainable and testable
- **Transaction Safety**: Financial operations demand ACID compliance
- **Performance**: Connection pooling and indexed queries ensure scalability
- **Security**: Multiple validation layers and parameterized queries prevent common vulnerabilities

### Key Implementation Choices

**1. TypeScript Over JavaScript**
- Compile-time type checking catches errors before deployment
- Enhanced IDE support with autocomplete and refactoring tools
- Self-documenting code through interfaces and type definitions
- Easier onboarding for new developers

**2. PostgreSQL Over NoSQL**
- Coupon validation requires ACID transactions (atomicity, consistency, isolation, durability)
- Complex queries with joins and aggregations are natural in SQL
- Strong constraints enforce business rules at the database level
- Proven reliability for financial data

**3. Layered Service Architecture**
- **Routes Layer**: HTTP concerns (request/response handling)
- **Service Layer**: Business logic (coupon generation, validation rules)
- **Database Layer**: Data access (connection pooling, query execution)
- **Middleware Layer**: Cross-cutting concerns (logging, error handling, validation)

This separation means each layer can be tested, modified, or replaced independently.

**4. Transaction-Based Validation**
- Coupon validation involves multiple operations (check validity, record usage, update counts)
- PostgreSQL transactions ensure all-or-nothing execution
- Prevents race conditions in high-concurrency scenarios
- Maintains data consistency even under load

**5. Comprehensive Validation Pipeline**
- Input validation (Joi schemas) prevents malformed requests
- Business rule validation (minimum order, usage limits) enforces policies
- Database constraints provide final safety net
- Layered approach catches errors at the earliest possible point

### Implementation Highlights

**Unique Coupon Code Generation**
```typescript
// Time-based + random for collision resistance
const timestamp = Date.now().toString(36).toUpperCase();
const random = Math.random().toString(36).substring(2, 8).toUpperCase();
```
This approach ensures codes are unique without database lookups, improving performance.

**Discount Calculation with Caps**
```typescript
if (discountType === 'percentage') {
  discount = (orderValue * discountValue) / 100;
  if (maxDiscountAmount && discount > maxDiscountAmount) {
    discount = maxDiscountAmount; // Protect margins
  }
}
```
Percentage discounts need caps to prevent excessive losses on high-value orders.

**Usage Tracking with Audit Trail**
Every coupon redemption records:
- User ID (who used it)
- Order ID (prevents reuse)
- Discount applied (for analytics)
- IP address & user agent (fraud detection)
- Timestamp (temporal analysis)

**Status Management**
Coupons automatically transition through states:
- `active` → `expired` (time passes validUntil)
- `active` → `exhausted` (reaches maxTotalUses)
- Single-source-of-truth in database, no cache invalidation issues

## Features

### 🎫 Coupon Types

1. **User-Specific Coupons**
   - Uniquely tied to individual users
   - Single-use per user
   - Auto-generated unique codes
   - Perfect for personalized promotions

2. **Time-Specific Coupons**
   - Valid within predefined time periods
   - Configurable usage limits per user
   - Optional global usage limits
   - Ideal for seasonal campaigns and flash sales

### ✨ Key Capabilities

- **Flexible Discount Types**: Percentage-based or fixed amount discounts
- **Smart Validation**: Multi-layered validation with comprehensive checks
- **Usage Tracking**: Complete audit trail of all coupon redemptions
- **Automatic Status Management**: Auto-expiration and exhaustion detection
- **Minimum Order Value**: Configurable minimum purchase requirements
- **Maximum Discount Caps**: Control discount limits for percentage-based coupons
- **Concurrent Safety**: Transaction-based operations for data consistency

## Technical Architecture

### Tech Stack Rationale

**Node.js + TypeScript**
- Excellent async I/O performance for handling concurrent API requests
- TypeScript provides compile-time type safety, catching errors before runtime
- Large ecosystem with mature libraries for all our needs
- JavaScript familiarity reduces learning curve

**Express.js Framework**
- Minimal, flexible, and battle-tested for production
- Middleware architecture perfect for our layered approach
- Excellent community support and documentation
- Easy to add features like rate limiting or caching later

**PostgreSQL Database**
- ACID transactions essential for financial operations (coupon redemptions)
- Strong type system and constraints enforce data integrity
- Complex queries with joins are natural and performant
- Advanced features like partial indexes and check constraints
- Row-level locking prevents race conditions

**Joi Validation**
- Declarative schema definition is readable and maintainable
- Comprehensive validation rules out of the box
- Clear error messages help API consumers
- Type inference works seamlessly with TypeScript

**Winston Logging**
- Structured JSON logs enable easy parsing and analysis
- Multiple transports (console, file) for different environments
- Log levels allow filtering in production
- Async logging doesn't block request processing

**Security Stack (Helmet + CORS)**
- Helmet sets security headers (XSS protection, content policy, etc.)
- CORS configured to control cross-origin access
- Parameterized queries prevent SQL injection
- Input validation stops malicious payloads

### Project Structure & Implementation

```
CouponGenerationAndValidationSystem/
├── src/
│   ├── index.ts                     # Application entry point
│   │                                # - Express app setup & middleware registration
│   │                                # - Route mounting, error handlers
│   │                                # - Graceful shutdown (SIGTERM/SIGINT)
│   │
│   ├── config/                      # Configuration layer
│   │   └── index.ts                 # Loads & validates .env, exports typed config
│   │
│   ├── database/                    # Data access layer
│   │   ├── index.ts                 # Singleton connection pool (pg.Pool)
│   │   │                            # Query methods with logging
│   │   │                            # Transaction support for atomic operations
│   │   └── migrations/
│   │       └── run-migrations.ts    # Reads & executes schema.sql
│   │
│   ├── middleware/                  # Cross-cutting concerns
│   │   ├── error.middleware.ts      # Global error handler, validation wrapper
│   │   │                            # asyncHandler for clean async/await
│   │   └── logger.middleware.ts     # HTTP request/response logging
│   │
│   ├── routes/                      # HTTP interface
│   │   └── coupon.routes.ts         # 8 REST endpoints with Express Router
│   │                                # Validation → Controller → Service
│   │
│   ├── services/                    # Business logic (core domain)
│   │   ├── coupon.service.ts        # Coupon lifecycle management
│   │   │                            # - Code generation algorithms
│   │   │                            # - CRUD operations
│   │   │                            # - Status transitions
│   │   │
│   │   └── validation.service.ts    # Validation engine
│   │                                # - 12-step validation pipeline
│   │                                # - Discount calculation with caps
│   │                                # - Usage recording in transactions
│   │
│   ├── types/                       # Type system
│   │   └── index.ts                 # Interfaces, enums, DTOs
│   │                                # Single source of truth for types
│   │
│   ├── utils/                       # Shared utilities
│   │   ├── helpers.ts               # Pure functions: discount calc, date checks
│   │   │                            # Code generation (timestamp + random)
│   │   └── logger.ts                # Winston setup (console + file transports)
│   │
│   └── validators/                  # Input validation
│       └── coupon.validator.ts      # Joi schemas for request bodies
│                                    # Declarative validation rules
│
├── database/
│   ├── schema.sql                   # PostgreSQL schema (production-ready)
│   │                                # - Custom types (enums)
│   │                                # - Tables with constraints
│   │                                # - Indexes for performance
│   │                                # - Triggers for auto-updates
│   │                                # - View for analytics
│   └── setup.sql                    # Database creation helper
│
├── dist/                            # Build output (npm run build)
│   └── [compiled .js + .d.ts]       # TypeScript → JavaScript
│
├── logs/                            # Runtime logs
│   ├── combined.log                 # All logs
│   └── error.log                    # Errors only
│
├── .env                             # Environment config (gitignored)
├── package.json                     # Dependencies & scripts
└── tsconfig.json                    # TypeScript strict mode
```

**Key Implementation Concepts:**

1. **Layered Architecture**: Each layer has a single responsibility
   - Routes: HTTP → Service calls
   - Services: Business rules → Database operations
   - Database: Connection management → Query execution

2. **Type Safety Throughout**: No `any` types in business logic
   - Database rows → Typed interfaces
   - Request/response → DTOs
   - Compile-time guarantees prevent runtime errors

3. **Error Handling Strategy**:
   - Service layer throws domain errors
   - Middleware catches and formats for HTTP
   - Database errors logged with full context
   - Users see friendly messages, logs show details

4. **Transaction Patterns**:
   - Coupon validation wraps 3 operations in transaction
   - Insert usage → Update count → Check exhaustion
   - All-or-nothing ensures data consistency

5. **Singleton Database Pool**:
   - One connection pool for entire application
   - Configured max connections prevents DB overload
   - Automatic reconnection on connection loss

### Database Schema Design

#### Coupons Table - The Heart of the System
```sql
CREATE TABLE coupons (
    id UUID PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,        -- Fast lookups via index
    type coupon_type NOT NULL,                -- Enum: user_specific | time_specific
    discount_type VARCHAR(20) NOT NULL,       -- 'percentage' | 'fixed'
    discount_value DECIMAL(10, 2) NOT NULL,
    max_discount_amount DECIMAL(10, 2),       -- Cap for percentage discounts
    min_order_value DECIMAL(10, 2) DEFAULT 0,
    user_id VARCHAR(100),                     -- Required for user_specific
    valid_from TIMESTAMP,                     -- Required for time_specific
    valid_until TIMESTAMP,
    max_uses_per_user INTEGER,
    max_total_uses INTEGER,
    current_total_uses INTEGER DEFAULT 0,     -- Incremented atomically
    status coupon_status DEFAULT 'active',    -- Enum for type safety
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Check constraints enforce business rules at DB level
    CONSTRAINT valid_date_range CHECK (...),
    CONSTRAINT user_specific_has_user CHECK (...)
);
```

**Design Decisions:**
- `UUID` for ids: No collision risk, distributed-system ready
- `UNIQUE` on code: Database-enforced uniqueness
- `CHECK` constraints: Business rules can't be bypassed
- `DECIMAL` for money: Exact precision (no floating point errors)
- Enums as custom types: Type-safe, stored efficiently

#### Coupon Usage Table - Complete Audit Trail
```sql
CREATE TABLE coupon_usage (
    id UUID PRIMARY KEY,
    coupon_id UUID REFERENCES coupons(id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL,
    order_id VARCHAR(100) UNIQUE,              -- Prevents duplicate redemption
    order_value DECIMAL(10, 2) NOT NULL,
    discount_applied DECIMAL(10, 2) NOT NULL,  -- Calculated discount
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),                    -- IPv4/IPv6 support
    user_agent TEXT                            -- For fraud detection
);
```

**Why This Design:**
- Every redemption is immutable (insert-only, never updated)
- `order_id UNIQUE` prevents using multiple coupons on same order
- Audit fields (IP, user agent) enable fraud analysis
- Foreign key with CASCADE cleans up orphaned records

#### Indexes for Performance
```sql
CREATE INDEX idx_coupons_code ON coupons(code);                    -- O(log n) code lookups
CREATE INDEX idx_coupon_usage_coupon_user ON coupon_usage(coupon_id, user_id);  -- Fast usage counts
```

**Query Optimization:**
- Code lookups: Single index scan (milliseconds)
- Usage counting: Composite index avoids table scan
- Partial indexes on status: Only index active coupons

## API Documentation

### Base URL
```
http://localhost:3000/api/coupons
```

### Endpoints

#### 1. Create User-Specific Coupon
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

#### 2. Create Time-Specific Coupon
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

#### 3. Validate and Apply Coupon
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

#### 4. Get Coupon by Code
```http
GET /api/coupons/:code
```

**Response:**
```json
{
  "success": true,
  "data": { /* coupon details */ }
}
```

#### 5. Get User Coupons
```http
GET /api/coupons/user/:userId
```

**Response:**
```json
{
  "success": true,
  "data": [ /* array of coupons */ ],
  "count": 5
}
```

#### 6. Get Active Time-Specific Coupons
```http
GET /api/coupons/active/time-specific
```

**Response:**
```json
{
  "success": true,
  "data": [ /* array of active coupons */ ],
  "count": 12
}
```

#### 7. Get Coupon Usage History
```http
GET /api/coupons/:couponId/usage-history
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "couponId": "uuid",
      "userId": "user123",
      "orderId": "order456",
      "orderValue": 300,
      "discountApplied": 25,
      "usedAt": "2025-11-26T12:00:00Z"
    }
  ],
  "count": 1
}
```

#### 8. Get User Usage History
```http
GET /api/coupons/user/:userId/usage-history
```

## How to Run This Application

### Prerequisites

Before starting, ensure you have:
- **Node.js v18+** - JavaScript runtime ([Download](https://nodejs.org/))
- **PostgreSQL v14+** - Database server ([Download](https://www.postgresql.org/download/))
- **npm** - Package manager (comes with Node.js)

Verify installations:
```powershell
node --version    # Should show v18.x.x or higher
npm --version     # Should show 9.x.x or higher
psql --version    # Should show 14.x or higher
```

### Quick Start (5 Minutes)

**Step 1: Install Dependencies** (Already done if you have node_modules/)
```powershell
npm install
```
This installs 315 packages including Express, PostgreSQL client, TypeScript, and all required dependencies.

**Step 2: Configure Database**

Edit `.env` file with your PostgreSQL credentials:
```env
NODE_ENV=development
PORT=3000

# Update these with your PostgreSQL settings
DB_HOST=localhost
DB_PORT=5432
DB_NAME=coupon_system
DB_USER=postgres
DB_PASSWORD=your_postgres_password_here  # IMPORTANT: Change this!
DB_MAX_CONNECTIONS=20

LOG_LEVEL=info
```

**Step 3: Create Database**

Using PowerShell:
```powershell
# Connect to PostgreSQL and create database
psql -U postgres -c "CREATE DATABASE coupon_system;"
```

Or using psql interactively:
```powershell
psql -U postgres
```
```sql
CREATE DATABASE coupon_system;
\l                    -- List databases to verify
\q                    -- Quit psql
```

**Step 4: Run Migrations**

This creates all tables, indexes, and constraints:
```powershell
npm run migrate
```

Expected output:
```
2025-11-26 15:32:51 [info]: Starting database migrations...
2025-11-26 15:32:51 [info]: New database connection established
2025-11-26 15:32:51 [info]: Database migrations completed successfully
```

**Step 5: Start the Server**

For development (with auto-reload on code changes):
```powershell
npm run dev
```

For production:
```powershell
npm run build    # Compile TypeScript to JavaScript
npm start        # Run compiled code
```

Expected output:
```
[INFO] ts-node-dev ver. 2.0.0
2025-11-26 15:18:55 [info]: Coupon System API running on port 3000
2025-11-26 15:18:55 [info]: Environment: development
```

**Step 6: Verify It's Working**

Test the health endpoint:
```powershell
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-26T15:18:55.000Z",
  "uptime": 1.234
}
```

Visit the welcome page:
```powershell
curl http://localhost:3000/
```

You should see API documentation with available routes.

### First API Call - Create a Coupon

Using PowerShell (note the backticks for line continuation):
```powershell
$body = @{
    userId = "user_001"
    discountType = "percentage"
    discountValue = 15
    maxDiscountAmount = 100
    minOrderValue = 500
    description = "Welcome coupon for new user"
    createdBy = "admin"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/coupons/user-specific" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body
```

Or using Git Bash / WSL:
```bash
curl -X POST http://localhost:3000/api/coupons/user-specific \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_001",
    "discountType": "percentage",
    "discountValue": 15,
    "maxDiscountAmount": 100,
    "minOrderValue": 500,
    "description": "Welcome coupon for new user",
    "createdBy": "admin"
  }'
```

Success response:
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "code": "USER-L2M3N4O5P6Q7",
    "type": "user_specific",
    "discountType": "percentage",
    "discountValue": 15,
    "status": "active",
    "userId": "user_001"
  },
  "message": "User-specific coupon created successfully"
}
```

### Common Issues & Solutions

**Issue: "Cannot connect to database"**
```
Solution:
1. Verify PostgreSQL is running: pg_ctl status
2. Check credentials in .env match your PostgreSQL setup
3. Test connection: psql -U postgres -d coupon_system
4. Ensure PostgreSQL service is started
```

**Issue: "relation does not exist" (error code 42P01)**
```
Solution: Run migrations
npm run migrate
```

**Issue: "Port 3000 is already in use"**
```
Solution 1: Change port in .env
PORT=3001

Solution 2: Stop process using port 3000
netstat -ano | findstr :3000
taskkill /PID <process_id> /F
```

**Issue: TypeScript compilation errors**
```
Solution: Clean rebuild
Remove-Item -Recurse -Force dist
npm run build
```

### Development Workflow

1. **Make code changes** in `src/` directory
2. **Save file** - dev server auto-reloads with ts-node-dev
3. **Check logs** in terminal or `logs/combined.log`
4. **Test endpoint** with curl or Postman
5. **Check errors** in `logs/error.log` if something fails

### Project Structure Quick Reference

```
src/
├── index.ts              # Application entry point - Express setup
├── config/              # Environment configuration
├── database/            # DB connection pool & migrations
├── middleware/          # Error handling, logging
├── routes/              # API endpoint definitions
├── services/            # Business logic (coupon & validation)
├── types/               # TypeScript interfaces
├── utils/               # Helper functions (discount calc, logging)
└── validators/          # Request validation schemas (Joi)
```

### Viewing Logs

Monitor all activity:
```powershell
Get-Content logs\combined.log -Tail 50 -Wait
```

Monitor errors only:
```powershell
Get-Content logs\error.log -Tail 50 -Wait
```

### Stopping the Server

Press `Ctrl+C` in the terminal running the dev server. The application will gracefully shut down:
```
2025-11-26 15:45:30 [info]: SIGINT signal received: closing HTTP server
2025-11-26 15:45:30 [info]: Database pool closed
```

### Next Steps After Setup

1. **Read API Documentation** - See endpoint details below
2. **Try Examples** - Check `API_TESTING.md` for comprehensive examples
3. **Understand Architecture** - Read `ARCHITECTURE.md` for design decisions
4. **Explore Use Cases** - See `USE_CASES.md` for business scenarios
5. **Plan Deployment** - Review `DEPLOYMENT_CHECKLIST.md` when ready for production

## Validation Rules

### User-Specific Coupon Creation
- `userId`: Required, 1-100 characters
- `discountType`: Required, either "percentage" or "fixed"
- `discountValue`: Required, positive number
- `maxDiscountAmount`: Optional, positive number (for percentage discounts)
- `minOrderValue`: Optional, non-negative number
- `description`: Optional, max 500 characters

### Time-Specific Coupon Creation
- `code`: Optional (auto-generated if not provided), 4-50 characters
- `discountType`: Required, either "percentage" or "fixed"
- `discountValue`: Required, positive number
- `validFrom`: Required, ISO date
- `validUntil`: Required, ISO date (must be after validFrom)
- `maxUsesPerUser`: Required, positive integer
- `maxTotalUses`: Optional, positive integer
- All other fields same as user-specific

### Coupon Validation
- `code`: Required, 1-50 characters
- `userId`: Required, 1-100 characters
- `orderId`: Required, 1-100 characters (must be unique)
- `orderValue`: Required, positive number

## Validation Logic

The system performs the following checks during coupon validation:

1. **Existence Check**: Verify coupon exists
2. **Status Check**: Ensure coupon is active
3. **Order Value Check**: Validate minimum order requirements
4. **Duplicate Check**: Prevent multiple coupons per order
5. **User Authorization** (user-specific):
   - Verify coupon belongs to the user
   - Check single-use restriction
6. **Time Validity** (time-specific):
   - Verify current time is within valid range
   - Check per-user usage limits
   - Check global usage limits
7. **Discount Calculation**: Apply appropriate discount rules
8. **Usage Recording**: Store transaction with audit trail

## Error Handling

The API uses standard HTTP status codes:

- `200 OK`: Successful operation
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data or validation failure
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Error responses follow this format:
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional details (for validation errors)"
}
```

## Logging

The system uses Winston for structured logging:

- **Console logs**: Colorized output for development
- **File logs**: 
  - `logs/combined.log`: All logs
  - `logs/error.log`: Error logs only

Log levels: error, warn, info, debug

## Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Input Validation**: Joi schema validation
- **SQL Injection Prevention**: Parameterized queries
- **Transaction Safety**: ACID compliance
- **Audit Trail**: Complete usage tracking with IP and user agent

## Performance Considerations

- Connection pooling for database efficiency
- Indexed queries for fast lookups
- Transaction-based operations for consistency
- Optimized query patterns
- Automatic status updates

## Future Enhancements

- [ ] Batch coupon generation
- [ ] Advanced discount rules (tiered, buy-X-get-Y)
- [ ] Coupon categories and tags
- [ ] Analytics dashboard
- [ ] Rate limiting
- [ ] Redis caching
- [ ] Webhook notifications
- [ ] Admin API with authentication
- [ ] Coupon deactivation/reactivation
- [ ] Export usage reports

## License

MIT

