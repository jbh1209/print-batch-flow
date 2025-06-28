
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Filter, 
  Calendar,
  User,
  Building,
  Clock,
  AlertTriangle,
  CheckCircle,
  X
} from "lucide-react";
import { format } from "date-fns";

interface FilteredJobsListProps {
  jobs: any[];
  activeFilter: string | null;
  onClose: () => void;
  categories: any[];
}

export const FilteredJobsList: React.FC<FilteredJobsListProps> = ({
  jobs,
  activeFilter,
  onClose,
  categories
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  if (!activeFilter || jobs.length === 0) {
    return null;
  }

  const getFilterTitle = (filter: string) => {
    switch (filter) {
      case "overdue": return "Overdue Jobs";
      case "due_today": return "Due Today";
      case "due_tomorrow": return "Due Tomorrow";
      case "due_this_week": return "Due This Week";
      case "critical": return "Critical Jobs";
      case "total": return "All Jobs";
      case "in_progress": return "In Progress Jobs";
      case "completed_this_month": return "Completed This Month";
      default: return "Filtered Jobs";
    }
  };

  const getFilterColor = (filter: string) => {
    switch (filter) {
      case "overdue": return "bg-red-50 border-red-200";
      case "due_today": return "bg-orange-50 border-orange-200";
      case "due_tomorrow": return "bg-yellow-50 border-yellow-200";
      case "critical": return "bg-red-50 border-red-200";
      case "completed_this_month": return "bg-green-50 border-green-200";
      default: return "bg-blue-50 border-blue-200";
    }
  };

  // Filter jobs based on search and category
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = !searchQuery || 
      job.wo_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.customer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.reference?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = !categoryFilter || job.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const getDueDateStatus = (dueDate: string | null) => {
    if (!dueDate) return { text: "No due date", color: "gray" };
    
    const due = new Date(dueDate);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    tomorrow.setHours(0, 0, 0, 0);
    
    if (due < today) return { text: "Overdue", color: "red" };
    if (due.getTime() === today.getTime()) return { text: "Due today", color: "orange" };
    if (due.getTime() === tomorrow.getTime()) return { text: "Due tomorrow", color: "yellow" };
    return { text: format(due, "MMM dd"), color: "blue" };
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed": return "bg-green-100 text-green-800";
      case "in progress": case "active": return "bg-blue-100 text-blue-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "overdue": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card className={`${getFilterColor(activeFilter)} shadow-lg`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span>{getFilterTitle(activeFilter)}</span>
            <Badge variant="outline">{filteredJobs.length} jobs</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        {isExpanded && (
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by order number, customer, or reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent>
          {filteredJobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg font-medium mb-2">No jobs found</p>
              <p className="text-sm">Try adjusting your search or filter criteria.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredJobs.map((job) => {
                const dueDateStatus = getDueDateStatus(job.due_date);
                
                return (
                  <div 
                    key={job.job_id} 
                    className="flex items-center justify-between p-4 bg-white border rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {job.wo_no}
                        </h3>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getStatusBadgeColor(job.status)}`}
                        >
                          {job.status || 'Unknown'}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-600">
                        {job.customer && (
                          <div className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            <span className="truncate">{job.customer}</span>
                          </div>
                        )}
                        
                        {job.category && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span className="truncate">{job.category}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              dueDateStatus.color === 'red' ? 'border-red-300 text-red-700' :
                              dueDateStatus.color === 'orange' ? 'border-orange-300 text-orange-700' :
                              dueDateStatus.color === 'yellow' ? 'border-yellow-300 text-yellow-700' :
                              'border-blue-300 text-blue-700'
                            }`}
                          >
                            {dueDateStatus.text}
                          </Badge>
                        </div>
                      </div>
                      
                      {job.reference && (
                        <div className="mt-2 text-xs text-gray-500">
                          Ref: {job.reference}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {job.workflow_progress !== undefined && (
                        <div className="text-right">
                          <div className="text-sm font-medium">{job.workflow_progress}%</div>
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 transition-all duration-300"
                              style={{ width: `${job.workflow_progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      
                      {activeFilter === 'overdue' && (
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      )}
                      {activeFilter === 'completed_this_month' && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                      {(activeFilter === 'due_today' || activeFilter === 'due_tomorrow') && (
                        <Clock className="h-5 w-5 text-orange-500" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};
