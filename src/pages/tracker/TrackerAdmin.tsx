
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Users, Shield, Database, Layers, Tag } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { GroupStagePermissions } from "@/components/tracker/admin/GroupStagePermissions";
import { ProductionStagesManagement } from "@/components/tracker/admin/ProductionStagesManagement";
import { CategoriesManagement } from "@/components/tracker/admin/CategoriesManagement";
import { UserGroupsManagement } from "@/components/tracker/admin/UserGroupsManagement";
import { QuickStagePermissionCheck } from "@/components/tracker/admin/QuickStagePermissionCheck";

const TrackerAdmin = () => {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Shield className="h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-red-700">Access Denied</h2>
            <p className="text-red-600 text-center">
              You need administrator privileges to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Tracker Administration</h1>
      </div>

      <Tabs defaultValue="permissions" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="stages" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Stages
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Groups
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="permissions" className="space-y-6">
          <GroupStagePermissions />
        </TabsContent>

        <TabsContent value="stages" className="space-y-6">
          <ProductionStagesManagement />
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <CategoriesManagement />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <UserGroupsManagement />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="space-y-6">
            <QuickStagePermissionCheck />
            
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Additional system settings coming soon...</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TrackerAdmin;
