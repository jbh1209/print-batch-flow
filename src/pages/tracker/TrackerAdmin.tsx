
import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { CategoriesManagement } from "@/components/tracker/admin/CategoriesManagement";
import { ProductionStagesManagement } from "@/components/tracker/admin/ProductionStagesManagement";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Loader2, AlertTriangle } from "lucide-react";

const TrackerAdmin = () => {
  const { isAdmin, adminExists, isLoading, error } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="container mx-auto">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading admin access...</span>
        </div>
      </div>
    );
  }

  if (!adminExists || !isAdmin) {
    return (
      <div className="container mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/tracker" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Tracker Administration</h1>
        </div>

        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <div>
              <p className="font-medium">Access Denied</p>
              <p className="text-sm mt-1">You need administrator privileges to access this section.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/tracker" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-green-600" />
          <h1 className="text-3xl font-bold">Tracker Administration</h1>
        </div>
        <p className="text-gray-600">Manage categories and production stages for the tracking system</p>
      </div>

      <CategoriesManagement />
      <ProductionStagesManagement />
    </div>
  );
};

export default TrackerAdmin;
