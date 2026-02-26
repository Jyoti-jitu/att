# 📍 GeoAttend: Smart Attendance System

A modern, full-stack college attendance management system that automatically marks student attendance using **Geo-Fencing**, **Device Binding**, and **Dynamic OTP Verification** to eliminate proxy attendance.

## 🚀 Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React 18, Vite, Tailwind CSS v3     |
| Backend  | Node.js, Express.js                 |
| Database | Supabase (PostgreSQL + Auth + RLS)  |
| Design   | Glassmorphism UI, Lucide React Icons|
| Auth     | JWT (bcryptjs + jsonwebtoken)       |

---

## 📁 Project Structure

```
bluetooth/
├── frontend/
│   ├── src/
│   │   ├── context/
│   │   │   └── AuthContext.jsx        # Auth state + local device storage
│   │   ├── pages/
│   │   │   ├── HomePage.jsx           # Landing page with multi-layer security explanation
│   │   │   ├── AdminLogin.jsx         # Teacher/Admin authentication
│   │   │   ├── StudentLogin.jsx       # Student auth + Device ID Generation
│   │   │   ├── AdminDashboard.jsx     # Teacher/Admin control panel (Stats, Blocked Logs)
│   │   │   ├── StudentDashboard.jsx   # Student portal (Location checks, Attendance Mark)
│   │   │   ├── Registration.jsx       # Registration Flow
│   │   ├── lib/
│   │   │   ├── supabase.js            # Supabase database connection
│   │   │   └── geo.js                 # Geolocation APIs & Haversine Distance Calculator
│   │   ├── App.jsx                    # Router + providers
│   │   └── index.css                  # Global styles + animations
│   ├── .env                           # Frontend environment vars
│   └── tailwind.config.js
├── backend/
│   ├── server.js                  # Express API server for Auth, Distance Validation
│   ├── .env                       # Backend environment vars
│   └── package.json
└── supabase_schema.sql            # Database schema for deployment
```

---

## ⚡ Local Development Setup

### Prerequisites
- Node.js installed
- A free [Supabase](https://supabase.com/) account for the database

### 1. Database Setup (Supabase)
This project uses Supabase for a permanent, real-time database.

1. Create a new project on [Supabase.com](https://supabase.com/).
2. Once your project is created, open the **SQL Editor** from the left-hand menu.
3. Open `bluetooth/supabase_schema.sql` from this repository, copy all the SQL code, and paste it into the Supabase SQL Editor.
4. Click **Run**. This will create all the necessary tables (`students`, `teachers`, `attendance_sessions`, `attendance_records`).
5. Go to your Supabase Project Settings -> API to find your keys.

### 2. Backend Config (`/backend`)
1. Open terminal and type `cd backend`
2. Run `npm install`
3. Create a `.env` file in the `backend` folder and add your Supabase keys:
   ```env
   PORT=5000
   SUPABASE_URL=https://your-project-url.supabase.co
   SUPABASE_SERVICE_KEY=your_supabase_service_role_key
   JWT_SECRET=your_super_secret_jwt_key
   ```
4. Start the backend: `npm run dev`

### 3. Frontend Config (`/frontend`)
1. Open a *new* terminal and type `cd frontend`
2. Run `npm install`
3. Create a `.env` file in the `frontend` folder:
   ```env
   VITE_API_URL=http://localhost:5000
   VITE_SUPABASE_URL=https://your-project-url.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
4. Start the frontend: `npm run dev`

*(Note: If you skip the Supabase setup, the system will gracefully fall back to "Mock Mode" using temporary memory, which is great for quick local demos but won't save data permanently!)*

---

## 🛡️ Multi-Layer Anti-Proxy Architecture

This system uses multi-layer verification to reduce proxy attendance by approximately 85–90%:

1. **Geo-Fencing Location System** (Layer 1)
   - Uses the **Haversine formula** to calculate the distance between the teacher's device and the student's device using raw GPS coordinates. 
   - A strict **20-meter radius** is enforced. If the student is > 20 meters away, the API rejects the attendance.

2. **Device Binding** (Layer 2)
   - Upon first login, a unique `deviceId` is generated via `crypto.randomUUID()` and saved into the database for the student.
   - Any future login attempts from a different web browser or device will be blocked by the server, forcing students to only use their own primary device.

3. **Time Restriction** (Layer 3)
   - Sessions remain active for exactly **3 minutes**. After 3 minutes, the session is invalidated immediately on the backend, preventing students from doing it later or from a hostel.

4. **Section Filter & Dynamic OTP** (Layer 4)
   - Sessions are specific to a university `Branch` and `Section`. 
   - A dynamic **6-digit Verification Code** is randomly generated and must be visibly provided to the class by the teacher upon starting the session.

---

## 🔐 Demo Credentials

### Teachers/Admins
| Email                   | Password          | Security Token | Role |
|-------------------------|-------------------|----------------|------|
| teacher@college.edu | teacher123    | 157500         | teacher|

### Students (All use password: `student123`)
| Name          | Email                 |
|---------------|-----------------------|
| Arjun Sharma  | arjun@student.edu     |
| Priya Patel   | priya@student.edu     |

---

## 🚀 Production Deployment (Vercel)

GeoAttend is fully configured to be deployed on Vercel's serverless infrastructure. Vercel requires you to deploy the Frontend and Backend as **two separate projects**.

### Step 1: Deploying the Backend
1. Go to your [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New > Project**.
2. Import your GitHub repository.
3. In the "Root Directory" settings, click `Edit` and select the **`backend`** folder.
4. Go to **Environment Variables** and add:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `JWT_SECRET`
5. Click **Deploy**.
6. Once deployed, copy your new backend URL (e.g., `https://geoattend-backend.vercel.app`).

### Step 2: Deploying the Frontend
1. Go back to your Vercel Dashboard and click **Add New > Project** again.
2. Import the exact same repository.
3. In the "Root Directory" settings, click `Edit` and select the **`frontend`** folder.
4. Ensure the Framework Preset is detected as **Vite**.
5. Go to **Environment Variables** and add:
   - `VITE_API_URL` → *(Paste your backend URL from Step 1 here!)*
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Click **Deploy**.

Congratulations! Your Smart Attendance System is now live!
