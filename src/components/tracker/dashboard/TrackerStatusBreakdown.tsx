
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  FileSpreadsheet, 
  TrendingUp,
  Package,
  CheckCircle
} from "lucide-react";

const STATUSES = ["Pre-Press", "Printing", "Finishing", "Packaging", "Shipped", "Completed"];

interface TrackerStatusBreakdownProps {
  stats: {
    total: number;
    statusCounts: Record<string, number>;
  };
}

export const TrackerStatusBreakdown = ({ stats }: TrackerStatusBreakdownProps) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Pre-Press": return <FileSpreadsheet className="h-4 w-4" />;
      case "Printing": return <BarChart3 className="h-4 w-4" />;
      case "Finishing": return <TrendingUp className="h-4 w-4" />;
      case "Packaging": return <Package className="h-4 w-4" />;
      case "Shipped": return <CheckCircle className="h-4 w-4" />;
      case "Completed": return <CheckCircle className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      "Pre-Press": "bg-blue-100 text-blue-800",
      "Printing": "bg-yellow-100 text-yellow-800",
      "Finishing": "bg-purple-100 text-purple-800", 
      "Packaging": "bg-orange-100 text-orange-800",
      "Shipped": "bg-green-100 text-green-800",
      "Completed": "bg-gray-100 text-gray-800"
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jobs by Status</CardTitle>
        <CardDescription>Current distribution of jobs across workflow stages</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {STATUSES.map(status => (
            <div key={status} className="text-center">
              <Badge className={`mb-2 ${getStatusColor(status)}`}>
                <span className="flex items-center gap-1">
                  {getStatusIcon(status)}
                  {status}
                </span>
              </Badge>
              <div className="text-2xl font-bold">{stats.statusCounts[status] || 0}</div>
              <div className="text-xs text-gray-500">jobs</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
