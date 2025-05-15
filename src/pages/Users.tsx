
import React from "react";
import { Navigate } from "react-router-dom";

// This is a stub component that redirects to home
const Users = () => {
  // Redirect to home - user management functionality has been removed
  return <Navigate to="/" replace />;
};

export default Users;
