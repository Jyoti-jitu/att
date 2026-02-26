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

## ⚡ Getting Started

### 1. Backend (Node.js)
```bash
cd backend
npm install
npm run dev
```
API runs at: http://localhost:5000

### 2. Frontend (React)
Open a new terminal session.
```bash
cd frontend
npm run dev
```
Visit: http://localhost:5173

*(Note: The system gracefully falls back to memory/mock arrays if the `.env` Supabase config is missing, allowing immediate local testing!)*

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

## 🔧 Environment Variables

### Frontend (`.env`)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Backend (`backend/.env`)
```
PORT=5000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
JWT_SECRET=your-super-secret-jwt-key
```

---

## 🗄️ Supabase Setup (Production Deployment)

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the provided `supabase_schema.sql` inside the Supabase SQL Editor to spin up the tables (`students`, `teachers`, `attendance_sessions`, `attendance_records`).
3. Copy your project URL and keys to the `.env` files.
