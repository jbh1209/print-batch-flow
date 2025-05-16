
import React, { useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Cog, PlusCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DebugInfo } from '@/components/ui/debug-info';
import { generateRenderKey } from '@/utils/cacheUtils';

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Force refresh cache button handler
  const handleRefreshCache = () => {
    queryClient.invalidateQueries({ queryKey: ['productTypes'] });
    toast.success('Cache refreshed successfully');
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
            <Button onClick={() => navigate('/admin/products/create')}>
              <PlusCircle className="mr-2 h-4 w-4" /> Create Product
            </Button>
          )}
          {!isProductsListPage && (
            <Button variant="outline" onClick={() => navigate('/admin/products')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Products
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={handleRefreshCache}
            title="Refresh product cache"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh Cache
          </Button>
        </div>
      </div>
      <Separator className="mb-6" />
      <Outlet />
      
      {process.env.NODE_ENV === 'development' && (
        <DebugInfo 
          componentName="AdminLayout"
          extraInfo={{
            path: location.pathname,
            isProductsListPage,
            renderKey: generateRenderKey()
          }}
          visible={true}
        />
      )}
    </div>
  );
};

export default AdminLayout;
