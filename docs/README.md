# 🍊 Garnish OS

### AI-Native Personalized Nutrition Operating System

Garnish OS is an AI-native food, nutrition, and meal-planning platform designed to help individuals and families make healthier food decisions through behavioral intelligence, personalization, and culturally-aware nutrition guidance.

Unlike traditional recipe apps or calorie trackers, Garnish OS aims to become a long-term nutritional operating system that learns user preferences, habits, health goals, family dynamics, and food behavior over time.

---

# Vision

We believe food is one of the most important yet underserved areas of everyday decision-making.

Current nutrition apps focus on isolated tasks:

- Calorie tracking
- Recipe discovery
- Diet planning
- Shopping lists

Garnish OS combines these workflows into a unified AI-powered experience.

Our long-term vision is to become the **behavioral intelligence layer for nutrition and food decisions**.

---

# Value Proposition

Garnish OS helps users answer:

- What should I cook today?
- What should I eat based on my goals?
- How can I plan meals for my family?
- What ingredients do I need this week?
- How can I improve my nutrition over time?

**Core differentiators:**

- **AI-native architecture** – Google Gemini powered assistant deeply integrated across the app
- **Behavioral Learning Engine** – 66+ event types across 10 layers capturing every meaningful interaction
- **Family-aware planning** – shared meal plans, shopping lists, and preference profiles
- **Cultural Food Intelligence** – recipes and recommendations tailored to Persian, MENA, and global cuisines
- **Long-term Preference Memory** – evolving user profiles built from behavioral data, not just manual input
- **Privacy & Security by Design** – RBAC, rate limiting, input validation, and audit-ready infrastructure

---

# Current Status (MVP)

**✅ Functional MVP** – We have moved beyond a simple prototype and are now building a **fundable operational product** (Phase 0.5 → 1).

### Implemented modules:

- **User Authentication** (JWT, phone/email registration, rate-limited endpoints)
- **Role-Based Access Control (RBAC)** – admin guard protecting sensitive APIs
- **Recipe Management** – full CRUD, categories, region, difficulty, cost, etc.
- **Meal Planning** – weekly planner with drag-and-drop slots
- **Shopping List** – automatic generation from meal plans
- **AI Assistant** – integrated chat with structured enrichment of ingredients, concepts, and meal names
- **Behavioral Analytics Engine** – 66 standardized events tracked across the application, with an enrichment pipeline and admin dashboard
- **Notifications System** – in-app notifications with read/unread state
- **Favorites Management** – user-specific recipe collections
- **Profile & Preferences** – diet, allergies, skill level, cuisine, budget, health goals
- **UI/UX Revamp** – modern glassmorphism design, Mantine UI, Framer Motion animations

### Current team:

- Product & Strategy
- Engineering
- Design & Content

### Target market:

- Health-conscious consumers
- Families
- Persian & MENA diaspora
- Personalized nutrition users

---

# Technology Stack

| Layer          | Technology                                                  |
| -------------- | ----------------------------------------------------------- |
| **Frontend**   | React 19, Vite, Mantine UI, Framer Motion, TanStack Query, Axios |
| **Backend**    | NestJS, Prisma ORM, TypeScript                             |
| **AI**         | Google Gemini API                                           |
| **Database**   | PostgreSQL (via Docker)                                     |
| **Cache**      | Redis                                                       |
| **Infrastructure** | Docker Compose, Turborepo, PNPM Workspaces                 |
| **Analytics**  | Custom Event Tracking Pipeline, Event Enrichment, Admin Analytics Dashboard |

---

# High-Level Architecture

