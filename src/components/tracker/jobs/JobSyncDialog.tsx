import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  RefreshCw, 
  Upload, 
  FileText, 
  AlertCircle,
  CheckCircle,
  RotateCcw
} from "lucide-react";
import { useAdvancedJobOperations } from "@/hooks/tracker/useAdvancedJobOperations";
import { toast } from "sonner";

interface JobSyncDialogProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  onJobUpdated: () => void;
}

export const JobSyncDialog: React.FC<JobSyncDialogProps> = ({
  isOpen,
  onClose,
  job,
  onJobUpdated
}) => {
  const [syncMethod, setSyncMethod] = useState<'manual' | 'api' | 'file'>('manual');
  const [manualData, setManualData] = useState({
    customer: job?.customer || '',
    reference: job?.reference || '',
    due_date: job?.due_date || '',
    quantity: job?.qty || '',
    location: job?.location || ''
  });
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [jsonData, setJsonData] = useState('');

  const { isProcessing, syncJobData } = useAdvancedJobOperations();

  const handleManualSync = async () => {
    const success = await syncJobData(job.id, manualData);
    if (success) {
      onJobUpdated();
      onClose();
    }
  };

  const handleApiSync = async () => {
    if (!apiEndpoint.trim()) {
      toast.error('Please enter API endpoint');
      return;
    }

    try {
      const response = await fetch(apiEndpoint);
      const data = await response.json();
      
      const success = await syncJobData(job.id, data);
      if (success) {
        onJobUpdated();
        onClose();
      }
    } catch (err) {
      toast.error('Failed to fetch data from API');
    }
  };

  const handleJsonSync = async () => {
    try {
      const data = JSON.parse(jsonData);
      const success = await syncJobData(job.id, data);
      if (success) {
        onJobUpdated();
        onClose();
      }
    } catch (err) {
      toast.error('Invalid JSON format');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          setJsonData(JSON.stringify(data, null, 2));
        } catch (err) {
          toast.error('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleClose = () => {
    setManualData({
      customer: job?.customer || '',
      reference: job?.reference || '',
      due_date: job?.due_date || '',
      quantity: job?.qty || '',
      location: job?.location || ''
    });
    setApiEndpoint('');
    setJsonData('');
    setSyncMethod('manual');
    onClose();
  };

  if (!job) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-600" />
            Sync Job Data
          </DialogTitle>
          <DialogDescription>
            Update job information from external sources or manual input
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Job Info */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-blue-800">{job.wo_no}</h4>
                <p className="text-sm text-blue-600">{job.customer || 'No customer'}</p>
              </div>
              <Badge variant="outline" className="bg-white">
                {job.status}
              </Badge>
            </div>
          </div>

          <Tabs value={syncMethod} onValueChange={(value) => setSyncMethod(value as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="manual" className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Manual
              </TabsTrigger>
              <TabsTrigger value="api" className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                API
              </TabsTrigger>
              <TabsTrigger value="file" className="flex items-center gap-1">
                <Upload className="h-3 w-3" />
                File
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Input
                    value={manualData.customer}
                    onChange={(e) => setManualData(prev => ({ ...prev, customer: e.target.value }))}
                    placeholder="Customer name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input
                    value={manualData.reference}
                    onChange={(e) => setManualData(prev => ({ ...prev, reference: e.target.value }))}
                    placeholder="Job reference"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={manualData.due_date}
                    onChange={(e) => setManualData(prev => ({ ...prev, due_date: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={manualData.quantity}
                    onChange={(e) => setManualData(prev => ({ ...prev, quantity: e.target.value }))}
                    placeholder="Quantity"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={manualData.location}
                  onChange={(e) => setManualData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Job location"
                />
              </div>

              <Button 
                onClick={handleManualSync}
                disabled={isProcessing}
                className="w-full"
              >
                {isProcessing ? "Syncing..." : "Update Job Data"}
              </Button>
            </TabsContent>

            <TabsContent value="api" className="space-y-4">
              <div className="space-y-2">
                <Label>API Endpoint</Label>
                <Input
                  value={apiEndpoint}
                  onChange={(e) => setApiEndpoint(e.target.value)}
                  placeholder="https://api.example.com/job/{id}"
                />
              </div>

              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium">API Sync Requirements:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Endpoint should return JSON data</li>
                      <li>Expected fields: customer, reference, due_date, quantity, location</li>
                      <li>Must be accessible from the browser (CORS enabled)</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleApiSync}
                disabled={isProcessing || !apiEndpoint.trim()}
                className="w-full"
              >
                {isProcessing ? "Fetching..." : "Sync from API"}
              </Button>
            </TabsContent>

            <TabsContent value="file" className="space-y-4">
              <div className="space-y-2">
                <Label>Upload JSON File</Label>
                <Input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                />
              </div>

              <div className="space-y-2">
                <Label>JSON Data</Label>
                <Textarea
                  value={jsonData}
                  onChange={(e) => setJsonData(e.target.value)}
                  placeholder="Paste JSON data here..."
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>

              <Button 
                onClick={handleJsonSync}
                disabled={isProcessing || !jsonData.trim()}
                className="w-full"
              >
                {isProcessing ? "Syncing..." : "Sync from JSON"}
              </Button>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
