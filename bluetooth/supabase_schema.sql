-- Geo-Fenced Section-Based Smart Attendance System
-- Database Schema for Supabase / PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Students Table
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    roll_no TEXT UNIQUE NOT NULL,
    mobile TEXT NOT NULL,
    branch TEXT NOT NULL,
    semester TEXT NOT NULL,
    section TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    parent_mobile TEXT,
    password_hash TEXT NOT NULL,
    device_id TEXT,
    current_session_token TEXT,
    role TEXT DEFAULT 'student',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    mobile TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'teacher',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Attendance Sessions Table
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    branch TEXT NOT NULL,
    section TEXT NOT NULL,
    semester TEXT NOT NULL DEFAULT '1',
    subject TEXT,
    time_slot TEXT,
    teacher_lat DOUBLE PRECISION NOT NULL,
    teacher_lng DOUBLE PRECISION NOT NULL,
    otp VARCHAR(6) NOT NULL,
    start_time TIMESTAMPTZ DEFAULT NOW(),
    expiry_time TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed'))
);

-- Migration: add columns if they don't exist (safe to re-run)
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE;
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS semester TEXT NOT NULL DEFAULT '1';
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS time_slot TEXT;

-- 3. Attendance Records Table
CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    student_lat DOUBLE PRECISION NOT NULL,
    student_lng DOUBLE PRECISION NOT NULL,
    distance DOUBLE PRECISION NOT NULL,
    status TEXT DEFAULT 'present' CHECK (status IN ('present', 'rejected')),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_attendance UNIQUE (session_id, student_id)
);

-- Migration for records (Add columns if they don't exist in older schemas)
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES attendance_sessions(id) ON DELETE CASCADE;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS student_lat DOUBLE PRECISION;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS student_lng DOUBLE PRECISION;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS distance DOUBLE PRECISION;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'present';
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();

-- RLS Policies (Basic - can be refined)
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for demo purposes (In production, use proper Auth)
-- Allow public read/write for demo purposes (In production, use proper Auth)
DROP POLICY IF EXISTS "public_access_students" ON students;
DROP POLICY IF EXISTS "public_access_teachers" ON teachers;
DROP POLICY IF EXISTS "public_access_sessions" ON attendance_sessions;
DROP POLICY IF EXISTS "public_access_records" ON attendance_records;

CREATE POLICY "public_access_students" ON students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_access_teachers" ON teachers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_access_sessions" ON attendance_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_access_records" ON attendance_records FOR ALL USING (true) WITH CHECK (true);

-- 4. Security Migrations
ALTER TABLE students ADD COLUMN IF NOT EXISTS blocked_until TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS unauthorized_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    email TEXT,
    attempted_device_id TEXT,
    stored_device_id TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Policy for the new table
ALTER TABLE unauthorized_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_access_attempts" ON unauthorized_attempts;
CREATE POLICY "public_access_attempts" ON unauthorized_attempts FOR ALL USING (true) WITH CHECK (true);
