
import React, { useState, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ProductionJobCard } from "./ProductionJobCard";
import { KanbanColumn } from "./KanbanColumn";

interface ProductionJob {
  id: string;
  wo_no: string;
  status: string;
  so_no?: string;
  customer?: string;
  category?: string;
  qty?: number;
  due_date?: string;
  location?: string;
  highlighted?: boolean;
}

const STATUSES = ["Pre-Press", "Printing", "Finishing", "Packaging", "Shipped", "Completed"];

export const ProductionKanban = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchJobs = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('production_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching jobs:", error);
        toast.error("Failed to load jobs");
        return;
      }

      setJobs(data || []);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      toast.error("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();

    // Set up real-time subscription
    const channel = supabase
      .channel('production_jobs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_jobs',
          filter: `user_id=eq.${user?.id}`,
        },
        () => {
          fetchJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const activeJobId = String(active.id);
    const activeJob = jobs.find(job => job.id === activeJobId);
    if (!activeJob) return;

    const newStatus = String(over.id);
    
    // Optimistic update
    setJobs(jobs.map(job => 
      job.id === activeJobId 
        ? { ...job, status: newStatus }
        : job
    ));

    // Update in database
    try {
      const { error } = await supabase
        .from('production_jobs')
        .update({ status: newStatus })
        .eq('id', activeJobId);

      if (error) {
        console.error("Error updating job status:", error);
        toast.error("Failed to update job status");
        // Revert optimistic update
        fetchJobs();
      } else {
        toast.success(`Job ${activeJob.wo_no} moved to ${newStatus}`);
      }
    } catch (error) {
      console.error("Error updating job status:", error);
      toast.error("Failed to update job status");
      fetchJobs();
    }
  };

  const getJobsByStatus = (status: string) => {
    return jobs.filter(job => job.status === status);
  };

  const getStatusColor = (status: string) => {
    const colors = {
      "Pre-Press": "bg-blue-100 text-blue-800",
      "Printing": "bg-yellow-100 text-yellow-800",
      "Finishing": "bg-purple-100 text-purple-800", 
      "Packaging": "bg-orange-100 text-orange-800",
      "Shipped": "bg-green-100 text-green-800",
      "Completed": "bg-gray-100 text-gray-800"
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading jobs...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Production Kanban Board</h2>
        <p className="text-gray-600">Drag and drop jobs to update their status</p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 overflow-x-auto pb-6">
          {STATUSES.map(status => (
            <KanbanColumn
              key={status}
              id={status}
              title={status}
              jobs={getJobsByStatus(status)}
              colorClass={getStatusColor(status)}
            />
          ))}
        </div>
      </DndContext>

      {jobs.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-gray-500 text-lg">No jobs found</p>
            <p className="text-gray-400">Upload an Excel file to start tracking jobs</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
