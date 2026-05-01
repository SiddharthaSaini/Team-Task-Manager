# Team Task Manager (MERN)

A full-stack MERN app where users can create projects, assign tasks, and track progress with role-based access (`admin` and `member`).

## Features

- JWT authentication (signup/login)
- Role-based access control
- Project and team management
- Task creation, assignment, and status updates
- Dashboard stats (total, todo, in-progress, done, overdue)
- Railway deployment ready

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + MongoDB + Mongoose
- Auth: JWT + bcrypt

## Project Structure

- `backend`: Express API
- `frontend`: React client

## Local Setup

### 1) Backend

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

### 2) Frontend

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` and backend on `http://localhost:5000`.

## API Endpoints

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/users` (admin only)
- `GET /api/projects`
- `POST /api/projects` (admin only)
- `PUT /api/projects/:projectId/members` (admin only)
- `GET /api/projects/:projectId/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:taskId/status`
- `GET /api/dashboard/stats`

## Railway Deployment

### Backend Service

1. Create a new Railway project from the `backend` folder.
2. Set environment variables:
   - `PORT=5000` (optional, Railway injects one automatically)
   - `MONGO_URI=<your-mongodb-uri>`
   - `JWT_SECRET=<strong-secret>`
3. Deploy.

### Frontend Service

1. Create a second Railway service from the `frontend` folder.
2. Set `VITE_API_URL=https://<your-backend-domain>/api`
3. Deploy.

## Submission Checklist

- Live URL
- GitHub repo
- README

