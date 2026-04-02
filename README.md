# MK Educator

A classroom presentation and quiz tool for substitute teachers and volunteers. When a teacher is absent, any volunteer can log in, pick a topic, present content slides to students, run quizzes, and award stars.

## Tech Stack

- **Frontend**: Next.js (App Router), React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth v5 (credentials-based)
- **Language**: TypeScript

## Features

- **Admin Panel**: Create/edit topics with content slides and quiz questions
- **Presentation Mode**: Slide-by-slide content delivery with navigation
- **Quiz Mode**: Interactive quiz with per-student tracking
- **Star System**: Award stars for correct quiz answers
- **Leaderboard**: Ranked display of student performance
- **Topic Tracking**: Mark topics as taught to avoid repetition
- **Student Management**: Add/remove students (first name + last name)
- **Role-Based Access**: Admin and Volunteer roles with different permissions

## Prerequisites

- Node.js 20+
- PostgreSQL 16+ (or Docker)

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL

**Option A: Docker (recommended)**

```bash
docker compose up -d
```

**Option B: Use an existing PostgreSQL instance**

Update `DATABASE_URL` in `.env` to point to your database.

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your database URL and secrets
```

### 4. Run database migrations

```bash
npx prisma migrate dev --name init
```

### 5. Seed default users

```bash
npx prisma db seed
```

### 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Default Accounts

| Role      | Username    | Password       |
| --------- | ----------- | -------------- |
| Admin     | admin       | admin123       |
| Volunteer | volunteer   | volunteer123   |

> Change these in `.env` before deploying.

## NPM Scripts

| Command              | Description                 |
| -------------------- | --------------------------- |
| `npm run dev`        | Start dev server            |
| `npm run build`      | Build for production        |
| `npm start`          | Start production server     |
| `npm run db:migrate` | Run Prisma migrations       |
| `npm run db:seed`    | Seed default users          |
| `npm run db:reset`   | Reset database + re-seed    |
| `npm run db:studio`  | Open Prisma Studio (DB GUI) |

## Project Structure

```
src/
├── app/
│   ├── api/              # API routes
│   │   ├── auth/         # NextAuth endpoints
│   │   ├── topics/       # Topics CRUD + contents + quizzes
│   │   ├── students/     # Students CRUD
│   │   └── stars/        # Star awards + leaderboard
│   ├── admin/            # Admin pages (topic + content management)
│   ├── present/          # Presentation + quiz flow
│   ├── students/         # Student management page
│   ├── leaderboard/      # Leaderboard page
│   ├── login/            # Login page
│   ├── layout.tsx        # Root layout with nav
│   └── page.tsx          # Home/dashboard
├── components/           # Shared UI components
├── lib/                  # Auth config, Prisma client
└── types/                # TypeScript declarations
prisma/
├── schema.prisma         # Database schema
└── seed.ts               # Seed script
```

## Workflow

1. **Admin** logs in → creates topics → adds content slides → adds quiz questions
2. **Volunteer** logs in → picks an untaught topic → presents slides to class
3. After slides → runs quiz → selects student → student answers → stars awarded
4. Topic marked as "taught" → won't appear in untaught list next time
5. Leaderboard shows cumulative stars across all topics
