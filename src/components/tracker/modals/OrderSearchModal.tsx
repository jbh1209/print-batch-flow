
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface OrderSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderSelect: (job: AccessibleJob) => void;
}

export const OrderSearchModal: React.FC<OrderSearchModalProps> = ({
  isOpen,
  onClose,
  onOrderSelect
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const { jobs, isLoading } = useAccessibleJobs({ permissionType: 'manage' });

  // Filter jobs based on search query
  const filteredJobs = jobs.filter(job => 
    job.wo_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.reference.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOrderClick = (job: AccessibleJob) => {
    onOrderSelect(job);
    onClose();
    setSearchQuery("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Search Orders</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by WO number, customer, or reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          <div className="max-h-96 overflow-y-auto border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading orders...</span>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery ? 'No orders found matching your search' : 'Start typing to search orders'}
              </div>
            ) : (
              <div className="divide-y">
                {filteredJobs.slice(0, 50).map((job) => (
                  <div
                    key={job.job_id}
                    onClick={() => handleOrderClick(job)}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{job.wo_no}</div>
                        <div className="text-sm text-gray-600">{job.customer}</div>
                        {job.reference && (
                          <div className="text-xs text-gray-500">{job.reference}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium" style={{ color: job.current_stage_color }}>
                          {job.display_stage_name}
                        </div>
                        <div className="text-xs text-gray-500">{job.status}</div>
                        {job.due_date && (
                          <div className="text-xs text-gray-500">Due: {job.due_date}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
