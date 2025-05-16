
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { 
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Pen, Trash, PlusCircle, CreditCard, FileText, Package, Sticker, Book } from 'lucide-react';
import { toast } from 'sonner';
import { DebugInfo } from '@/components/ui/debug-info';
import { generateRenderKey } from '@/utils/cacheUtils';

// Type for product with fields and options
type ProductType = {
  id: string;
  name: string;
  slug: string;
  table_name: string;
  job_prefix: string;
  icon_name: string;
  color: string;
  created_at: string;
  updated_at: string;
  fields_count: number;
};

// Icon mapping for dynamic icons
const iconMapping: Record<string, React.ReactNode> = {
  "CreditCard": <CreditCard />,
  "FileText": <FileText />,
  "Package": <Package />,
  "Sticker": <Sticker />,
  "Book": <Book />,
};

const ProductsListPage = () => {
  const renderKey = generateRenderKey();
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      
      // Fetch products with a count of their fields
      const { data, error } = await supabase
        .from('product_types')
        .select(`
          *,
          fields_count:product_fields(count)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Transform the data to flatten the fields_count
      const transformedData = data.map((product) => ({
        ...product,
        fields_count: product.fields_count[0]?.count || 0
      }));

      setProducts(transformedData);
    } catch (error: any) {
      toast.error(`Failed to fetch products: ${error.message || 'Unknown error'}`);
      console.error('Error fetching products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      // Delete product fields options first (to maintain referential integrity)
      const { data: fields, error: fieldsError } = await supabase
        .from('product_fields')
        .select('id')
        .eq('product_type_id', productId);

      if (fieldsError) throw fieldsError;
      
      if (fields && fields.length > 0) {
        const fieldIds = fields.map(field => field.id);
        
        // Delete options for all fields
        const { error: optionsError } = await supabase
          .from('product_field_options')
          .delete()
          .in('product_field_id', fieldIds);
          
        if (optionsError) throw optionsError;
        
        // Delete the fields
        const { error: deleteFieldsError } = await supabase
          .from('product_fields')
          .delete()
          .eq('product_type_id', productId);
          
        if (deleteFieldsError) throw deleteFieldsError;
      }
      
      // Finally delete the product
      const { error: deleteProductError } = await supabase
        .from('product_types')
        .delete()
        .eq('id', productId);
        
      if (deleteProductError) throw deleteProductError;
      
      // Update the UI by removing the deleted product
      setProducts(products.filter(product => product.id !== productId));
      toast.success('Product deleted successfully');
      
    } catch (error: any) {
      toast.error(`Failed to delete product: ${error.message || 'Unknown error'}`);
      console.error('Error deleting product:', error);
    }
  };

  const getIconForProduct = (iconName: string) => {
    return iconMapping[iconName] || <CreditCard />;
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Products</h1>
        <Button onClick={() => navigate('/admin/products/create')}>
          <PlusCircle size={16} className="mr-2" />
          Create New Product
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product Types</CardTitle>
          <CardDescription>
            Manage your product types and their fields
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No products have been created yet.</p>
              <Button onClick={() => navigate('/admin/products/create')}>
                <PlusCircle size={16} className="mr-2" />
                Create Your First Product
              </Button>
            </div>
          ) : (
            <Table>
              <TableCaption>List of all product types</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead className="text-center">Fields</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div 
                        className="p-2 rounded-md" 
                        style={{ backgroundColor: product.color || '#4F46E5', color: 'white' }}
                      >
                        {getIconForProduct(product.icon_name)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.slug}</TableCell>
                    <TableCell>{product.table_name}</TableCell>
                    <TableCell>{product.job_prefix}</TableCell>
                    <TableCell className="text-center">{product.fields_count}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/admin/products/${product.id}`}>
                            <Pen size={14} className="mr-1" /> Edit
                          </Link>
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedProduct(product.id)}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash size={14} className="mr-1" /> Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the product type "{product.name}" and all its fields.
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                className="bg-red-500 hover:bg-red-600"
                                onClick={() => handleDeleteProduct(product.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DebugInfo
        componentName="ProductsListPage"
        extraInfo={{ productsCount: products.length, renderKey }}
      />
    </div>
  );
};

export default ProductsListPage;
