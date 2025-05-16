
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useProductTypes } from '@/hooks/admin/useProductTypes';
import { Edit, Trash, RefreshCw, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { DebugInfo } from '@/components/ui/debug-info';

const ProductsListPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { productTypes, isLoading, error, deleteProduct, fetchProductTypes, forceClearCache, cacheInfo } = useProductTypes();
  
  // Fetch product types on component mount
  useEffect(() => {
    fetchProductTypes();
  }, []);
  
  const handleDeleteProduct = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete the product type "${name}"?`)) {
      deleteProduct(id);
    }
  };
  
  const handleRefresh = () => {
    fetchProductTypes();
    toast.success('Product list refreshed');
  };
  
  const handleForceClearCache = () => {
    forceClearCache();
    toast.success('Cache cleared and data refreshed');
  };
  
  return (
    <div>
      <div className="mb-6 flex flex-col gap-2">
        <h2 className="text-2xl font-bold">Product Types</h2>
        <p className="text-sm text-gray-500">
          Manage the product types available in the system. Each product type has its own set of fields and features.
        </p>
        
        <div className="flex gap-2 items-center mt-2">
          <Button size="sm" variant="outline" onClick={handleRefresh} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh List
          </Button>
          
          <Button size="sm" variant="outline" onClick={handleForceClearCache} className="flex items-center gap-2 ml-2">
            <RefreshCw className="h-4 w-4" />
            Force Clear Cache
          </Button>
        </div>
      </div>
      
      {error && (
        <Card className="mb-6 bg-red-50 border-red-200">
          <CardContent className="p-4 flex items-center gap-3 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-medium">Error loading products</p>
              <p className="text-sm">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchProductTypes} className="ml-auto">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardContent className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Table Name</TableHead>
                <TableHead>Job Prefix</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="flex justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                    </div>
                    <p className="text-gray-500 mt-2">Loading product types...</p>
                  </TableCell>
                </TableRow>
              ) : productTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <p className="text-gray-500">No product types found. Create your first product type to get started.</p>
                    <Button onClick={() => navigate('/admin/products/create')} className="mt-4">
                      Create Product Type
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                productTypes.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.table_name}</TableCell>
                    <TableCell>{product.job_prefix}</TableCell>
                    <TableCell>
                      {new Date(product.updated_at).toLocaleDateString()} {new Date(product.updated_at).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/products/${product.id}`)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteProduct(product.id, product.name)}>
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Debug information */}
      <DebugInfo
        componentName="ProductsListPage" 
        extraInfo={{
          productTypesCount: productTypes.length,
          isLoading,
          isFetching: cacheInfo.isFetching,
          isStale: cacheInfo.isStale,
          dataUpdatedAt: new Date(cacheInfo.dataUpdatedAt).toLocaleTimeString(),
          staleTime: '5 minutes',
          gcTime: '30 minutes'
        }}
        visible={true}
      />
    </div>
  );
};

export default ProductsListPage;
