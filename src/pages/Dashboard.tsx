import { Layers, FileText, Printer, AlertCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";
import { useProductionDataContext, ProductionDataProvider } from "@/contexts/ProductionDataContext";
import DashboardStatsStages from "@/components/tracker/DashboardStatsStages";

const DashboardContent = () => {
  // Use the context instead of dashboard stats hook to avoid extra egress
  const {
    jobs,
    consolidatedStages,
    isLoading,
    error,
    refresh,
  } = useProductionDataContext();

  const navigate = useNavigate();

  const stats = [
    { 
      title: "Active Batches", 
      icon: <Layers className="h-6 w-6 text-blue-500" />, 
      value: jobs.filter(job => !job.is_completed).length
    },
    { 
      title: "Pending Jobs", 
      icon: <FileText className="h-6 w-6 text-blue-500" />, 
      value: jobs.filter(job => job.is_pending).length
    },
    { 
      title: "Completed Jobs", 
      icon: <Printer className="h-6 w-6 text-blue-500" />, 
      value: jobs.filter(job => job.is_completed).length
    },
    { 
      title: "Orphaned Jobs", 
      icon: <AlertCircle className="h-6 w-6 text-blue-500" />, 
      value: jobs.filter(job => job.is_orphaned).length
    },
  ];

  const handleCreateBatch = (type: string) => {
    navigate(`/batches/${type.toLowerCase().replace(" ", "-")}`);
  };

  // Feed real stage data into new summary stats block (no "Pre-Press", use actual stat generation)
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
          onClick={refresh}
          className="flex items-center gap-1"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
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
                    Updated just now
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Jobs by Status</CardTitle>
            <p className="text-sm text-gray-500">Current distribution of jobs across workflow stages</p>
          </CardHeader>
          <CardContent>
            <DashboardStatsStages stages={consolidatedStages} jobs={jobs} isLoading={isLoading} />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: "Business Cards", desc: "90x50mm, various lamination options" },
              { name: "Flyers A5", desc: "A5 flyers with various paper options" },
              { name: "Flyers A6", desc: "A6 flyers with various paper options" },
              { name: "Postcards", desc: "Various paper types and weights" },
            ].map((type, i) => (
              <Card key={i} className="border border-gray-200 hover:border-gray-300">
                <CardContent className="p-4">
                  <h3 className="font-bold">{type.name}</h3>
                  <p className="text-sm text-gray-500 mb-4">{type.desc}</p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => handleCreateBatch(type.name)}
                  >
                    View Bucket
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const Dashboard = () => (
  <ProductionDataProvider>
    <DashboardContent />
  </ProductionDataProvider>
);

export default Dashboard;
