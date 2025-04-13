
import { Layers, FileText, Printer, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();

  // These would be fetched from Supabase in a real application
  const stats = [
    { title: "Active Batches", icon: <Layers className="h-6 w-6 text-blue-500" />, value: 0 },
    { title: "Pending Jobs", icon: <FileText className="h-6 w-6 text-blue-500" />, value: 0 },
    { title: "Printed Today", icon: <Printer className="h-6 w-6 text-blue-500" />, value: 0 },
    { title: "Buckets at Capacity", icon: <AlertCircle className="h-6 w-6 text-blue-500" />, value: 0 },
  ];

  // These would be fetched from Supabase in a real application
  const batchTypes = [
    { name: "Business Cards", progress: 0, total: 50 },
    { name: "Flyers A5", progress: 0, total: 50 },
    { name: "Flyers A6", progress: 0, total: 50 },
    { name: "Postcards", progress: 0, total: 50 },
  ];

  const handleCreateBatch = (type: string) => {
    navigate(`/batches/${type.toLowerCase().replace(" ", "-")}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome to BatchFlow PrintCraft. View and manage your print batches.</p>
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
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-gray-500">Loading...</p>
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
            {batchTypes.map((type, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{type.name}</span>
                  <span className="text-sm text-gray-500">{type.progress}/{type.total} jobs</span>
                </div>
                <Progress value={(type.progress / type.total) * 100} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <p className="text-sm text-gray-500">Latest batch and job actions</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-40 text-gray-400">
              No recent activity
            </div>
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

export default Dashboard;
