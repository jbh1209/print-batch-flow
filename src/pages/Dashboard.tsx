
import { Layers, FileText, Printer, AlertCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { format, formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductTypes } from "@/hooks/admin/useProductTypes";
import { useEffect } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { 
    activeBatches, 
    pendingJobs, 
    printedToday, 
    bucketsFilled,
    batchTypeStats,
    recentActivity,
    isLoading: statsLoading,
    error: statsError,
    refresh: refreshStats
  } = useDashboardStats();

  const {
    productTypes,
    isLoading: productsLoading,
    error: productsError,
    fetchProductTypes
  } = useProductTypes();

  const isLoading = statsLoading || productsLoading;
  const error = statsError || productsError;

  useEffect(() => {
    // Fetch product types when component mounts
    fetchProductTypes();
  }, []);

  const stats = [
    { 
      title: "Active Batches", 
      icon: <Layers className="h-6 w-6 text-blue-500" />, 
      value: activeBatches 
    },
    { 
      title: "Pending Jobs", 
      icon: <FileText className="h-6 w-6 text-blue-500" />, 
      value: pendingJobs 
    },
    { 
      title: "Printed Today", 
      icon: <Printer className="h-6 w-6 text-blue-500" />, 
      value: printedToday 
    },
    { 
      title: "Buckets at Capacity", 
      icon: <AlertCircle className="h-6 w-6 text-blue-500" />, 
      value: bucketsFilled 
    },
  ];

  const handleCreateBatch = (type: string) => {
    navigate(`/batches/${type.toLowerCase().replace(" ", "-")}`);
  };

  // Refresh all data
  const handleRefreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['productTypes'] });
    fetchProductTypes();
    refreshStats();
    toast.success('Dashboard data refreshed');
  };

  // Get product batch types to display - combines hardcoded Business Cards with dynamic products
  const getBatchTypes = () => {
    // Always include Business Cards first
    const batchTypes = [
      { name: "Business Cards", desc: "90x50mm, various lamination options", slug: "business-cards" }
    ];
    
    // Then add dynamic products (excluding Business Cards if it's in the database)
    if (productTypes?.length > 0) {
      productTypes.forEach(product => {
        if (product.slug !== 'business-cards') {
          batchTypes.push({
            name: product.name,
            desc: `Custom product type (${product.table_name})`,
            slug: product.slug
          });
        }
      });
    }
    
    return batchTypes;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome to BatchFlow PrintCraft. View and manage your print batches.</p>
        </div>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleRefreshAll}
          className="flex items-center gap-1"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh All
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              {stat.icon}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <>
                  <Skeleton className="h-8 w-16 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-gray-500">
                    {error ? "Error loading data" : "Updated just now"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Batch Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Batch Buckets Status</CardTitle>
            <p className="text-sm text-gray-500">Current bucket fill levels for batch types</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                </div>
              ))
            ) : (
              batchTypeStats.map((type, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{type.name}</span>
                    <span className="text-sm text-gray-500">{type.progress}/{type.total} jobs</span>
                  </div>
                  <Progress 
                    value={(type.progress / type.total) * 100} 
                    className="h-2" 
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <p className="text-sm text-gray-500">Latest batch and job actions</p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array(3).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map(activity => (
                  <div key={activity.id} className="border-b border-gray-100 pb-2 last:border-0">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm">{activity.name}</p>
                        <p className="text-xs text-gray-500">
                          {activity.action} {activity.type}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-gray-400">
                No recent activity
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create New Batch */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Create New Batch</CardTitle>
          <p className="text-sm text-gray-500">Start a new batch from available batch types</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {getBatchTypes().map((type, i) => (
              <Card key={i} className="border border-gray-200 hover:border-gray-300">
                <CardContent className="p-4">
                  <h3 className="font-bold">{type.name}</h3>
                  <p className="text-sm text-gray-500 mb-4">{type.desc}</p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => handleCreateBatch(type.slug)}
                  >
                    View Bucket
                  </Button>
                </CardContent>
              </Card>
            ))}
            
            {productsLoading && (
              <Card className="border border-gray-200 hover:border-gray-300">
                <CardContent className="p-4 flex flex-col items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">Loading products...</p>
                </CardContent>
              </Card>
            )}
          </div>
          
          {productsError && (
            <div className="mt-4 p-2 bg-red-50 text-red-700 rounded-md">
              <p>Error loading product types: {productsError}</p>
              <Button variant="outline" size="sm" onClick={fetchProductTypes} className="mt-2">
                Retry
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
