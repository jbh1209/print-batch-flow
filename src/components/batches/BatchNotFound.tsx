
import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface BatchNotFoundProps {
  backUrl: string;
}

const BatchNotFound = ({ backUrl }: BatchNotFoundProps) => {
  const navigate = useNavigate();

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Batch Not Found</h2>
        <p className="text-muted-foreground mb-6">The requested batch could not be found or you don't have permission to view it.</p>
        <Button onClick={() => navigate(backUrl)}>Go Back</Button>
      </CardContent>
    </Card>
  );
};

export default BatchNotFound;
