
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Package, 
  Download, 
  Copy, 
  Archive, 
  RefreshCw,
  Calendar,
  Tag,
  Users
} from "lucide-react";
import { useAdvancedJobOperations } from "@/hooks/tracker/useAdvancedJobOperations";

interface BulkJobOperationsProps {
  isOpen: boolean;
  onClose: () => void;
  selectedJobs: any[];
  categories: any[];
  onOperationComplete: () => void;
}

export const BulkJobOperations: React.FC<BulkJobOperationsProps> = ({
  isOpen,
  onClose,
  selectedJobs,
  categories,
  onOperationComplete
}) => {
  const [activeTab, setActiveTab] = useState("update");
  const [bulkUpdateData, setBulkUpdateData] = useState({
    status: "",
    category_id: "",
    due_date: ""
  });
  const [batchData, setBatchData] = useState({
    batch_name: "",
    batch_type: "production"
  });

  const {
    isProcessing,
    bulkUpdateJobs,
    assignJobsToBatch,
    duplicateJobs,
    archiveJobs,
    exportJobs
  } = useAdvancedJobOperations();

  const selectedJobIds = selectedJobs.map(job => job.id);

  const handleBulkUpdate = async () => {
    const updateData = Object.fromEntries(
      Object.entries(bulkUpdateData).filter(([_, value]) => value !== "")
    );
    
    if (Object.keys(updateData).length === 0) return;
    
    const success = await bulkUpdateJobs(selectedJobIds, updateData);
    if (success) {
      onOperationComplete();
      onClose();
    }
  };

  const handleBatchAssign = async () => {
    if (!batchData.batch_name.trim()) return;
    
    const success = await assignJobsToBatch({
      ...batchData,
      job_ids: selectedJobIds
    });
    
    if (success) {
      onOperationComplete();
      onClose();
    }
  };

  const handleDuplicate = async () => {
    const success = await duplicateJobs(selectedJobIds);
    if (success) {
      onOperationComplete();
      onClose();
    }
  };

  const handleArchive = async () => {
    const success = await archiveJobs(selectedJobIds);
    if (success) {
      onOperationComplete();
      onClose();
    }
  };

  const handleExport = async () => {
    const success = await exportJobs(selectedJobIds);
    if (success) {
      onClose();
    }
  };

  const handleClose = () => {
    setBulkUpdateData({ status: "", category_id: "", due_date: "" });
    setBatchData({ batch_name: "", batch_type: "production" });
    setActiveTab("update");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Bulk Job Operations
          </DialogTitle>
          <DialogDescription>
            Perform operations on {selectedJobs.length} selected jobs
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Selection Summary */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-medium text-blue-800">
                {selectedJobs.length} jobs selected
              </span>
              <div className="flex flex-wrap gap-1">
                {selectedJobs.slice(0, 3).map(job => (
                  <Badge key={job.id} variant="outline" className="text-xs">
                    {job.wo_no}
                  </Badge>
                ))}
                {selectedJobs.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{selectedJobs.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="update" className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                Update
              </TabsTrigger>
              <TabsTrigger value="batch" className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                Batch
              </TabsTrigger>
              <TabsTrigger value="actions" className="flex items-center gap-1">
                <Copy className="h-3 w-3" />
                Actions
              </TabsTrigger>
              <TabsTrigger value="export" className="flex items-center gap-1">
                <Download className="h-3 w-3" />
                Export
              </TabsTrigger>
            </TabsList>

            <TabsContent value="update" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={bulkUpdateData.status}
                    onValueChange={(value) => setBulkUpdateData(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="queued">Queued</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on-hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={bulkUpdateData.category_id}
                    onValueChange={(value) => setBulkUpdateData(prev => ({ ...prev, category_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={bulkUpdateData.due_date}
                  onChange={(e) => setBulkUpdateData(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>

              <Button 
                onClick={handleBulkUpdate}
                disabled={isProcessing || Object.values(bulkUpdateData).every(v => !v)}
                className="w-full"
              >
                {isProcessing ? "Updating..." : "Update Selected Jobs"}
              </Button>
            </TabsContent>

            <TabsContent value="batch" className="space-y-4">
              <div className="space-y-2">
                <Label>Batch Name</Label>
                <Input
                  value={batchData.batch_name}
                  onChange={(e) => setBatchData(prev => ({ ...prev, batch_name: e.target.value }))}
                  placeholder="Enter batch name..."
                />
              </div>

              <div className="space-y-2">
                <Label>Batch Type</Label>
                <Select
                  value={batchData.batch_type}
                  onValueChange={(value) => setBatchData(prev => ({ ...prev, batch_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">Production Batch</SelectItem>
                    <SelectItem value="rush">Rush Batch</SelectItem>
                    <SelectItem value="quality">Quality Check Batch</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleBatchAssign}
                disabled={isProcessing || !batchData.batch_name.trim()}
                className="w-full"
              >
                {isProcessing ? "Assigning..." : "Assign to Batch"}
              </Button>
            </TabsContent>

            <TabsContent value="actions" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  onClick={handleDuplicate}
                  disabled={isProcessing}
                  className="flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Duplicate Jobs
                </Button>

                <Button
                  variant="outline"
                  onClick={handleArchive}
                  disabled={isProcessing}
                  className="flex items-center gap-2"
                >
                  <Archive className="h-4 w-4" />
                  Archive Jobs
                </Button>
              </div>

              <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg">
                <p><strong>Duplicate:</strong> Creates copies of selected jobs with new work order numbers</p>
                <p><strong>Archive:</strong> Moves jobs to archived status for historical reference</p>
              </div>
            </TabsContent>

            <TabsContent value="export" className="space-y-4">
              <div className="text-center space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-2">Export Job Data</h4>
                  <p className="text-sm text-green-700">
                    Export selected jobs to CSV format including workflow progress and stage information
                  </p>
                </div>

                <Button
                  onClick={handleExport}
                  disabled={isProcessing}
                  className="w-full flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  {isProcessing ? "Exporting..." : "Export to CSV"}
                </Button>
              </div>
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
