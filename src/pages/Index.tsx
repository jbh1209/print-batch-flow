
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers, CreditCard, Mail, FileText, Box } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  const productTypes = [
    {
      name: "Business Cards",
      icon: <CreditCard className="h-6 w-6 mb-2" />,
      description: "Manage business card batches and jobs",
      link: "/batches/business-cards"
    },
    {
      name: "Postcards",
      icon: <Mail className="h-6 w-6 mb-2" />,
      description: "Create and manage postcard print batches",
      link: "/batches/postcards"
    },
    {
      name: "Flyers",
      icon: <FileText className="h-6 w-6 mb-2" />,
      description: "Organize flyer production batches",
      link: "/batches/flyers"
    },
    {
      name: "Product Boxes",
      icon: <Box className="h-6 w-6 mb-2" />,
      description: "Manage product box printing",
      link: "/batches/boxes"
    }
  ];

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Welcome to BatchFlow</h1>
        <p className="text-gray-600 mb-6">Your printing batch management solution</p>
        
        <div className="flex justify-center gap-4">
          <Button asChild size="lg">
            <Link to="/batches/all">View All Batches</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/batches/business-cards/jobs/new">Create New Job</Link>
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
            <CardFooter className="bg-gray-50 p-4 flex justify-center">
              <Button variant="ghost" asChild>
                <Link to={product.link}>Manage {product.name}</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Card>
          <CardHeader>
            <CardTitle>Recent Batches</CardTitle>
            <CardDescription>View and manage all your production batches</CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            <Button asChild>
              <Link to="/batches/all" className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                View All Batches
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
