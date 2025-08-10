import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, ChevronRight, Calendar, Clock, Zap } from "lucide-react";
import { format, addDays, startOfWeek } from "date-fns";
import { toast } from "sonner";
import { schedulingService } from "@/services/schedulingService";
import { supabase } from "@/integrations/supabase/client";
import { useProductionStageCounts } from "@/hooks/tracker/useProductionStageCounts";

// Types
export interface StageInfo {
  id: string;
  name: string;
  color?: string | null;
  order_index?: number | null;
}

export interface StageCapacityProfile {
  production_stage_id: string;
  daily_capacity_hours: number;
}

export interface ScheduledStageItem {
  id: string; // job_stage_instances.id
  job_id: string;
  production_stage_id: string;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  scheduled_minutes: number | null;
  status: string;
  is_expedited?: boolean;
  wo_no?: string;
  customer?: string;
}

interface StageDayBucket {
  date: string; // yyyy-MM-dd
  items: ScheduledStageItem[];
  usedMinutes: number;
  capacityMinutes: number;
}

// Hook: useStageSchedule
export function useStageSchedule() {
  const [stages, setStages] = useState<StageInfo[]>([]);
  const [capacities, setCapacities] = useState<Record<string, number>>({});
  const [items, setItems] = useState<ScheduledStageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());

  const weekStart = useMemo(() => startOfWeek(currentWeek, { weekStartsOn: 1 }), [currentWeek]);
  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const refetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Stages
      const { data: stageRows, error: stageErr } = await supabase
        .from("production_stages")
        .select("id,name,color,order_index,is_active")
        .eq("is_active", true)
        .order("order_index", { ascending: true });

      if (stageErr) throw stageErr;
      setStages((stageRows || []).map((r: any) => ({ id: r.id, name: r.name, color: r.color, order_index: r.order_index })));

      const stageIds = (stageRows || []).map((r: any) => r.id);

      // Capacities
      const { data: capRows, error: capErr } = await supabase
        .from("stage_capacity_profiles")
        .select("production_stage_id,daily_capacity_hours");
      if (capErr) throw capErr;
      const capMap: Record<string, number> = {};
      (capRows || []).forEach((c: any) => { capMap[c.production_stage_id] = (c.daily_capacity_hours || 8) * 60; });
      setCapacities(capMap);

      // Scheduled items in week
      const startIso = new Date(weekStart).toISOString();
      const endIso = new Date(addDays(weekStart, 6)).toISOString();
      const orFilter = `and(scheduled_start_at.gte.${startIso},scheduled_start_at.lt.${endIso}),and(scheduled_end_at.gte.${startIso},scheduled_end_at.lt.${endIso})`;
      const { data: jsiRows, error: jsiErr } = await supabase
        .from("job_stage_instances")
        .select("id,job_id,production_stage_id,scheduled_start_at,scheduled_end_at,scheduled_minutes,status")
        .eq("job_table_name", "production_jobs")
        .in("status", ["active", "pending"])
        .in("production_stage_id", stageIds.length ? stageIds : ["00000000-0000-0000-0000-000000000000"]) // guard
        .or(orFilter)
        .order("scheduled_start_at", { ascending: true });
      if (jsiErr) throw jsiErr;

      // Fetch job info for display via RPC (admin gets all)
      const { data: jobsInfo } = await supabase.rpc("get_user_accessible_jobs", {});
      const jobMap: Record<string, { wo_no?: string; customer?: string; is_expedited?: boolean }> = {};
      (jobsInfo || []).forEach((j: any) => { jobMap[j.job_id] = { wo_no: j.wo_no, customer: j.customer, is_expedited: j.user_can_manage ? j.is_expedited : j.is_expedited } as any; });

      const mapped: ScheduledStageItem[] = (jsiRows || []).map((r: any) => ({
        id: r.id,
        job_id: r.job_id,
        production_stage_id: r.production_stage_id,
        scheduled_start_at: r.scheduled_start_at,
        scheduled_end_at: r.scheduled_end_at,
        scheduled_minutes: r.scheduled_minutes,
        status: r.status,
        wo_no: jobMap[r.job_id]?.wo_no,
        customer: jobMap[r.job_id]?.customer,
        is_expedited: jobMap[r.job_id]?.is_expedited,
      }));

      setItems(mapped);
    } catch (e: any) {
      console.error("Failed to load stage schedule:", e);
      setError(e.message || "Failed to load schedule");
    } finally {
      setIsLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { refetch(); }, [refetch]);

  const navigateWeek = (direction: "prev" | "next") => {
    setCurrentWeek(addDays(currentWeek, direction === "next" ? 7 : -7));
  };

  return { stages, capacities, items, isLoading, error, days, weekStart, currentWeek, navigateWeek, refetch };
}

