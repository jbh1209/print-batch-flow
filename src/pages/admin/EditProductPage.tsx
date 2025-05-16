
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { useProductTypes } from '@/hooks/admin/useProductTypes';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft } from 'lucide-react';

const EditProductPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getProductDetails } = useProductTypes();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productData, setProductData] = useState<any>(null);

  useEffect(() => {
    if (id) {
      loadProductData(id);
    }
  }, [id]);

  const loadProductData = async (productId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getProductDetails(productId);
      setProductData(data);
    } catch (err: any) {
      console.error("Error loading product data:", err);
      setError(err.message || "Failed to load product details");
      toast.error("Failed to load product details");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Button variant="ghost" className="mb-6" onClick={() => navigate('/admin/products')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Products
        </Button>
        <Skeleton className="h-12 w-2/3 mb-6" />
        <Separator className="mb-6" />
        <div className="space-y-6">
          <Skeleton className="h-[400px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Button variant="ghost" className="mb-6" onClick={() => navigate('/admin/products')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Products
        </Button>
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Product</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => id && loadProductData(id)}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!productData || !productData.product) {
    return (
      <div className="container mx-auto py-8">
        <Button variant="ghost" className="mb-6" onClick={() => navigate('/admin/products')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Products
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Product Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p>The product you're looking for could not be found.</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => navigate('/admin/products')}>
              Return to Products
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const { product, fields } = productData;

  return (
    <div className="container mx-auto py-8">
      <Button variant="ghost" className="mb-6" onClick={() => navigate('/admin/products')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Products
      </Button>
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="text-gray-600">Edit product configuration and fields</p>
        </div>
      </div>
      
      <Separator className="mb-6" />
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
          <CardDescription>
            Basic information about the product
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Product Name</p>
              <p className="font-medium">{product.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Slug</p>
              <p className="font-mono">{product.slug}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Table Name</p>
              <p className="font-mono">{product.table_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Job Prefix</p>
              <p className="font-mono">{product.job_prefix}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Icon</p>
              <p className="font-medium">{product.icon_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Color</p>
              <div className="flex items-center">
                <div 
                  className="h-6 w-6 rounded mr-2"
                  style={{ backgroundColor: product.color }}
                ></div>
                <p className="font-mono">{product.color}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Product Fields</CardTitle>
          <CardDescription>
            Fields defined for this product
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <p className="text-center py-8 text-gray-500">No fields defined for this product.</p>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Required</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Options</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {fields.map((field: any) => (
                    <tr key={field.id}>
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">{field.field_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{field.field_type}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {field.is_required ? 'Yes' : 'No'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {field.options && field.options.length > 0 ? (
                          <div className="space-y-1">
                            {field.options.map((option: any) => (
                              <div key={option.id} className="text-xs">
                                <span className="font-medium">{option.display_name}</span>
                                <span className="text-gray-500 ml-1">({option.option_value})</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-500">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-sm text-gray-500">
            Editing fields is not yet supported. You can delete this product and create a new one with updated fields.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default EditProductPage;
