
import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserGroupsManagement } from "@/components/tracker/admin/UserGroupsManagement";
import { DuplicateJobManager } from "@/components/tracker/jobs/DuplicateJobManager";
import { ProductionStagesManagement } from "@/components/tracker/admin/ProductionStagesManagement";
import { CategoriesManagement } from "@/components/tracker/admin/CategoriesManagement";

const TrackerAdmin = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Tracker Administration</h1>
        <p className="text-gray-600">Manage users, permissions, production stages, and system data</p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="production">Production Management</TabsTrigger>
          <TabsTrigger value="data">Data Management</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <UserGroupsManagement />
        </TabsContent>

        <TabsContent value="production" className="space-y-6">
          <CategoriesManagement />
          <ProductionStagesManagement />
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <DuplicateJobManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TrackerAdmin;
