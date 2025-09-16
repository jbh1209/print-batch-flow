import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Printer, MapPin, Users, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserStagePermissions } from "@/hooks/tracker/useUserStagePermissions";
import { useAuth } from "@/hooks/useAuth";

interface PrinterStage {
  id: string;
  name: string;
  description?: string;
  location?: string;
}

interface PrinterQueueSelectorProps {
  selectedPrinterId?: string;
  onPrinterChange: (printerId: string | undefined, printerInfo: PrinterStage | null) => void;
  jobStats?: {
    ready: number;
    scheduled: number;
    waiting: number;
    active: number;
  };
}

export const PrinterQueueSelector: React.FC<PrinterQueueSelectorProps> = ({
  selectedPrinterId,
  onPrinterChange,
  jobStats
}) => {
  const [printerStages, setPrinterStages] = useState<PrinterStage[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { accessibleStages, isLoading: permissionsLoading, isAdmin } = useUserStagePermissions(user?.id);

  useEffect(() => {
    loadPrinterStages();
  }, [accessibleStages, isAdmin]);

  const loadPrinterStages = async () => {
    try {
      // Wait for permissions to load
      if (permissionsLoading || !accessibleStages) {
        return;
      }

      // Get ALL production stages first, then filter by permissions
      const { data, error } = await supabase
        .from('production_stages')
        .select('id, name, description')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      // Filter stages based on user permissions
      let allowedStages = data || [];
      
      if (!isAdmin) {
        // For non-admin users, only show stages they can work on or manage
        const accessibleStageIds = accessibleStages
          .filter(stage => stage.can_work || stage.can_manage)
          .map(stage => stage.stage_id);
        
        allowedStages = data.filter(stage => accessibleStageIds.includes(stage.id));
        
        console.log('🔧 Permission filtering applied:', {
          totalStages: data.length,
          accessibleStageIds,
          filteredStages: allowedStages.length,
          stageNames: allowedStages.map(s => s.name)
        });
      }

      // Add location info based on stage name patterns
      const stagesWithLocation = allowedStages.map(stage => ({
        ...stage,
        location: getLocationFromStageName(stage.name)
      }));

      setPrinterStages(stagesWithLocation);

      // Auto-select if user has only one accessible stage
      if (stagesWithLocation.length === 1 && !selectedPrinterId) {
        const singleStage = stagesWithLocation[0];
        console.log('🎯 Auto-selecting single accessible stage:', singleStage.name);
        handlePrinterSelect(singleStage.id);
      }

      // Clear localStorage if saved stage is no longer accessible
      const savedQueue = localStorage.getItem('selected_printer_queue');
      if (savedQueue && selectedPrinterId) {
        const isStillAccessible = stagesWithLocation.some(stage => stage.id === selectedPrinterId);
        if (!isStillAccessible) {
          console.log('🧹 Clearing inaccessible saved stage from localStorage');
          handleClearSelection();
        }
      }
      
    } catch (error) {
      console.error('Error loading printer stages:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLocationFromStageName = (stageName: string): string => {
    const name = stageName.toLowerCase();
    if (name.includes('hp 12000') || name.includes('hp12000')) {
      return 'Production Floor A';
    }
    if (name.includes('hp 7900') || name.includes('hp7900')) {
      return 'Production Floor B';
    }
    if (name.includes('t250')) {
      return 'Digital Department';
    }
    if (name.includes('print')) {
      return 'Print Department';
    }
    return 'Production Floor';
  };

  const selectedPrinter = printerStages.find(p => p.id === selectedPrinterId);

  const handleClearSelection = () => {
    onPrinterChange(undefined, null);
    // Clear from localStorage
    localStorage.removeItem('selected_printer_queue');
  };

  const handlePrinterSelect = (printerId: string) => {
    const printer = printerStages.find(p => p.id === printerId);
    onPrinterChange(printerId, printer || null);
    // Persist to localStorage
    localStorage.setItem('selected_printer_queue', JSON.stringify({
      id: printerId,
      name: printer?.name,
      location: printer?.location
    }));
  };

  if (loading || permissionsLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-gray-400" />
            <span className="text-gray-600">Loading accessible stages...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show message if user has no accessible stages
  if (!isAdmin && printerStages.length === 0) {
    return (
      <Card className="mb-6 border-l-4 border-l-orange-500">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <span className="text-orange-700 font-medium">No accessible stages found</span>
          </div>
          <p className="text-sm text-gray-600 mt-2 ml-7">
            You don't have permission to access any production stages. Please contact your administrator.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6 border-l-4 border-l-blue-500">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-gray-900">Production Stage</span>
            </div>
            
            <Select value={selectedPrinterId || ""} onValueChange={handlePrinterSelect}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select production stage..." />
              </SelectTrigger>
              <SelectContent>
                {printerStages.map(stage => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{stage.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {stage.location}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedPrinterId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSelection}
                className="text-gray-600"
              >
                Show All Stages
              </Button>
            )}
          </div>

          {selectedPrinter && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4 text-gray-500" />
                <span className="text-gray-700">{selectedPrinter.location}</span>
              </div>
              
              {jobStats && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-green-700 font-medium">{jobStats.ready} Ready</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-blue-700 font-medium">{jobStats.active} Active</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-yellow-700 font-medium">{jobStats.scheduled} Scheduled</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedPrinter?.description && (
          <p className="text-sm text-gray-600 mt-2 ml-7">
            {selectedPrinter.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
};