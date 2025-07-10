import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Database, Users, FileSpreadsheet, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { useAdminAuth } from "@/hooks/useAdminAuth";

const AdminDashboard = () => {
  const { isAdmin, isLoading } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-4">You need admin privileges to access this area.</p>
          <Button asChild>
            <Link to="/">Return Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Administration</h1>
        <p className="text-muted-foreground">
          Manage system settings, users, and configuration
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Excel Mapping System
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Upload historical Excel data and create intelligent mappings to production stages
            </p>
            <Button asChild className="w-full">
              <Link to="/admin/excel-mapping">
                Manage Excel Mappings
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Manage user accounts, roles, and permissions
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/admin/users">
                Manage Users
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              System Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              View and manage production stages, categories, and system data
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/admin/system">
                System Settings
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Configure application settings, SLA targets, and business rules
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/admin/config">
                Configuration
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;