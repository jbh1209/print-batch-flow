import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Barcode, File, ListChecks, Upload, Users, Zap } from "lucide-react";

export const TrackerQuickActions = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3">
          <Button asChild variant="outline" className="justify-start">
            <Link to="/tracker/upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Excel
            </Link>
          </Button>

          <Button asChild variant="outline" className="justify-start">
            <Link to="/tracker/jobs" className="flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
              Manage Jobs
            </Link>
          </Button>

          <Button asChild variant="outline" className="justify-start">
            <Link to="/tracker/labels" className="flex items-center gap-2">
              <Barcode className="h-4 w-4" />
              Barcode Labels
            </Link>
          </Button>
          
          <Button asChild variant="outline" className="justify-start">
            <Link to="/tracker/factory-floor" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Factory Floor Dashboard
            </Link>
          </Button>
          
          <Button asChild variant="outline" className="justify-start">
            <Link to="/tracker/export" className="flex items-center gap-2">
              <File className="h-4 w-4" />
              Export Data
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
