
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, Users, Layers, Printer } from "lucide-react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductionStagesManagement } from "@/components/tracker/admin/ProductionStagesManagement";
import { CategoriesManagement } from "@/components/tracker/admin/CategoriesManagement";
import { PrintersManagement } from "@/components/tracker/admin/PrintersManagement";
import { UserGroupManager } from "@/components/tracker/UserGroupManager";
import { UserGroupsManagement } from "@/components/tracker/admin/UserGroupsManagement";
import { UserManagementProvider } from "@/contexts/UserManagementContext";
import { SimpleUserManagement } from "@/components/users/SimpleUserManagement";

const TrackerAdmin = () => {
  const [activeTab, setActiveTab] = useState("stages");

  return (
    <div className="p-6">
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
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Tracker Administration</h1>
        </div>
        <p className="text-gray-600">
          Manage production stages, categories, printers, users and system settings
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="stages" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Production Stages
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="printers" className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Printers
          </TabsTrigger>
          <TabsTrigger value="user-groups" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Groups
          </TabsTrigger>
          <TabsTrigger value="group-assignments" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Group Assignments
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stages" className="space-y-6">
          <ProductionStagesManagement />
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <CategoriesManagement />
        </TabsContent>

        <TabsContent value="printers" className="space-y-6">
          <PrintersManagement />
        </TabsContent>

        <TabsContent value="user-groups" className="space-y-6">
          <UserGroupsManagement />
        </TabsContent>

        <TabsContent value="group-assignments" className="space-y-6">
          <UserGroupManager showAllUsers={true} />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <UserManagementProvider>
            <SimpleUserManagement />
          </UserManagementProvider>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TrackerAdmin;
