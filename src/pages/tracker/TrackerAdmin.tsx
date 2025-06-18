
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Users, Building2, Printer, BarChart3, Wrench } from "lucide-react";
import { ProductionStagesManagement } from "@/components/tracker/admin/ProductionStagesManagement";
import { CategoriesManagement } from "@/components/tracker/admin/CategoriesManagement";
import { UserGroupsManagement } from "@/components/tracker/admin/UserGroupsManagement";
import { PrintersManagement } from "@/components/tracker/admin/PrintersManagement";
import { WorkflowDiagnosticsPanel } from "@/components/tracker/diagnostics/WorkflowDiagnosticsPanel";
import TrackerLayout from "@/components/TrackerLayout";
import { AdminStagePermissionsManager } from "@/components/tracker/admin/AdminStagePermissionsManager";

export default function TrackerAdmin() {
  const [activeTab, setActiveTab] = useState("workflow-diagnostics");

  return (
    <TrackerLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Production Tracker Admin</h1>
          <p className="text-muted-foreground">
            Manage production stages, categories, permissions, and system diagnostics
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="workflow-diagnostics" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Diagnostics
            </TabsTrigger>
            <TabsTrigger value="stages" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Stages
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Permissions
            </TabsTrigger>
            <TabsTrigger value="user-groups" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              User Groups
            </TabsTrigger>
            <TabsTrigger value="printers" className="flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Printers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workflow-diagnostics">
            <WorkflowDiagnosticsPanel />
          </TabsContent>

          <TabsContent value="stages">
            <ProductionStagesManagement />
          </TabsContent>

          <TabsContent value="categories">
            <CategoriesManagement />
          </TabsContent>

          <TabsContent value="permissions">
            <AdminStagePermissionsManager />
          </TabsContent>

          <TabsContent value="user-groups">
            <UserGroupsManagement />
          </TabsContent>

          <TabsContent value="printers">
            <PrintersManagement />
          </TabsContent>
        </Tabs>
      </div>
    </TrackerLayout>
  );
}
