
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { Link } from "react-router-dom";

export const TrackerEmptyState = () => {
  return (
    <Card className="text-center py-12">
      <CardContent>
        <Upload className="h-16 w-16 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Jobs Found</h3>
        <p className="text-gray-600 mb-4">
          Get started by uploading an Excel file with your production jobs
        </p>
        <Button asChild>
          <Link to="/tracker/upload">Upload Excel File</Link>
        </Button>
      </CardContent>
    </Card>
  );
};
