
import React, { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Calendar, Package, User, MapPin, Star, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

interface ProductionJobCardProps {
  job: ProductionJob;
}

export const ProductionJobCard = ({ job }: ProductionJobCardProps) => {
  const [highlighted, setHighlighted] = useState(job.highlighted || false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: job.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleToggleHighlight = async (checked: boolean) => {
    setHighlighted(checked);
    
    try {
      const { error } = await supabase
        .from('production_jobs')
        .update({ highlighted: checked })
        .eq('id', job.id);

      if (error) {
        console.error("Error updating highlight:", error);
        toast.error("Failed to update highlight");
        setHighlighted(!checked); // Revert on error
      }
    } catch (error) {
      console.error("Error updating highlight:", error);
      toast.error("Failed to update highlight");
      setHighlighted(!checked); // Revert on error
    }
  };

  const isOverdue = job.due_date && new Date(job.due_date) < new Date();
  const isDueSoon = job.due_date && !isOverdue && 
    new Date(job.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // Due within 3 days

  const getCardBorderColor = () => {
    if (highlighted) return "border-yellow-400 bg-yellow-50";
    if (isOverdue) return "border-red-400 bg-red-50";
    if (isDueSoon) return "border-orange-400 bg-orange-50";
    return "border-gray-200 bg-white";
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`cursor-grab active:cursor-grabbing ${getCardBorderColor()} ${
        isDragging ? "opacity-50" : ""
      } hover:shadow-md transition-shadow`}
      {...attributes}
      {...listeners}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold text-sm">{job.wo_no}</h4>
              {job.so_no && (
                <p className="text-xs text-gray-500">SO: {job.so_no}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {highlighted && <Star className="h-4 w-4 text-yellow-500 fill-current" />}
              <Switch
                checked={highlighted}
                onCheckedChange={handleToggleHighlight}
              />
            </div>
          </div>

          {/* Customer */}
          {job.customer && (
            <div className="flex items-center gap-2">
              <User className="h-3 w-3 text-gray-400" />
              <span className="text-xs font-medium truncate">{job.customer}</span>
            </div>
          )}

          {/* Category and Quantity */}
          <div className="flex items-center justify-between text-xs">
            {job.category && (
              <Badge variant="secondary" className="text-xs">
                {job.category}
              </Badge>
            )}
            {job.qty && (
              <div className="flex items-center gap-1">
                <Package className="h-3 w-3 text-gray-400" />
                <span>{job.qty}</span>
              </div>
            )}
          </div>

          {/* Due Date */}
          {job.due_date && (
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3 text-gray-400" />
              <span className={`text-xs ${
                isOverdue ? "text-red-600 font-medium" : 
                isDueSoon ? "text-orange-600 font-medium" : 
                "text-gray-600"
              }`}>
                Due: {new Date(job.due_date).toLocaleDateString()}
              </span>
            </div>
          )}

          {/* Location */}
          {job.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-600 truncate">{job.location}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
