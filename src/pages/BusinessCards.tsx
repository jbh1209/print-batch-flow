
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Plus, Users, Layers, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const BusinessCards = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/printstream" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Printstream
            </Link>
          </Button>
        </div>
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <CreditCard className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Business Cards</h1>
          <p className="text-gray-600 mb-6">Manage your business card printing jobs and batches</p>
          
          <div className="flex justify-center gap-4">
            <Button asChild size="lg">
              <Link to="/printstream/batches/business-cards/jobs/new">Create New Job</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/printstream/batches/business-cards/batches">View All Batches</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="overflow-hidden hover:shadow-lg transition-shadow">
          <CardHeader className="text-center">
            <div className="flex justify-center">
              <Plus className="h-8 w-8 mb-2 text-primary" />
            </div>
            <CardTitle>Jobs Management</CardTitle>
            <CardDescription>Create, edit, and manage individual business card jobs</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              Upload artwork, set specifications, and track individual business card orders
            </p>
          </CardContent>
          <CardFooter className="bg-gray-50 p-4 flex justify-center">
            <Button asChild>
              <Link to="/printstream/batches/business-cards/jobs">Manage Jobs</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="overflow-hidden hover:shadow-lg transition-shadow">
          <CardHeader className="text-center">
            <div className="flex justify-center">
              <Layers className="h-8 w-8 mb-2 text-primary" />
            </div>
            <CardTitle>Batch Processing</CardTitle>
            <CardDescription>Group jobs into efficient production batches</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              Organize multiple jobs by paper type, lamination, and production requirements
            </p>
          </CardContent>
          <CardFooter className="bg-gray-50 p-4 flex justify-center">
            <Button asChild>
              <Link to="/printstream/batches/business-cards/batches">View Batches</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="mt-12">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common business card management tasks</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-4 pb-6">
            <Button variant="outline" asChild>
              <Link to="/printstream/batches/business-cards/jobs" className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                View All Jobs
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/printstream/batches/business-cards/jobs/new" className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create New Job
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BusinessCards;
