
import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Cog, PlusCircle, ArrowLeft } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

const AdminLayout = () => {
  const location = useLocation();
  const queryClient = useQueryClient();
  
  // Force refresh cache button handler
  const handleRefreshCache = () => {
    queryClient.invalidateQueries({ queryKey: ['productTypes'] });
  };

  // Check if we're on the product list page
  const isProductsListPage = location.pathname === '/admin/products';
  
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <p className="text-gray-600">Manage your product configurations and system settings</p>
        </div>
        <div className="flex gap-2">
          {isProductsListPage && (
            <Button onClick={() => location.pathname !== '/admin/products/create' && window.location.href = '/admin/products/create'}>
              <PlusCircle className="mr-2 h-4 w-4" /> Create Product
            </Button>
          )}
          {!isProductsListPage && (
            <Button variant="outline" onClick={() => window.location.href = '/admin/products'}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Products
            </Button>
          )}
          <Button variant="outline" onClick={handleRefreshCache}>
            <Cog className="mr-2 h-4 w-4" /> Refresh Cache
          </Button>
        </div>
      </div>
      <Separator className="mb-6" />
      <Outlet />
    </div>
  );
};

export default AdminLayout;
