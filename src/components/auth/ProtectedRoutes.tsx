
import React from "react";
import { Route, Navigate, Routes } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Users from "@/pages/Users";

export const ProtectedRoutes: React.FC = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/dashboard" /> : <Auth />} />
      <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/auth" />} />
      <Route path="/users" element={user ? <Users /> : <Navigate to="/auth" />} />
      <Route path="/" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
};
