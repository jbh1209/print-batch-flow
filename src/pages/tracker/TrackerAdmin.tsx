
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Users, Building2, Printer, BarChart3, Wrench, Calendar, Package, Layers, FileSpreadsheet } from "lucide-react";
import { ProductionStagesManagement } from "@/components/tracker/admin/ProductionStagesManagement";
import { CategoriesManagement } from "@/components/tracker/admin/CategoriesManagement";
import { UserGroupsManagement } from "@/components/tracker/admin/UserGroupsManagement";
import { PrintersManagement } from "@/components/tracker/admin/PrintersManagement";
import { WorkflowDiagnosticsPanel } from "@/components/tracker/diagnostics/WorkflowDiagnosticsPanel";
import { AdminStagePermissionsManager } from "@/components/tracker/admin/AdminStagePermissionsManager";
import PublicHolidaysManagement from "@/components/tracker/admin/PublicHolidaysManagement";
import { PrintSpecificationsManagement } from "@/components/admin/PrintSpecificationsManagement";
import { BatchAllocationManagement } from "@/components/admin/BatchAllocationManagement";
import ExcelMapping from "@/pages/admin/ExcelMapping";
import { PremiumUserManagement } from "@/components/users/PremiumUserManagement";
import { UserManagementProvider } from "@/contexts/UserManagementContext";

export default function TrackerAdmin() {
  const [activeTab, setActiveTab] = useState("users");

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Production Tracker Admin</h1>
        <p className="text-muted-foreground">
          Manage production stages, categories, permissions, specifications, and system diagnostics
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-11">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="excel-mapping" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Excel Mapping
          </TabsTrigger>
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
          <TabsTrigger value="specifications" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Specifications
          </TabsTrigger>
          <TabsTrigger value="batch-allocation" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Batching
          </TabsTrigger>
          <TabsTrigger value="holidays" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Holidays
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

        <TabsContent value="users">
          <UserManagementProvider>
            <PremiumUserManagement />
          </UserManagementProvider>
        </TabsContent>

        <TabsContent value="excel-mapping">
          <ExcelMapping />
        </TabsContent>

        <TabsContent value="workflow-diagnostics">
          <WorkflowDiagnosticsPanel />
        </TabsContent>

        <TabsContent value="stages">
          <ProductionStagesManagement />
        </TabsContent>

        <TabsContent value="categories">
          <CategoriesManagement />
        </TabsContent>

        <TabsContent value="specifications">
          <PrintSpecificationsManagement />
        </TabsContent>

        <TabsContent value="batch-allocation">
          <BatchAllocationManagement />
        </TabsContent>

        <TabsContent value="holidays">
          <PublicHolidaysManagement />
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
  );
}
