
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { DebugInfo } from "@/components/ui/debug-info";
import { generateRenderKey } from "@/utils/cacheUtils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { CreditCard, Files, Cog, Package, RefreshCw } from "lucide-react";
import { useProductTypes } from "@/hooks/admin/useProductTypes";
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const Index = () => {
  const renderKey = generateRenderKey();
  const { productTypes, isLoading, error, fetchProductTypes } = useProductTypes();
  const queryClient = useQueryClient();
  
  useEffect(() => {
    // Fetch product types when component mounts
    fetchProductTypes();
  }, []);

  // Force refresh function for debugging/testing
  const handleRefreshCache = () => {
    queryClient.invalidateQueries({ queryKey: ['productTypes'] });
    fetchProductTypes();
    toast.success('Product types cache refreshed');
  };

  // Get icon component for dynamic product cards
  const getProductIcon = (iconName: string) => {
    switch (iconName) {
      case 'CreditCard': return <CreditCard className="h-5 w-5 text-blue-600" />;
      case 'FileText': 
      case 'Files': return <Files className="h-5 w-5 text-orange-600" />;
      case 'Package': return <Package className="h-5 w-5 text-purple-600" />;
      default: return <Package className="h-5 w-5 text-green-600" />;
    }
  };

  return (
    <div className="px-4 py-6 md:p-8">
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Print Management Dashboard</h1>
            <p className="text-gray-600">Manage your print jobs and batches</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefreshCache} 
            className="flex items-center gap-2"
            title="Refresh product types cache"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Cache
          </Button>
        </div>

        {/* Hardcoded Business Cards - Always show at the top */}
        <h2 className="text-xl font-bold mb-4">Core Products</h2>
        <div className="grid grid-cols-1 gap-6 mb-10">
          <Card className="shadow-md">
            <CardHeader className="bg-blue-50">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <CardTitle>Business Cards</CardTitle>
              </div>
              <CardDescription>Manage business card print jobs</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-gray-600 mb-4">Create and manage business card jobs and batches.</p>
            </CardContent>
            <CardFooter className="flex gap-2 border-t pt-4">
              <Button asChild variant="default">
                <Link to="/batches/business-cards/jobs">View Jobs</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/batches/business-cards">View Batches</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        {/* Dynamic Products Section - Show products from database */}
        {productTypes.length > 0 && productTypes.some(product => product.slug !== 'business-cards') && (
          <>
            <h2 className="text-xl font-bold mb-4">Custom Products</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
              {productTypes
                .filter(product => product.slug !== 'business-cards') // Filter out Business Cards if it exists in DB
                .map(product => (
                  <Card key={product.id} className="shadow-md h-full">
                    <CardHeader className={`bg-${product.color}-50`}>
                      <div className="flex items-center gap-2">
                        {getProductIcon(product.icon_name)}
                        <CardTitle>{product.name}</CardTitle>
                      </div>
                      <CardDescription>Manage {product.name.toLowerCase()} print jobs</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <p className="text-gray-600 mb-4">Create and manage {product.name.toLowerCase()} jobs and batches.</p>
                    </CardContent>
                    <CardFooter className="flex gap-2 border-t pt-4 mt-auto">
                      <Button asChild variant="default">
                        <Link to={`/batches/${product.slug}/jobs`}>View Jobs</Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link to={`/batches/${product.slug}`}>View Batches</Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
            </div>
          </>
        )}
        
        {isLoading && (
          <div className="text-center p-6 mb-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-2" />
            <p>Loading product types...</p>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-md mb-8">
            <p>Error loading product types: {error}</p>
            <Button variant="outline" size="sm" onClick={handleRefreshCache} className="mt-2">
              Retry
            </Button>
          </div>
        )}

        {/* Quick Access Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-sm h-full">
            <CardHeader>
              <CardTitle className="text-xl">All Batches</CardTitle>
              <CardDescription>View batches across all product types</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500 mb-4">Access and manage all batches in one place.</p>
            </CardContent>
            <CardFooter className="mt-auto">
              <Link to="/batches" className="w-full">
                <Button className="w-full">View All Batches</Button>
              </Link>
            </CardFooter>
          </Card>

          <Card className="shadow-sm h-full">
            <CardHeader>
              <CardTitle className="text-xl">All Jobs</CardTitle>
              <CardDescription>View jobs across all product types</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500 mb-4">Access and manage all jobs in one place.</p>
            </CardContent>
            <CardFooter className="mt-auto">
              <Link to="/all-jobs" className="w-full">
                <Button className="w-full">View All Jobs</Button>
              </Link>
            </CardFooter>
          </Card>

          <Card className="shadow-sm h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Cog size={20} className="text-purple-600" />
                <CardTitle className="text-xl">Product Manager</CardTitle>
              </div>
              <CardDescription>Create and manage product types</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500 mb-4">Create new products and customize existing ones.</p>
            </CardContent>
            <CardFooter className="mt-auto">
              <Link to="/admin/products" className="w-full">
                <Button variant="outline" className="w-full border-purple-600 text-purple-600 hover:bg-purple-50">
                  Manage Products
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
      
      {/* Debug info */}
      <DebugInfo 
        componentName="Index Page"
        extraInfo={{
          renderTime: new Date().toISOString(),
          renderKey,
          productTypesCount: productTypes.length,
          cacheStatus: queryClient.getQueryState(['productTypes'])?.fetchStatus || 'unknown'
        }}
        visible={true}
      />
    </div>
  );
};

export default Index;
