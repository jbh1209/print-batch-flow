
import React from "react";
import { MobileFactoryFloor } from "@/components/tracker/factory/MobileFactoryFloor";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import { Smartphone, Monitor } from "lucide-react";

const MobileFactory = () => {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Monitor className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Mobile Experience Required
            </h2>
            <p className="text-gray-600 mb-6">
              This factory floor interface is optimized for mobile devices and touch screens. 
              Please access this page from a mobile device or tablet for the best experience.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Smartphone className="h-4 w-4" />
              <span>Use your phone or tablet</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <MobileFactoryFloor />;
};

export default MobileFactory;
