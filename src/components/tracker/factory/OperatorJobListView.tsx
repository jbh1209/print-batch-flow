import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Play, 
  CheckCircle, 
  Clock, 
  Calendar, 
  Search, 
  Filter,
  MoreHorizontal,
  AlertTriangle,
  Timer,
  Info,
  Wrench
} from "lucide-react";
import { SubTaskList } from "../common/SubTaskList";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ScheduledJobStage } from "@/hooks/tracker/useScheduledJobs";
import { format, formatDistanceToNow, isAfter, isBefore, addDays } from "date-fns";

interface OperatorJobListViewProps {
  jobs: ScheduledJobStage[];
  onJobClick: (job: ScheduledJobStage) => void;
  onStartJob: (jobId: string) => Promise<boolean>;
  onCompleteJob: (jobId: string) => Promise<boolean>;
  multiSelectMode?: boolean;
  selectedJobs?: any[];
  onToggleSelection?: (job: ScheduledJobStage) => void;
  className?: string;
}

export const OperatorJobListView: React.FC<OperatorJobListViewProps> = ({
  jobs,
  onJobClick,
  onStartJob,
  onCompleteJob,
  multiSelectMode = false,
  selectedJobs = [],
  onToggleSelection,
  className
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Filter jobs (NO SORTING - must maintain scheduled order)
  const filteredJobs = React.useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch = !searchTerm || 
        job.wo_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.customer.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "active" && job.status === 'active') ||
        (statusFilter === "scheduled" && job.status === 'pending') ||
        (statusFilter === "urgent" && isJobUrgent(job));
      
      return matchesSearch && matchesStatus;
    });
  }, [jobs, searchTerm, statusFilter]);

  // Group jobs by day for better organization
  const jobsByDay = React.useMemo(() => {
    const grouped: { [key: string]: ScheduledJobStage[] } = {};
    
    filteredJobs.forEach(job => {
      let dayKey = 'Unscheduled';
      
      if (job.scheduled_start_at) {
        const scheduleDate = new Date(job.scheduled_start_at);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        
        if (scheduleDate.toDateString() === today.toDateString()) {
          dayKey = 'Today';
        } else if (scheduleDate.toDateString() === tomorrow.toDateString()) {
          dayKey = 'Tomorrow';  
        } else {
          dayKey = format(scheduleDate, 'EEE, MMM dd');
        }
      }
      
      if (!grouped[dayKey]) {
        grouped[dayKey] = [];
      }
      grouped[dayKey].push(job);
    });
    
    return grouped;
  }, [filteredJobs]);

  const isJobUrgent = (job: ScheduledJobStage) => {
    if (!job.due_date) return false;
    const dueDate = new Date(job.due_date);
    const now = new Date();
    return isBefore(dueDate, now) || isBefore(dueDate, addDays(now, 1));
  };

  const isJobOverdue = (job: ScheduledJobStage) => {
    if (!job.due_date) return false;
    return isBefore(new Date(job.due_date), new Date());
  };

  const getJobStatusInfo = (job: ScheduledJobStage) => {
    if (job.status === 'active') {
      return { text: 'In Progress', variant: 'default' as const, icon: Timer };
    }
    if (job.status === 'pending') {
      return { text: 'Scheduled', variant: 'outline' as const, icon: Clock };
    }
    return { text: 'Pending', variant: 'secondary' as const, icon: Timer };
  };

  const formatDueDate = (dateString?: string) => {
    if (!dateString) return "No due date";
    const date = new Date(dateString);
    const now = new Date();
    
    if (isBefore(date, now)) {
      return `Overdue by ${formatDistanceToNow(date)}`;
    }
    
    return format(date, "MMM d, yyyy");
  };

  const formatScheduledTime = (dateString?: string) => {
    if (!dateString) return "Not scheduled";
    const date = new Date(dateString);
    return format(date, "HH:mm");
  };

  const isJobSelected = (job: ScheduledJobStage) => {
    return selectedJobs.some(selected => selected.id === job.id);
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              Scheduled Jobs ({filteredJobs.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                    All Jobs
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("active")}>
                    In Progress
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("scheduled")}>
                    Scheduled
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("urgent")}>
                    Urgent
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by work order or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          {Object.entries(jobsByDay).map(([dayKey, dayJobs]) => (
            <div key={dayKey}>
              {/* Day Header */}
              <div className="bg-primary text-primary-foreground px-4 py-3 text-lg font-bold border-b">
                {dayKey} ({dayJobs.length} jobs)
              </div>
              
              {/* Non-sortable Table Header */}
              <div className="bg-gray-50 border-b px-4 py-3 grid grid-cols-12 gap-2 text-sm font-medium text-gray-700 min-w-[800px]">
                {multiSelectMode && (
                  <div className="col-span-1 flex items-center">
                    <Checkbox className="h-4 w-4" />
                  </div>
                )}
                <div className={cn("flex items-center gap-2", multiSelectMode ? "col-span-2" : "col-span-2")}>
                  Work Order
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  Customer
                </div>
                <div className="col-span-1 flex items-center gap-2">
                  Qty
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  Due Date
                </div>
                <div className="col-span-1">Status</div>
                <div className="col-span-1 flex items-center gap-2">
                  Time
                </div>
                <div className={cn("text-center", multiSelectMode ? "col-span-1" : "col-span-2")}>Actions</div>
              </div>

              {/* Jobs for this day */}
              <div className="divide-y divide-gray-200">
                {dayJobs.map((job) => {
                  const statusInfo = getJobStatusInfo(job);
                  const isOverdue = isJobOverdue(job);
                  const isUrgent = isJobUrgent(job);
                  const selected = isJobSelected(job);

                  return (
                    <div
                      key={job.id}
                      className={cn(
                        "px-4 py-3 grid grid-cols-12 gap-2 text-sm hover:bg-gray-50 cursor-pointer transition-colors min-w-[800px]",
                        isOverdue && "bg-red-50 hover:bg-red-100",
                        isUrgent && !isOverdue && "bg-yellow-50 hover:bg-yellow-100",
                        selected && "bg-blue-50 hover:bg-blue-100"
                      )}
                      onClick={() => onJobClick(job)}
                    >
                      {multiSelectMode && (
                        <div className="col-span-1 flex items-center">
                          <Checkbox
                            checked={selected}
                            onChange={() => onToggleSelection?.(job)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4"
                          />
                        </div>
                      )}
                      
                      <div className={cn("font-medium text-gray-900", multiSelectMode ? "col-span-2" : "col-span-2")}>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold">{job.wo_no}</span>
                          <SubTaskList
                            stageInstanceId={job.id}
                            mode="compact"
                            stageStatus={job.status}
                          />
                          {isOverdue && <AlertTriangle className="inline h-4 w-4 text-red-500 ml-1" />}
                          {isUrgent && !isOverdue && <Clock className="inline h-4 w-4 text-orange-500 ml-1" />}
                        </div>
                      </div>
                      
                      <div className="col-span-2 text-gray-700 truncate" title={job.customer}>
                        {job.customer}
                      </div>
                      
                      <div className="col-span-1 text-gray-700 font-mono">
                        {job.qty.toLocaleString()}
                      </div>
                      
                      <div className="col-span-2 text-gray-700">
                        <span className={cn(
                          isOverdue && "text-red-600 font-medium",
                          isUrgent && !isOverdue && "text-orange-600 font-medium"
                        )}>
                          {formatDueDate(job.due_date)}
                        </span>
                      </div>
                      
                      <div className="col-span-1">
                        <Badge variant={statusInfo.variant} className="text-xs">
                          <statusInfo.icon className="h-3 w-3 mr-1" />
                          {statusInfo.text}
                        </Badge>
                      </div>
                      
                      <div className="col-span-1 text-gray-600 font-mono text-xs">
                        {formatScheduledTime(job.scheduled_start_at)}
                      </div>
                      
                      <div className={cn("flex items-center gap-1", multiSelectMode ? "col-span-1" : "col-span-2")}>
                        {job.status === 'active' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCompleteJob(job.id);
                            }}
                            className="h-7 px-2 text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Complete
                          </Button>
                        ) : job.status === 'pending' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartJob(job.id);
                            }}
                            className="h-7 px-2 text-xs bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Start
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              onJobClick(job);
                            }}
                            className="h-7 px-2 text-xs"
                          >
                            <Info className="h-3 w-3 mr-1" />
                            Details
                          </Button>
                        )}
                        
                        {!multiSelectMode && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => e.stopPropagation()}
                                className="h-7 w-7 p-0"
                              >
                                <MoreHorizontal className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onJobClick(job)}>
                                <Info className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {job.status === 'pending' && (
                                <DropdownMenuItem onClick={() => onStartJob(job.id)}>
                                  <Play className="h-4 w-4 mr-2" />
                                  Start Job
                                </DropdownMenuItem>
                              )}
                              {job.status === 'active' && (
                                <DropdownMenuItem onClick={() => onCompleteJob(job.id)}>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Complete Job
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredJobs.length === 0 && (
            <div className="text-center py-12">
              <Timer className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Jobs Found</h3>
              <p className="text-gray-600">
                {searchTerm ? "Try adjusting your search terms" : "No jobs match the current filters"}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};