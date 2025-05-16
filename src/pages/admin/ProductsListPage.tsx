
import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { PlusCircle, Pencil, Info, Box } from 'lucide-react';
import { useProductTypes } from '@/hooks/admin/useProductTypes';
import { Separator } from '@/components/ui/separator';
import { icons } from 'lucide-react';

const ProductsListPage = () => {
  const navigate = useNavigate();
  const { productTypes, isLoading, error, fetchProductTypes } = useProductTypes();

  useEffect(() => {
    fetchProductTypes();
  }, []);

  // Render icon component based on icon name string
  const getIconComponent = (iconName: string) => {
    // Use the icons object for safe dynamic icon access
    const IconComponent = icons[iconName as keyof typeof icons] || Box;
    
    return <IconComponent className="w-5 h-5" />;
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-gray-600">Manage your product types and configurations</p>
        </div>
        <Button onClick={() => navigate('/admin/products/create')}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create Product
        </Button>
      </div>
      
      <Separator className="mb-8" />
      
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse bg-gray-50">
              <CardHeader className="h-16"></CardHeader>
              <CardContent className="h-20"></CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Products</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => fetchProductTypes()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : productTypes.length === 0 ? (
        <Card className="border-dashed text-center p-8">
          <CardHeader>
            <CardTitle>No Products Found</CardTitle>
            <CardDescription>
              You haven't created any product types yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/admin/products/create')}>
              <PlusCircle className="mr-2 h-4 w-4" /> Create Your First Product
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {productTypes.map((product) => (
            <Card key={product.id} className="relative overflow-hidden">
              <div 
                className="absolute top-0 left-0 w-2 h-full" 
                style={{ backgroundColor: product.color || '#4F46E5' }}
              ></div>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div 
                    className="p-2 rounded-md" 
                    style={{ backgroundColor: `${product.color}20` }}
                  >
                    {getIconComponent(product.icon_name)}
                  </div>
                  <div>
                    <CardTitle>{product.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1 text-sm">
                      <span className="font-mono">{product.table_name}</span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Slug:</span>
                    <span className="font-mono">{product.slug}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Job Prefix:</span>
                    <span className="font-mono">{product.job_prefix}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(`/admin/products/${product.id}`)}
                >
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
                <Link to={`/batches/${product.slug}`}>
                  <Button size="sm" variant="ghost">
                    <Info className="mr-2 h-4 w-4" /> View Jobs
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductsListPage;
