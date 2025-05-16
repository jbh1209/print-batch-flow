
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const AdminLayout = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <p className="text-gray-600">Manage your product configurations and system settings</p>
      </div>
      <Separator className="mb-6" />
      <Outlet />
    </div>
  );
};

export default AdminLayout;
