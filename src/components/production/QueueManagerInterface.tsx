import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QueuedJob, SmartQueue } from '@/services/smartQueueManager';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Search, Filter, ArrowUpDown, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface QueueManagerInterfaceProps {
  queues: SmartQueue[];
  onQueueUpdate: (updatedQueues: SmartQueue[]) => void;
}

export const QueueManagerInterface: React.FC<QueueManagerInterfaceProps> = ({
  queues,
  onQueueUpdate
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'due_date' | 'customer'>('priority');
  const [localQueues, setLocalQueues] = useState<SmartQueue[]>(queues);

  useEffect(() => {
    setLocalQueues(queues);
  }, [queues]);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceQueue = localQueues.find(q => q.id === source.droppableId);
    const destQueue = localQueues.find(q => q.id === destination.droppableId);

    if (!sourceQueue || !destQueue) return;

    const movedJob = sourceQueue.jobs.find(job => job.job_id === draggableId);
    if (!movedJob) return;

    // Create new queues with moved job
    const newQueues = localQueues.map(queue => {
      if (queue.id === source.droppableId) {
        // Remove job from source queue
        return {
          ...queue,
          jobs: queue.jobs.filter(job => job.job_id !== draggableId)
        };
      } else if (queue.id === destination.droppableId) {
        // Add job to destination queue
        const newJobs = [...queue.jobs];
        newJobs.splice(destination.index, 0, movedJob);
        return {
          ...queue,
          jobs: newJobs
        };
      }
      return queue;
    });

    setLocalQueues(newQueues);
    onQueueUpdate(newQueues);
    
    toast.success(`Job ${movedJob.wo_no} moved to ${destQueue.name}`);
  };

  const filteredQueues = localQueues.map(queue => ({
    ...queue,
    jobs: queue.jobs.filter(job => {
      const matchesSearch = job.wo_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           job.customer.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStage = filterStage === 'all' || queue.id === filterStage;
      return matchesSearch && matchesStage;
    }).sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return b.priority_score - a.priority_score;
        case 'due_date':
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        case 'customer':
          return a.customer.localeCompare(b.customer);
        default:
          return 0;
      }
    })
  }));

  const getPriorityColor = (score: number) => {
    if (score >= 80) return 'bg-destructive text-destructive-foreground';
    if (score >= 60) return 'bg-warning text-warning-foreground';
    return 'bg-success text-success-foreground';
  };

  const getDaysUntilDue = (dueDate: string) => {
    const days = Math.ceil((new Date(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Queue Management Controls</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            
            <Select value={filterStage} onValueChange={setFilterStage}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {queues.map(queue => (
                  <SelectItem key={queue.id} value={queue.id}>
                    {queue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="due_date">Due Date</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Queue Interface */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid gap-6 lg:grid-cols-3">
          {filteredQueues.map((queue) => (
            <Card key={queue.id} className="h-fit">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{queue.name}</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{queue.jobs.length} jobs</Badge>
                    {queue.bottleneck_risk === 'high' && (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <Droppable droppableId={queue.id}>
                {(provided, snapshot) => (
                  <CardContent
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`space-y-2 min-h-[200px] ${
                      snapshot.isDraggingOver ? 'bg-muted/50' : ''
                    }`}
                  >
                    {queue.jobs.map((job, index) => (
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
                            className={`p-3 rounded-md border bg-card ${
                              snapshot.isDragging ? 'shadow-lg' : 'shadow-sm'
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{job.wo_no}</span>
                                <Badge className={getPriorityColor(job.priority_score)}>
                                  {Math.round(job.priority_score)}
                                </Badge>
                              </div>
                              
                              <div className="text-xs text-muted-foreground">
                                {job.customer}
                              </div>
                              
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center space-x-1">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {getDaysUntilDue(job.due_date)} days
                                  </span>
                                </div>
                                <span className="text-muted-foreground">
                                  {job.workflow_progress}/{job.total_stages}
                                </span>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <Badge variant="outline" className="text-xs">
                                  {job.material_group}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  Batch: {Math.round(job.batch_compatibility_score)}%
                                </Badge>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    
                    {queue.jobs.length === 0 && (
                      <div className="text-center text-muted-foreground text-sm py-8">
                        No jobs in this queue
                      </div>
                    )}
                  </CardContent>
                )}
              </Droppable>
            </Card>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
};