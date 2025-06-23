
import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FactoryFloorDiagnostic } from "@/components/tracker/factory/FactoryFloorDiagnostic";
import { AdminStagePermissionsManager } from "@/components/tracker/admin/AdminStagePermissionsManager";

// Simple placeholder components for admin features
const ProductionStageManager = () => (
  <div className="p-6">
    <h3 className="text-lg font-semibold mb-4">Production Stages</h3>
    <p className="text-gray-600">Production stage management coming soon...</p>
  </div>
);

const CategoryManager = () => (
  <div className="p-6">
    <h3 className="text-lg font-semibold mb-4">Categories</h3>
    <p className="text-gray-600">Category management coming soon...</p>
  </div>
);

const UserGroupManager = () => (
  <div className="p-6">
    <h3 className="text-lg font-semibold mb-4">User Groups</h3>
    <p className="text-gray-600">User group management coming soon...</p>
  </div>
);

const UserManagement = () => (
  <div className="p-6">
    <h3 className="text-lg font-semibold mb-4">Users</h3>
    <p className="text-gray-600">User management coming soon...</p>
  </div>
);

const QRCodeGenerator = () => (
  <div className="p-6">
    <h3 className="text-lg font-semibold mb-4">QR Codes</h3>
    <p className="text-gray-600">QR code generation coming soon...</p>
  </div>
);

const TrackerAdmin = () => {
  const [activeTab, setActiveTab] = useState("users");

  return (
    <div className="p-6 h-full overflow-auto">
      <h1 className="text-3xl font-bold mb-6">Tracker Administration</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="user-groups">User Groups</TabsTrigger>
          <TabsTrigger value="stages">Production Stages</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="qr-codes">QR Codes</TabsTrigger>
          <TabsTrigger value="factory-diagnostic">Factory Diagnostic</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <UserManagement />
        </TabsContent>

        <TabsContent value="user-groups" className="space-y-6">
          <UserGroupManager />
        </TabsContent>

        <TabsContent value="stages" className="space-y-6">
          <ProductionStageManager />
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <CategoryManager />
        </TabsContent>

        <TabsContent value="qr-codes" className="space-y-6">
          <QRCodeGenerator />
        </TabsContent>

        <TabsContent value="factory-diagnostic" className="space-y-6">
          <FactoryFloorDiagnostic />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TrackerAdmin;
