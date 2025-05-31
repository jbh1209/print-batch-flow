
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Package, Calendar, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface JobSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: any[];
  selectedJobs: any[];
  onJobSelect: (job: any, selected: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
}

export const JobSelectionModal: React.FC<JobSelectionModalProps> = ({
  isOpen,
  onClose,
  jobs,
  selectedJobs,
  onJobSelect,
  onConfirm,
  title = "Select Jobs",
  description = "Choose jobs for this operation",
  confirmText = "Confirm Selection"
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredJobs = jobs.filter(job => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      job.wo_no?.toLowerCase().includes(searchLower) ||
      job.customer?.toLowerCase().includes(searchLower) ||
      job.reference?.toLowerCase().includes(searchLower)
    );
  });

  const isJobSelected = (job: any) => {
    return selectedJobs.some(selected => selected.id === job.id);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No date';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-4xl h-[90vh] sm:h-[80vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl">{title}</DialogTitle>
          <DialogDescription className="text-sm sm:text-base">{description}</DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search jobs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Selection Count */}
        <div className="flex items-center justify-between text-sm text-gray-600 flex-shrink-0">
          <span>{selectedJobs.length} selected</span>
          <span>{filteredJobs.length} jobs available</span>
        </div>

        {/* Jobs List */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-2 pr-4">
            {filteredJobs.map((job) => (
              <div 
                key={job.id}
                className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                  isJobSelected(job) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => onJobSelect(job, !isJobSelected(job))}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={isJobSelected(job)}
                    onChange={() => {}} // Handled by parent click
                    className="mt-1 flex-shrink-0"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <h4 className="font-medium text-sm truncate">{job.wo_no}</h4>
                      <Badge className={`text-xs flex-shrink-0 ${getStatusColor(job.status)}`}>
                        {job.status}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1 text-xs text-gray-600">
                      {job.customer && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{job.customer}</span>
                        </div>
                      )}
                      
                      {job.qty && (
                        <div className="flex items-center gap-1">
                          <Package className="h-3 w-3 flex-shrink-0" />
                          <span>Qty: {job.qty}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        <span>Due: {formatDate(job.due_date)}</span>
                      </div>
                      
                      {job.category && (
                        <Badge variant="outline" className="text-xs">
                          {job.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {filteredJobs.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No jobs found</p>
                {searchTerm && (
                  <p className="text-sm">Try adjusting your search terms</p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 flex-col sm:flex-row gap-2 pt-4">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={selectedJobs.length === 0}
            className="w-full sm:w-auto"
          >
            {confirmText} ({selectedJobs.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
