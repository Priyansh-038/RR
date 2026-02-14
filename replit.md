# Dungeon Raid - Replit Agent Guide

## Overview

Dungeon Raid is a multiplayer co-op dungeon crawler game with a retro pixel art aesthetic. Players create or join rooms using short codes, pick from 5 character roles (swordsman, beast, archer, mage, healer), and fight through waves of enemies together in real-time. The game features a lobby system for room management and a canvas-based game renderer for the actual gameplay.

The stack is a full-stack TypeScript monorepo: React frontend with Vite, Express backend with WebSocket support, PostgreSQL database with Drizzle ORM, and shadcn/ui component library styled with a retro pixel art theme.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Monorepo Structure
- `client/` — React SPA (Vite bundled)
- `server/` — Express API + WebSocket server
- `shared/` — Database schema, API contracts, and game state types shared between client and server

### Frontend (client/)
- **Framework**: React with TypeScript, bundled by Vite
- **Routing**: Wouter (lightweight client-side router) with routes: Home (`/`), Join (`/join`), Lobby (`/lobby/:code`)
- **State Management**: TanStack React Query for server state, React hooks for local state
- **UI Components**: shadcn/ui (new-york style) with heavy custom retro/pixel art theming. Custom components like `PixelButton`, `PixelCard`, `RoleCard` wrap the design system
- **Game Rendering**: HTML5 Canvas (`GameCanvas` component) for the actual gameplay view
- **Real-time Communication**: Native WebSocket via custom `useGameSocket` hook connecting to `/ws`
- **Styling**: Tailwind CSS with CSS variables for theming, retro fonts (Press Start 2P, VT323), CRT scanline overlay effect, sharp corners (0px border radius)
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend (server/)
- **Framework**: Express 5 on Node.js with TypeScript (run via tsx)
- **HTTP Server**: Node `http.createServer` wrapping Express (needed for WebSocket upgrade)
- **WebSocket**: `ws` library for real-time game communication, attached to the HTTP server at `/ws`
- **Game Loop**: Server-side game loop running at 20 ticks/second (`TICK_RATE = 20`), managing game room states including player positions, enemies, and projectiles
- **API Design**: RESTful endpoints under `/api/` with typed contracts defined in `shared/routes.ts` using Zod schemas
- **Session**: Player sessions identified by `sessionId` (generated server-side), stored in localStorage on the client
- **Dev Server**: Vite dev middleware in development mode; static file serving in production

### Database
- **Database**: PostgreSQL (required, connection via `DATABASE_URL` environment variable)
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-validation integration
- **Schema** (in `shared/schema.ts`):
  - `rooms` table: id, code (unique 4-char uppercase), status (waiting/playing/finished), createdAt
  - `players` table: id, roomId, sessionId, name, role (enum of 5 classes), isHost, isReady
- **Migrations**: Managed via `drizzle-kit push` (schema push approach, not migration files)
- **Storage Layer**: `DatabaseStorage` class in `server/storage.ts` implements `IStorage` interface, providing a clean abstraction over database operations

### Build System
- **Dev**: `tsx server/index.ts` with Vite middleware for HMR
- **Production Build**: Custom `script/build.ts` using Vite for client and esbuild for server, outputting to `dist/`
- **Server Output**: `dist/index.cjs` (CommonJS bundle)
- **Client Output**: `dist/public/` (static files)

### Game Architecture
- Rooms are created with random 4-character codes
- Up to 5 players per room, each selecting a unique role
- Host player can start the game when all players are ready
- Game state (players, enemies, projectiles, waves) is managed server-side and broadcast via WebSocket
- Client sends input (movement + attack) and receives authoritative game state updates

## External Dependencies

### Required Services
- **PostgreSQL**: Database for rooms and players. Must have `DATABASE_URL` environment variable set. Provision a PostgreSQL database before running.

### Key NPM Packages
- **drizzle-orm** + **drizzle-kit**: ORM and schema management for PostgreSQL
- **express** (v5): HTTP server framework
- **ws**: WebSocket server
- **zod**: Runtime validation for API contracts and schemas
- **@tanstack/react-query**: Server state management on the client
- **wouter**: Client-side routing
- **shadcn/ui** (Radix primitives): UI component library
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Icon library
- **vite** + **@vitejs/plugin-react**: Frontend build tool
- **esbuild**: Server bundling for production
- **connect-pg-simple**: PostgreSQL session store (available but session management appears to use custom sessionId approach)

### Replit-Specific Plugins
- `@replit/vite-plugin-runtime-error-modal`: Runtime error overlay
- `@replit/vite-plugin-cartographer`: Dev tooling (dev only)
- `@replit/vite-plugin-dev-banner`: Dev banner (dev only)