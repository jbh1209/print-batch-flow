
import React from 'react';
import { UserTableContainer } from '@/components/users/UserTableContainer';

const UsersPage = () => {
  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">User Management</h1>
      </div>
      <UserTableContainer />
    </div>
  );
};

export default UsersPage;
