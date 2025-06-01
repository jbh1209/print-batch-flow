
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Printer, MapPin } from "lucide-react";
import { usePrinters } from "@/hooks/tracker/usePrinters";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface JobStageInstance {
  id: string;
  job_id: string;
  production_stage: {
    name: string;
    color: string;
  };
  part_name?: string;
  printer_id?: string;
  status: string;
}

interface PrinterAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobStageInstance: JobStageInstance | null;
  onAssignmentComplete: () => void;
}

export const PrinterAssignmentModal: React.FC<PrinterAssignmentModalProps> = ({
  isOpen,
  onClose,
  jobStageInstance,
  onAssignmentComplete
}) => {
  const { printers } = usePrinters();
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);

  React.useEffect(() => {
    if (jobStageInstance?.printer_id) {
      setSelectedPrinterId(jobStageInstance.printer_id);
    } else {
      setSelectedPrinterId("");
    }
  }, [jobStageInstance]);

  const handleAssignPrinter = async () => {
    if (!jobStageInstance || !selectedPrinterId) return;

    setIsAssigning(true);
    try {
      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          printer_id: selectedPrinterId,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobStageInstance.id);

      if (error) throw error;

      const printer = printers.find(p => p.id === selectedPrinterId);
      toast.success(`Assigned to ${printer?.name || 'printer'}`);
      onAssignmentComplete();
      onClose();
    } catch (err) {
      console.error('Error assigning printer:', err);
      toast.error('Failed to assign printer');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemoveAssignment = async () => {
    if (!jobStageInstance) return;

    setIsAssigning(true);
    try {
      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          printer_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobStageInstance.id);

      if (error) throw error;

      toast.success('Printer assignment removed');
      onAssignmentComplete();
      onClose();
    } catch (err) {
      console.error('Error removing printer assignment:', err);
      toast.error('Failed to remove printer assignment');
    } finally {
      setIsAssigning(false);
    }
  };

  const activePrinters = printers.filter(p => p.status === 'active');
  const selectedPrinter = printers.find(p => p.id === selectedPrinterId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Assign Printer
          </DialogTitle>
        </DialogHeader>

        {jobStageInstance && (
          <div className="space-y-6">
            {/* Job Stage Info */}
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge 
                      style={{ backgroundColor: jobStageInstance.production_stage.color }}
                      className="text-white"
                    >
                      {jobStageInstance.production_stage.name}
                    </Badge>
                    {jobStageInstance.part_name && (
                      <Badge variant="outline">
                        Part: {jobStageInstance.part_name}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    Job ID: {jobStageInstance.job_id}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Current Assignment */}
            {jobStageInstance.printer_id && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Currently Assigned</div>
                      <div className="text-sm text-gray-600">
                        {printers.find(p => p.id === jobStageInstance.printer_id)?.name || 'Unknown Printer'}
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleRemoveAssignment}
                      disabled={isAssigning}
                    >
                      Remove Assignment
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Printer Selection */}
            <div className="space-y-4">
              <Label htmlFor="printer-select">Select Printer</Label>
              <Select value={selectedPrinterId} onValueChange={setSelectedPrinterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a printer..." />
                </SelectTrigger>
                <SelectContent>
                  {activePrinters.map((printer) => (
                    <SelectItem key={printer.id} value={printer.id}>
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium">{printer.name}</div>
                          <div className="text-xs text-gray-500">
                            {printer.type} • {printer.location}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedPrinter && (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Printer className="h-4 w-4" />
                        <span className="font-medium">{selectedPrinter.name}</span>
                        <Badge variant="outline">{selectedPrinter.type}</Badge>
                      </div>
                      {selectedPrinter.location && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="h-3 w-3" />
                          {selectedPrinter.location}
                        </div>
                      )}
                      {selectedPrinter.max_paper_size && (
                        <div className="text-sm text-gray-600">
                          Max Size: {selectedPrinter.max_paper_size}
                        </div>
                      )}
                      {selectedPrinter.supported_paper_types && selectedPrinter.supported_paper_types.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {selectedPrinter.supported_paper_types.map((type, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {activePrinters.length === 0 && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="pt-4 text-center">
                  <div className="text-yellow-800">
                    No active printers available. Please check printer status or add new printers.
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onClose} disabled={isAssigning}>
                Cancel
              </Button>
              <Button 
                onClick={handleAssignPrinter}
                disabled={!selectedPrinterId || isAssigning}
              >
                {isAssigning ? 'Assigning...' : 'Assign Printer'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
