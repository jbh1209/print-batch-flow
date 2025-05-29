
import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { CategoriesManagement } from "@/components/tracker/admin/CategoriesManagement";
import { ProductionStagesManagement } from "@/components/tracker/admin/ProductionStagesManagement";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Alert, AlertDescription } from "@/components/ui/alert";

const TrackerAdmin = () => {
  const { isAdmin, adminExists, isLoading, error } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="container mx-auto">
        <LoadingSpinner message="Loading admin access..." />
      </div>
    );
  }

  if (error) {
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

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Error loading admin access: {error}
          </AlertDescription>
        </Alert>
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

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div>
              <p className="font-medium">Access Denied</p>
              <p className="text-sm mt-1">You need administrator privileges to access this section.</p>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
};

export default TrackerAdmin;
