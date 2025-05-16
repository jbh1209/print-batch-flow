
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { DebugInfo } from "@/components/ui/debug-info";
import { generateRenderKey } from "@/utils/cacheUtils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { CreditCard, Files, Cog } from "lucide-react";

const Index = () => {
  const renderKey = generateRenderKey();
  
  return (
    <div>
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-2">Print Management Dashboard</h1>
        <p className="text-gray-600 mb-8">Manage your print jobs and batches</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="shadow-md">
            <CardHeader className="bg-blue-50">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <CardTitle>Business Cards</CardTitle>
              </div>
              <CardDescription>Manage business card print jobs</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-gray-600 mb-4">Create and manage business card jobs and batches.</p>
            </CardContent>
            <CardFooter className="flex gap-2 border-t pt-4">
              <Button asChild variant="default">
                <Link to="/batches/business-cards/jobs">View Jobs</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/batches/business-cards">View Batches</Link>
              </Button>
            </CardFooter>
          </Card>

          <Card className="shadow-md">
            <CardHeader className="bg-orange-50">
              <div className="flex items-center gap-2">
                <Files className="h-5 w-5 text-orange-600" />
                <CardTitle>Flyers</CardTitle>
              </div>
              <CardDescription>Manage flyer print jobs</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-gray-600 mb-4">Create and manage flyer jobs and batches.</p>
            </CardContent>
            <CardFooter className="flex gap-2 border-t pt-4">
              <Button asChild variant="default">
                <Link to="/batches/flyers/jobs">View Jobs</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/batches/flyers">View Batches</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-semibold mb-2">All Batches</h2>
            <p className="text-gray-500 mb-4">View batches across all product types.</p>
            <Link to="/batches">
              <Button>View All Batches</Button>
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-semibold mb-2">All Jobs</h2>
            <p className="text-gray-500 mb-4">View jobs across all product types.</p>
            <Link to="/all-jobs">
              <Button>View All Jobs</Button>
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
              <Cog size={20} className="text-purple-600" />
              Product Manager
            </h2>
            <p className="text-gray-500 mb-4">Create and manage custom product types.</p>
            <Link to="/admin/products">
              <Button variant="outline" className="border-purple-600 text-purple-600 hover:bg-purple-50">
                Manage Products
              </Button>
            </Link>
          </div>
        </div>
      </div>
      
      {/* Debug info */}
      <DebugInfo 
        componentName="Index Page"
        extraInfo={{
          renderTime: new Date().toISOString(),
          renderKey
        }}
        visible={true}
      />
    </div>
  );
};

export default Index;
