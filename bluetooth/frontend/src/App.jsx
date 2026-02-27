import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import HomePage from './pages/HomePage';
import Login from './pages/Login';
import Registration from './pages/Registration';
import TeacherRegistration from './pages/TeacherRegistration';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import SessionHistory from './pages/SessionHistory';

const PrivateRoute = ({ children, role }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" />;
  if (role && user.role !== role) return <Navigate to="/" />;
  return children;
};

import { Toaster } from 'react-hot-toast';

const App = () => {
  return (
    <AuthProvider>
      <Toaster position="top-center" reverseOrder={false} />
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login/:role" element={<Login />} />
          <Route path="/register" element={<Registration />} />
          <Route path="/register/teacher" element={<TeacherRegistration />} />

          <Route path="/teacher/dashboard" element={
            <PrivateRoute role="teacher">
              <TeacherDashboard />
            </PrivateRoute>
          } />

          <Route path="/teacher/session-history" element={
            <PrivateRoute role="teacher">
              <SessionHistory />
            </PrivateRoute>
          } />

          <Route path="/student/dashboard" element={
            <PrivateRoute role="student">
              <StudentDashboard />
            </PrivateRoute>
          } />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
