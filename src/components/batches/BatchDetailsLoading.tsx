
import React from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const BatchDetailsLoading = () => {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
        <p className="text-muted-foreground">Loading batch details...</p>
      </CardContent>
    </Card>
  );
};

export default BatchDetailsLoading;
