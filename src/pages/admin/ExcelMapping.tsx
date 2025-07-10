import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Database, Filter, Map } from "lucide-react";
import { Link } from "react-router-dom";
import { AdminExcelUpload } from "@/components/admin/AdminExcelUpload";
import { MappingLibrary } from "@/components/admin/MappingLibrary";
import { ExcelDataAnalyzer } from "@/components/admin/ExcelDataAnalyzer";
import { useAdminAuth } from "@/hooks/useAdminAuth";

const ExcelMapping = () => {
  const { toast } = useToast();
  const { isAdmin, isLoading } = useAdminAuth();
  const [uploadedData, setUploadedData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("upload");

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
          <p className="text-muted-foreground mb-4">You need admin privileges to access this page.</p>
          <Button asChild>
            <Link to="/">Return Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const handleDataUploaded = (data: any) => {
    setUploadedData(data);
    setActiveTab("analyze");
    toast({
      title: "Data Uploaded Successfully",
      description: `Uploaded ${data.jobs?.length || 0} records for analysis`,
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Admin
            </Link>
          </Button>
        </div>
        <h1 className="text-3xl font-bold">Excel Import Mapping System</h1>
        <p className="text-muted-foreground">
          Upload historical Excel data and create intelligent mappings to production stages
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Data
          </TabsTrigger>
          <TabsTrigger 
            value="analyze" 
            className="flex items-center gap-2"
            disabled={!uploadedData}
          >
            <Filter className="h-4 w-4" />
            Analyze & Filter
          </TabsTrigger>
          <TabsTrigger value="mapping" className="flex items-center gap-2">
            <Map className="h-4 w-4" />
            Create Mappings
          </TabsTrigger>
          <TabsTrigger value="library" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Mapping Library
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Historical Excel Data</CardTitle>
              <p className="text-sm text-muted-foreground">
                Upload Excel files containing historical work order data to build your mapping library.
                Supports both standard and matrix/pivot table formats.
              </p>
            </CardHeader>
            <CardContent>
              <AdminExcelUpload onDataUploaded={handleDataUploaded} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analyze" className="space-y-6">
          {uploadedData ? (
            <ExcelDataAnalyzer 
              data={uploadedData} 
              onMappingCreated={() => setActiveTab("library")}
            />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <p className="text-muted-foreground">Upload data first to start analyzing</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="mapping" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Smart Mapping Tools</CardTitle>
              <p className="text-sm text-muted-foreground">
                Create intelligent mappings using AI-powered text analysis and pattern recognition.
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">Coming soon: AI-powered mapping tools</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="library" className="space-y-6">
          <MappingLibrary />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ExcelMapping;