// UI building blocks
const StageHeaderCell: React.FC<{ name: string; color?: string | null; counts?: { active_jobs: number; pending_jobs: number } }>
  = ({ name, color, counts }) => (
  <div className="px-3 py-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color || 'hsl(var(--primary))' }} />
        <span className="font-medium text-sm text-foreground">{name}</span>
      </div>
      {counts && (
        <div className="flex items-center gap-1">
          <Badge variant="secondary">A {counts.active_jobs}</Badge>
          <Badge variant="outline">P {counts.pending_jobs}</Badge>
        </div>
      )}
    </div>
  </div>
);

const CapacityBar: React.FC<{ used: number; cap: number }>
  = ({ used, cap }) => {
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const color = pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-yellow-500" : pct >= 60 ? "bg-primary" : "bg-green-500";
  return (
    <div>
      <div className="flex justify-between items-center text-xs mb-1">
        <span>{Math.round(used / 60)}h / {Math.round(cap / 60)}h</span>
        <Badge variant={pct >= 100 ? "destructive" : pct >= 80 ? "secondary" : "default"}>{pct}%</Badge>
      </div>
      <div className="w-full bg-secondary rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const StageCellContainer: React.FC<{ id: string; children: React.ReactNode }>
  = ({ id, children }) => {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`min-h-[120px] p-2 rounded-md border transition-colors ${isOver ? "bg-primary/5 border-primary" : "bg-background"}`}>
      {children}
    </div>
  );
};

const DraggableStageItem: React.FC<{ item: ScheduledStageItem }>
  = ({ item }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 } as React.CSSProperties;
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="p-2 rounded-md border bg-card hover:shadow-sm cursor-grab active:cursor-grabbing">
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm truncate">{item.wo_no || "WO"}</div>
        {item.is_expedited && <Zap className="h-3 w-3 text-destructive" />}
      </div>
      <div className="text-xs text-muted-foreground truncate">{item.customer || "Customer"}</div>
      <div className="flex items-center gap-1 text-xs mt-1">
        <Clock className="h-3 w-3" />
        <span>{Math.max(1, Math.round((item.scheduled_minutes || 60)/60))}h</span>
      </div>
    </div>
  );
};

