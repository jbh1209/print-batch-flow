
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers, CreditCard, Mail, FileText, Box, ClipboardList, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Separator } from "@/components/ui/separator";

const Index = () => {
  const productTypes = [
    {
      name: "Business Cards",
      icon: <CreditCard className="h-6 w-6 mb-2" />,
      description: "Manage business card batches and jobs",
      batchesLink: "/batches/business-cards",
      jobsLink: "/batches/business-cards/jobs",
      createJobLink: "/batches/business-cards/jobs/new"
    },
    {
      name: "Postcards",
      icon: <Mail className="h-6 w-6 mb-2" />,
      description: "Create and manage postcard print batches",
      batchesLink: "/batches/postcards",
      jobsLink: "/batches/postcards/jobs",
      createJobLink: "/batches/postcards/jobs/new"
    },
    {
      name: "Flyers",
      icon: <FileText className="h-6 w-6 mb-2" />,
      description: "Organize flyer production batches",
      batchesLink: "/batches/flyers",
      jobsLink: "/batches/flyers/jobs",
      createJobLink: "/batches/flyers/jobs/new"
    },
    {
      name: "Product Boxes",
      icon: <Box className="h-6 w-6 mb-2" />,
      description: "Manage product box printing",
      batchesLink: "/batches/boxes",
      jobsLink: "/batches/boxes/jobs",
      createJobLink: "/batches/boxes/jobs/new"
    }
  ];

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Welcome to BatchFlow</h1>
        <p className="text-gray-600 mb-6">Your printing batch management solution</p>
        
        <div className="flex justify-center gap-4">
          <Button asChild size="lg">
            <Link to="/batches">View All Batches</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/all-jobs">View All Jobs</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {productTypes.map((product) => (
          <Card key={product.name} className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="flex justify-center">{product.icon}</div>
              <CardTitle>{product.name}</CardTitle>
              <CardDescription>{product.description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 pb-3 flex flex-col gap-2">
              <Button variant="default" asChild size="sm" className="w-full">
                <Link to={product.jobsLink} className="flex items-center justify-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  View Jobs
                </Link>
              </Button>
              <Button variant="outline" asChild size="sm" className="w-full">
                <Link to={product.batchesLink} className="flex items-center justify-center gap-2">
                  <Layers className="h-4 w-4" />
                  Manage Batches
                </Link>
              </Button>
            </CardContent>
            <CardFooter className="bg-gray-50 p-3 flex justify-center">
              <Button variant="ghost" size="sm" asChild className="w-full">
                <Link to={product.createJobLink} className="flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create New Job
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Separator className="my-8" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Recent Batches
            </CardTitle>
            <CardDescription>View and manage all your production batches</CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            <Button asChild>
              <Link to="/batches" className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                View All Batches
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Print Jobs
            </CardTitle>
            <CardDescription>Manage all your print jobs across product types</CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            <Button asChild>
              <Link to="/all-jobs" className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                View All Jobs
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
