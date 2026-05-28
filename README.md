# Fleet Backend

Enterprise NestJS API for the **FleetTrack** multi-tenant Fleet Management SaaS platform.

## Quick start

```bash
pnpm install
# Configure .env (see docs)
pnpm run start:dev
```

- **API:** `http://localhost:3000/api/v1`
- **Swagger:** `http://localhost:3000/docs`

## Documentation

| Document | Location |
|----------|----------|
| Project docs index | [../docs/README.md](../docs/README.md) |
| Setup guide | [../docs/SETUP_GUIDE.md](../docs/SETUP_GUIDE.md) |
| SaaS flow | [../docs/SAAS_FLOW.md](../docs/SAAS_FLOW.md) |
| Architecture | [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) |
| Implementation status | [../docs/IMPLEMENTATION_STATUS.md](../docs/IMPLEMENTATION_STATUS.md) |
| API cURL examples | [docs/API_CURL.md](./docs/API_CURL.md) |

## Stack

NestJS 11 · MongoDB · Mongoose · JWT · bcrypt · Swagger · pnpm

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm run start:dev` | Development with watch |
| `pnpm run build` | Compile to `dist/` |
| `pnpm run start:prod` | Run production build |
