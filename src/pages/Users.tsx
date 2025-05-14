
import React from "react";
import { Navigate } from "react-router-dom";

// This is a stub component since we've removed user management functionality
const Users = () => {
  // Redirect to home since this functionality is removed
  return <Navigate to="/" replace />;
};

export default Users;
