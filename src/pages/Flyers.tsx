
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { FlyerOverview } from "@/components/flyers/FlyerOverview";
import FlyerJobsPage from "@/pages/generic/FlyerJobsPage";
import FlyerBatches from "@/components/flyers/FlyerBatches";

const Flyers = () => {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/batchflow" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to BatchFlow
            </Link>
          </Button>
        </div>
        <div className="flex items-center gap-4">
          <FileText className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Flyers</h1>
            <p className="text-muted-foreground">Manage your flyer printing jobs and batches</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="batches">Batches</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-6">
          <FlyerOverview />
        </TabsContent>
        
        <TabsContent value="jobs" className="mt-6">
          <FlyerJobsPage />
        </TabsContent>
        
        <TabsContent value="batches" className="mt-6">
          <FlyerBatches />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Flyers;