```text
Client Applications (React / Vite)
            │
            ▼
      API Layer (NestJS)
            │
 ┌──────────┼──────────┐
 │          │          │
 ▼          ▼          ▼
Auth      Content      AI
(RBAC)    (Recipes,    (Gemini,
          Plans,       Chat,
          Lists)       Enrichment)
 │          │          │
 └──────────┼──────────┘
            ▼
      PostgreSQL
            │
            ▼
   Analytics & Behavioral Data
   (UserEvent, BehaviorProfile)
Architecture principles:
Modular backend – domain-driven design with dedicated modules

Feature-driven frontend – each feature in its own folder with pages, services, and components

Centralized HTTP client – single Axios instance with dynamic base URL, used everywhere

Data-fetching with React Query – no stale context, automatic caching and invalidation

Event-based analytics – all user interactions flow through a unified useAnalytics hook

Security-first – rate limiting, validation, CORS, and RBAC guards at every layer

Quick Start
Prerequisites
Node.js ≥ 18

PNPM

Docker Desktop

Steps
Clone & install dependencies

bash
git clone https://github.com/your-org/garnish-app.git
cd garnish-app
pnpm install
Start PostgreSQL & Redis

bash
docker-compose up -d
Environment variables

Copy apps/server/.env.example to apps/server/.env and fill in:

DATABASE_URL

JWT_SECRET

GEMINI_API_KEY

FRONTEND_URL

Copy apps/web/.env.example to apps/web/.env (usually points to http://localhost:3000)

Run database migrations

bash
cd apps/server
npx prisma migrate dev
npx prisma generate
Start development servers

bash
# From project root
pnpm dev
Backend: http://localhost:3000

Frontend: http://localhost:5173

Test user
Phone: 09123456789

Password: 123456

To access the admin panel (/admin), open Prisma Studio (npx prisma studio), find the user, and set isAdmin to true.

Security
Security is a core design principle, not an afterthought.

Current protections:
JWT Authentication – secure token-based auth

Input Validation – class-validator DTOs on all sensitive endpoints (LoginDto, RegisterDto)

Rate Limiting – /auth/login and /auth/register limited to 5 requests per 60 seconds

CORS – strictly configured to accept only the frontend origin

Secure Password Hashing – bcrypt with appropriate salt rounds

RBAC Guard – admin endpoints protected by RolesGuard, non-admins see only “unauthorized”

Planned / In progress:
Audit Logs (UserAuditLog, DataAccessLog, ConsentLog) for GDPR compliance

Preference History – tracking changes over time

Data Retention Policies

Encryption Enhancements

Scalability Strategy
Garnish OS is designed to grow from MVP to a large-scale consumer platform.

Key scalability pillars:
PostgreSQL – relational power for complex food data

Redis Caching – session and frequent-query acceleration

Event-Driven Analytics – decoupled behavioral data pipeline

API Modularity – independent services can be extracted later

Future components:
Vector Database (e.g., Qdrant) for semantic recipe search

Distributed Background Jobs

Advanced Behavioral Models

Multi-Region Deployment

Behavioral Analytics Engine (unique moat)
Garnish OS tracks 66 standardized user events across 10 behavioral layers:

Layer	Status	Description
1 – Identity	🟢 Complete	login, register, profile_edit, avatar_change, logout
2 – Session Intelligence	🟡 In progress	page_view, session_start/end, device metadata
3 – Navigation Analytics	🟢 Complete	tab switches, sidebar clicks
4 – Search Intelligence	🟢 Complete	search queries, result clicks, filters
5 – Meal Planning	🟢 Complete	add to plan, remove, reorder
6 – Grocery Intelligence	🟢 Complete	add to list, check, clear
7 – Nutrition Intelligence	🔴 Planned	nutrient views, comparisons
8 – Family Intelligence	🔴 Planned	family member additions, shared planning
9 – Habit & Behavioral Layer	🔴 Planned	streak tracking, consistency metrics
10 – AI Interaction Layer	🟢 Complete	chat messages, enrichments, feedback
Every event is enriched by an Event Enrichment Service that extracts structured data (ingredients, meal concepts, search terms) and stores it for future personalization.

Product Roadmap
Phase 1 (Current)
✅ MVP Launch

✅ Behavioral Data Collection

✅ Analytics Infrastructure

🔲 Complete Behavior Profile Model

🔲 GDPR Audit System

🔲 PostHog Integration

Phase 2
Advanced Personalization

Health Profiles

Family Planning Enhancements

AI Recommendation Improvements

Phase 3
Health Mode

Wearable Integrations

Nutrition Intelligence Layer

Marketplace Partnerships

Phase 4
Behavioral Nutrition Graph

Predictive Recommendations

B2B Data Products

International Expansion

Contribution
We welcome contributions that improve:

Product quality

Performance

Accessibility

Security

Testing

Developer experience

Development workflow:

Create a feature branch

Implement changes

Add tests where applicable

Submit a pull request

Complete code review

Disclaimer
Garnish OS provides nutritional guidance and recommendations.

It is not intended to diagnose, treat, cure, or prevent any medical condition.

Users should consult qualified healthcare professionals for medical advice.

Contact
Garnish OS

Building the future operating system for food and nutrition