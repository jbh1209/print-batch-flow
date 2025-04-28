
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Package } from "lucide-react";
import { productConfigs } from "@/config/productTypes";

const Covers = () => {
  const navigate = useNavigate();
  const config = productConfigs["Covers"];
  
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">{config.ui.title}</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="mr-2" />
              Jobs
            </CardTitle>
            <CardDescription>
              Manage individual cover jobs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>View, create, edit and manage cover jobs before batching.</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => navigate(config.routes.jobsPath)} className="w-full">
              View Jobs
            </Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="mr-2" />
              Batches
            </CardTitle>
            <CardDescription>
              Manage cover batches
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>View and manage batches ready for production.</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => navigate(config.routes.batchesPath)} className="w-full">
              View Batches
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Covers;
