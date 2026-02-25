# EGG BUCKET 🥚

> Egg distribution and sales management system

**Version:** 1.0.0  
**Last Updated:** February 2026

---

## Overview

EggBucket is a full-stack web application for managing egg distribution operations including sales tracking, payments, outlet management, and reporting. Built with React + Vite frontend and Express.js backend with Firebase integration.

---

## Features

- **Dashboard** - Overview of sales, damages, and distribution metrics
- **Daily Sales** - Track and manage daily egg sales
- **Daily Damages** - Record and monitor damaged inventory
- **NEC Crate Management** - Track crate inventory and movements
- **Cash Payments** - Manage cash payment transactions
- **Digital Payments** - Handle digital/online payments
- **Distribution** - Manage distributor operations
- **Outlets** - Outlet registration and management
- **Reports** - Generate and export reports (Excel)
- **User Management** - Role-based access control (Admin, Supervisor, Data Agent, Viewer)

---

## Tech Stack

### Frontend
- React 19
- Vite 7
- React Router DOM 7
- Tailwind CSS 4
- Recharts (analytics charts)
- XLSX (Excel export)
- FontAwesome icons

### Backend
- Node.js / Express 5
- Firebase Admin SDK
- JWT Authentication
- bcryptjs (password hashing)

---

## Project Structure

```
EggBucket/
├── src/                    # Frontend source
│   ├── components/         # Reusable UI components
│   ├── pages/              # Page components
│   ├── layouts/            # Layout wrappers
│   ├── context/            # React context providers
│   └── utils/              # Utility functions
├── backend/                # Backend API
│   ├── controllers/        # Route handlers
│   ├── routes/             # API routes
│   ├── config/             # Firebase config
│   └── scripts/            # Utility scripts
├── public/                 # Static assets
└── scripts/                # Build scripts
```

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- Firebase project with Firestore

### Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Start server
node server.js

# Or with nodemon (development)
npx nodemon server.js
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
JWT_SECRET=your_jwt_secret_key
FIREBASE_PROJECT_ID=your_firebase_project_id
```

### Firebase Config
Place your `serviceAccountKey.json` in `backend/config/`

---

## User Roles

| Role | Access |
|------|--------|
| **Admin** | Full access to all features |
| **Supervisor** | Zone-based outlet and sales management |
| **Data Agent** | Limited access based on assigned roles |
| **Viewer** | Read-only access to data |

---

## API Endpoints

| Route | Description |
|-------|-------------|
| `/api/auth` | Authentication |
| `/api/admin` | Admin operations |
| `/api/outlets` | Outlet management |
| `/api/dailysales` | Daily sales data |
| `/api/daily-damage` | Damage records |
| `/api/cash-payments` | Cash payments |
| `/api/digital-payments` | Digital payments |
| `/api/distributors` | Distributor data |
| `/api/neccrate` | Crate management |
| `/api/reports` | Report generation |

---

## Deployment

### Frontend (Vercel/Netlify)
1. Build: `npm run build`
2. Deploy `dist/` folder
3. Set environment variables if needed

### Backend (Railway/Render/VPS)
1. Upload `backend/` folder
2. Set environment variables
3. Start command: `node server.js`
4. Ensure Firebase credentials are configured

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Feb 2026 | Initial release with full feature set |

---

## License

Private / Internal Use
