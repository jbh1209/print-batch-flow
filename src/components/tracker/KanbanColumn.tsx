
import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProductionJobCard } from "./ProductionJobCard";

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

interface KanbanColumnProps {
  id: string;
  title: string;
  jobs: ProductionJob[];
  colorClass: string;
}

export const KanbanColumn = ({ id, title, jobs, colorClass }: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });

  return (
    <div className="flex-shrink-0 w-80">
      <Card className={`h-full ${isOver ? 'ring-2 ring-blue-500' : ''}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span>{title}</span>
            <Badge className={colorClass}>
              {jobs.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            ref={setNodeRef}
            className="space-y-3 min-h-[400px]"
          >
            <SortableContext 
              items={jobs.map(job => job.id)} 
              strategy={verticalListSortingStrategy}
            >
              {jobs.map((job) => (
                <ProductionJobCard key={job.id} job={job} />
              ))}
            </SortableContext>
            {jobs.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                Drop jobs here
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