// Main Component
export const StageWeeklyScheduler: React.FC = () => {
  const { stages, capacities, items, isLoading, error, days, weekStart, currentWeek, navigateWeek, refetch } = useStageSchedule();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragItem, setDragItem] = useState<ScheduledStageItem | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const activeStageIds = useMemo(() => new Set(items.map(i => i.production_stage_id)), [items]);
  const filteredStages = useMemo(() => stages.filter(s => activeStageIds.has(s.id)), [stages, activeStageIds]);

  const { stageCounts } = useProductionStageCounts();
  const stageCountMap = useMemo(() => Object.fromEntries(stageCounts.map((c: any) => [c.stage_id, c])), [stageCounts]);

  // Build buckets per stage/day
  const buckets: Record<string, StageDayBucket> = useMemo(() => {
    const map: Record<string, StageDayBucket> = {};
    filteredStages.forEach(s => {
      days.forEach(d => {
        const dateStr = format(d, 'yyyy-MM-dd');
        const key = `${s.id}|${dateStr}`;
        const cap = capacities[s.id] ?? 8*60;
        const dayItems = items.filter(it => {
          if (it.production_stage_id !== s.id) return false;
          const dt = it.scheduled_start_at || it.scheduled_end_at;
          if (!dt) return false;
          const itemDateStr = format(new Date(dt), "yyyy-MM-dd");
          return itemDateStr === dateStr;
        });
        const used = dayItems.reduce((sum, it) => sum + (it.scheduled_minutes || 0), 0);
        map[key] = { date: dateStr, items: dayItems, usedMinutes: used, capacityMinutes: cap };
      });
    });
    return map;
  }, [filteredStages, days, capacities, items]);

  const onDragStart = (e: DragStartEvent) => {
    const id = e.active.id as string;
    const found = items.find(i => i.id === id) || null;
    setActiveId(id);
    setDragItem(found);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || !dragItem) { setActiveId(null); setDragItem(null); return; }

    // Determine target container (stage|date) even if dropped over an item
    let targetKey = over.id as string; // Either container id (stageId|yyyy-MM-dd) or item id
    if (!targetKey.includes("|")) {
      const foundEntry = Object.entries(buckets).find(([, b]) => b.items.some(i => i.id === targetKey));
      if (foundEntry) targetKey = foundEntry[0];
    }

    const [targetStageId, targetDate] = targetKey.split("|");

    try {
      const res = await schedulingService.manualRescheduleStage({
        stage_instance_id: dragItem.id,
        target_date: targetDate,
        job_table_name: 'production_jobs',
        production_stage_id: targetStageId,
      } as any);
      if (!res.ok) throw new Error(res.error || 'Failed');
      toast.success("Rescheduled successfully");
      await refetch();
    } catch (err: any) {
      console.error(err);
      toast.error("Reschedule failed");
    } finally {
      setActiveId(null);
      setDragItem(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Stage Weekly Planner</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center text-muted-foreground">Loading schedule…</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Stage Weekly Planner</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Stage Weekly Planner</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-medium min-w-[140px] text-center">Week of {format(weekStart, 'MMM dd, yyyy')}</span>
            <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="grid" style={{ gridTemplateColumns: `220px repeat(5, 1fr)` }}>
            {/* Header Row */}
            <div />
            {days.map(d => (
              <div key={d.toISOString()} className="px-3 py-2 font-medium text-sm">{format(d, 'EEE d')}</div>
            ))}

            {/* Rows per stage */}
            {filteredStages.map(stage => (
              <React.Fragment key={stage.id}>
                <StageHeaderCell 
                  name={stage.name} 
                  color={stage.color}
                  counts={stageCountMap[stage.id] ? { active_jobs: stageCountMap[stage.id].active_jobs, pending_jobs: stageCountMap[stage.id].pending_jobs } : undefined}
                />
                {days.map(d => {
                  const dateStr = format(d, 'yyyy-MM-dd');
                  const key = `${stage.id}|${dateStr}`;
                  const b = buckets[key];
                  return (
                    <div key={key} className="p-2 space-y-2">
                      <CapacityBar used={b?.usedMinutes || 0} cap={b?.capacityMinutes || 480} />
                      <StageCellContainer id={key}>
                        <SortableContext items={(b?.items || []).map(i => i.id)} strategy={verticalListSortingStrategy}>
                          <div className="space-y-2">
                            {(b?.items || []).length === 0 ? (
                              <div className="text-xs text-muted-foreground text-center py-4">No items</div>
                            ) : (
                              (b?.items || []).map(it => <DraggableStageItem key={it.id} item={it} />)
                            )}
                          </div>
                        </SortableContext>
                      </StageCellContainer>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          <DragOverlay>
            {activeId && dragItem ? (
              <div className="p-2 rounded-md border bg-card shadow-lg">
                <div className="font-medium text-sm">{dragItem.wo_no || "WO"}</div>
                <div className="text-xs text-muted-foreground">{dragItem.customer || "Customer"}</div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </CardContent>
    </Card>
  );
};
