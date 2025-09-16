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
import { Printer, MapPin, Users, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    loadPrinterStages();
  }, []);

  const loadPrinterStages = async () => {
    try {
      const { data, error } = await supabase
        .from('production_stages')
        .select('id, name, description')
        .or('name.ilike.%print%,name.ilike.%HP%,name.ilike.%T250%')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      // Add location info based on stage name patterns
      const stagesWithLocation = (data || []).map(stage => ({
        ...stage,
        location: getLocationFromStageName(stage.name)
      }));

      setPrinterStages(stagesWithLocation);
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

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-gray-400" />
            <span className="text-gray-600">Loading printer queues...</span>
          </div>
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
              <span className="font-medium text-gray-900">Print Queue</span>
            </div>
            
            <Select value={selectedPrinterId || ""} onValueChange={handlePrinterSelect}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select printer queue..." />
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
                Show All Queues
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