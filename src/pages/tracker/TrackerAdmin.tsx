
import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Users, Package, Workflow, Upload, Tags, UserCheck } from "lucide-react";
import { ProductionStagesManagement } from "@/components/tracker/admin/ProductionStagesManagement";
import { CategoriesManagement } from "@/components/tracker/admin/CategoriesManagement";
import { UserGroupsManagement } from "@/components/tracker/admin/UserGroupsManagement";
import { PrintersManagement } from "@/components/tracker/admin/PrintersManagement";
import { ExcelUpload } from "@/components/tracker/ExcelUpload";
import { BarcodeLabelsManager } from "@/components/tracker/BarcodeLabelsManager";
import { QuickStagePermissionCheck } from "@/components/tracker/admin/QuickStagePermissionCheck";

const TrackerAdmin = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Production System Administration</h1>
        <p className="text-gray-600">Configure and manage your production workflow</p>
      </div>

      <Tabs defaultValue="stages" className="space-y-6">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="stages" className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            Stages
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Groups
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="printers" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Printers
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="labels" className="flex items-center gap-2">
            <Tags className="h-4 w-4" />
            Labels
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stages">
          <ProductionStagesManagement />
        </TabsContent>

        <TabsContent value="categories">
          <CategoriesManagement />
        </TabsContent>

        <TabsContent value="groups">
          <UserGroupsManagement />
        </TabsContent>

        <TabsContent value="permissions">
          <QuickStagePermissionCheck />
        </TabsContent>

        <TabsContent value="printers">
          <PrintersManagement />
        </TabsContent>

        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Excel Upload</CardTitle>
            </CardHeader>
            <CardContent>
              <ExcelUpload />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="labels">
          <Card>
            <CardHeader>
              <CardTitle>Barcode & QR Labels</CardTitle>
            </CardHeader>
            <CardContent>
              <BarcodeLabelsManager 
                selectedJobs={[]} 
                onClose={() => {}}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TrackerAdmin;
