# Fleet API — cURL reference

> Part of FleetTrack documentation. See also: [../../docs/API_REFERENCE.md](../../docs/API_REFERENCE.md) · [../../docs/README.md](../../docs/README.md)

**Base URL:** `http://localhost:3000/api/v1`

All protected routes require:

```http
Authorization: Bearer <ACCESS_TOKEN>
```

Obtain a token via `POST /auth/login` (after one-time `POST /auth/setup-super-admin`).

---

## Auth

### Login

```bash
curl --location 'http://localhost:3000/api/v1/auth/login' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "email": "superadmin@fleet.com",
    "password": "Admin@123"
  }'
```

### Refresh token

```bash
curl --location 'http://localhost:3000/api/v1/auth/refresh-token' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

Alias: `POST /auth/refresh`

### Forgot password

```bash
curl --location 'http://localhost:3000/api/v1/auth/forgot-password' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "email": "superadmin@fleet.com"
  }'
```

In development, the reset token is returned in the response body.

### Reset password

```bash
curl --location 'http://localhost:3000/api/v1/auth/reset-password' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "token": "RESET_TOKEN",
    "password": "NewPassword@123"
  }'
```

Optional: `"email": "user@fleet.com"`. You may use `"newPassword"` instead of `"password"`.

### Logout

```bash
curl --location --request POST 'http://localhost:3000/api/v1/auth/logout' \
  --header 'Authorization: Bearer ACCESS_TOKEN'
```

---

## Users

### Create user

```bash
curl --location 'http://localhost:3000/api/v1/users' \
  --header 'Authorization: Bearer ACCESS_TOKEN' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "fullName": "Raj Sharma",
    "email": "raj@fleet.com",
    "phone": "+919999999999",
    "password": "Password@123",
    "role": "COMPANY_ADMIN",
    "status": "ACTIVE",
    "companyId": "665f1f9c8e12ab0012345678"
  }'
```

### List / filter by status

```bash
curl --location 'http://localhost:3000/api/v1/users?status=ACTIVE' \
  --header 'Authorization: Bearer ACCESS_TOKEN'
```

### Update status / verify email / delete

- `PATCH /users/:id/status` — body `{ "status": "SUSPENDED" }`
- `PATCH /users/:id/verify-email`
- `DELETE /users/:id`

---

## Companies

### Register (public)

```bash
curl --location 'http://localhost:3000/api/v1/companies/register' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "companyName": "ABC Logistics",
    "email": "admin@abc.com",
    "phone": "+919876543210",
    "adminName": "Raj Sharma",
    "password": "Password@123"
  }'
```

Creates company with `status: PENDING` and company admin with `PENDING_APPROVAL`.

### List / pending

```bash
curl --location 'http://localhost:3000/api/v1/companies?status=PENDING' \
  --header 'Authorization: Bearer ACCESS_TOKEN'
```

### Approve / reject / suspend (Super Admin)

- `PATCH /companies/:id/approve`
- `PATCH /companies/:id/reject`
- `PATCH /companies/:id/suspend`

---

## Vehicles

### Create (accepts API aliases)

```bash
curl --location 'http://localhost:3000/api/v1/vehicles' \
  --header 'Authorization: Bearer ACCESS_TOKEN' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "vehicleNumber": "MH12AB1234",
    "model": "Tata Ace",
    "type": "TRUCK",
    "companyId": "665f1f9c8e12ab0012345678"
  }'
```

Also supported: `registrationNumber`, `modelName`, `make`.

### Assign driver

```bash
curl --location --request PATCH 'http://localhost:3000/api/v1/vehicles/VEHICLE_ID/assign-driver' \
  --header 'Authorization: Bearer ACCESS_TOKEN' \
  --header 'Content-Type: application/json' \
  --data-raw '{ "driverId": "DRIVER_ID" }'
```

---

## Drivers

Creates a `User` (role `DRIVER`) plus a `Driver` record.

```bash
curl --location 'http://localhost:3000/api/v1/drivers' \
  --header 'Authorization: Bearer ACCESS_TOKEN' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "fullName": "Suresh Kumar",
    "email": "driver@fleet.com",
    "phone": "+917777777777",
    "password": "Password@123",
    "licenseNumber": "DL123456789"
  }'
```

---

## Expenses

```bash
curl --location 'http://localhost:3000/api/v1/expenses' \
  --header 'Authorization: Bearer ACCESS_TOKEN' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "vehicleId": "VEHICLE_ID",
    "category": "FUEL",
    "amount": 5000,
    "description": "Fuel refill"
  }'
```

Categories: `FUEL`, `MAINTENANCE`, `INSURANCE`, `TOLL`, `OTHER`.

---

## Reports

```bash
curl --location 'http://localhost:3000/api/v1/reports/dashboard' \
  --header 'Authorization: Bearer ACCESS_TOKEN'

curl --location 'http://localhost:3000/api/v1/reports/revenue' \
  --header 'Authorization: Bearer ACCESS_TOKEN'

curl --location 'http://localhost:3000/api/v1/reports/export/csv' \
  --header 'Authorization: Bearer ACCESS_TOKEN'
```

---

## Swagger

Interactive docs: [http://localhost:3000/docs](http://localhost:3000/docs)
