
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Settings, 
  BarChart3, 
  RefreshCw,
  AlertTriangle,
  Clock,
  CheckCircle,
  Play
} from "lucide-react";
import { useDepartments } from "@/hooks/tracker/useDepartments";
import { useFactoryFloor } from "@/hooks/tracker/useFactoryFloor";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

interface ManagerDashboardProps {
  selectedDepartmentId?: string;
}

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
  selectedDepartmentId
}) => {
  const { departments, isLoading: departmentsLoading } = useDepartments();
  const [activeDepartment, setActiveDepartment] = useState<string | undefined>(selectedDepartmentId);
  
  const {
    jobQueue,
    activeJobs,
    isLoading,
    updateJobPriority,
    refreshQueue
  } = useFactoryFloor(activeDepartment);

  const handleDragEnd = async (result: any) => {
    if (!result.destination || !activeDepartment) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    
    if (sourceIndex === destinationIndex) return;

    const draggedJob = jobQueue[sourceIndex];
    const newPriority = destinationIndex + 1;

    const success = await updateJobPriority(
      draggedJob.job_id, 
      draggedJob.job_table_name, 
      newPriority,
      'Manual reorder by manager'
    );

    if (success) {
      await refreshQueue();
    }
  };

  const getDepartmentStats = (deptId: string) => {
    // This would normally come from a proper hook/API
    return {
      totalJobs: jobQueue.length,
      activeJobs: activeJobs.length,
      completedToday: 0,
      averageTime: '2.5h'
    };
  };

  if (departmentsLoading) {
    return (
      <div className="flex items-center justify-center p-4 sm:p-8 h-full">
        <RefreshCw className="h-6 w-6 sm:h-8 sm:w-8 animate-spin" />
        <span className="ml-2 text-sm sm:text-base">Loading manager dashboard...</span>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold truncate">Manager Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage production flow and job priorities</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button variant="outline" onClick={refreshQueue} className="w-full sm:w-auto">
            <RefreshCw className="h-4 w-4 mr-2" />
            <span className="sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" className="w-full sm:w-auto">
            <Settings className="h-4 w-4 mr-2" />
            <span className="sm:inline">Settings</span>
          </Button>
        </div>
      </div>

      {/* Department Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        {departments.map((dept) => {
          const stats = getDepartmentStats(dept.id);
          return (
            <Card 
              key={dept.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                activeDepartment === dept.id ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setActiveDepartment(dept.id)}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: dept.color }}
                  />
                  <span className="font-medium text-xs sm:text-sm truncate">{dept.name}</span>
                </div>
                
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Active:</span>
                    <span className="font-medium">{stats.activeJobs}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Queue:</span>
                    <span className="font-medium">{stats.totalJobs}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Avg Time:</span>
                    <span className="font-medium">{stats.averageTime}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {activeDepartment && (
        <>
          {/* Department Header */}
          <Card>
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
                  <span className="truncate">
                    {departments.find(d => d.id === activeDepartment)?.name} Department
                  </span>
                  <Badge variant="outline" className="w-fit">
                    {jobQueue.length} jobs in queue
                  </Badge>
                </div>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-sm w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    <Play className="h-4 w-4 text-blue-600" />
                    <span>{activeJobs.length} Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <span>{jobQueue.length - activeJobs.length} Waiting</span>
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
          </Card>

          {/* Draggable Job Queue */}
          <Card className="flex-1 overflow-hidden">
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>Job Priority Queue</span>
                </div>
                <Badge variant="outline" className="text-xs w-fit">
                  Drag to reorder
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[400px] sm:h-[500px] overflow-y-auto">
              {isLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                  <p>Loading job queue...</p>
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="job-queue">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-2"
                      >
                        {jobQueue.map((job, index) => {
                          const isActive = activeJobs.some(aj => aj.job_id === job.job_id);
                          
                          return (
                            <Draggable 
                              key={job.job_id} 
                              draggableId={job.job_id} 
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`p-3 sm:p-4 border rounded-lg transition-all ${
                                    snapshot.isDragging ? 'shadow-lg rotate-2' :
                                    isActive ? 'bg-blue-50 border-blue-200' :
                                    'bg-white hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                        <span className="font-mono text-base sm:text-lg font-medium">
                                          #{job.priority_order}
                                        </span>
                                        <span className="font-medium truncate">{job.wo_no}</span>
                                        
                                        <div className="flex flex-wrap gap-1 sm:gap-2">
                                          {job.has_priority_override && (
                                            <Badge variant="outline" className="text-xs bg-orange-50">
                                              Manual Priority
                                            </Badge>
                                          )}
                                          
                                          {isActive && (
                                            <Badge className="bg-blue-600 text-white text-xs">
                                              <Play className="h-3 w-3 mr-1" />
                                              In Progress
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                      
                                      <div className="text-xs sm:text-sm text-gray-600 mt-1 truncate">
                                        {job.customer && `Customer: ${job.customer}`}
                                        {job.current_stage && ` • Stage: ${job.current_stage}`}
                                      </div>
                                    </div>
                                    
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                                      <Badge variant="outline" className="w-fit">
                                        {job.status}
                                      </Badge>
                                      
                                      {job.due_date && (
                                        <span className="text-xs text-gray-500 truncate">
                                          Due: {new Date(job.due_date).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
