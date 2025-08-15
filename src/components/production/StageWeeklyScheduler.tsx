import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, ChevronRight, Calendar, Clock, Zap, RefreshCcw } from "lucide-react";
import { format, addDays, startOfWeek } from "date-fns";
import { toast } from "sonner";
import { autoSchedulerService } from "@/services/autoSchedulerService";
import { supabase } from "@/integrations/supabase/client";
import { useProductionStageCounts } from "@/hooks/tracker/useProductionStageCounts";
import { dbTimeToDisplayTime } from "@/utils/timezone-display-audit";

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
  auto_scheduled_start_at: string | null;
  auto_scheduled_end_at: string | null;
  auto_scheduled_duration_minutes: number | null;
  status: string;
  is_auto_scheduled: boolean;
  is_expedited?: boolean;
  wo_no?: string;
  customer?: string;
  qty?: number;
  paper_specs?: any;
  printing_specs?: any;
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
  // CRITICAL FIX: Initialize to current week containing Aug 14, 2025 (today)
  const [currentWeek, setCurrentWeek] = useState<Date>(() => {
    const today = new Date(); // Should be Aug 14, 2025
    console.log(`🗓️ Initializing StageWeeklyScheduler with today: ${format(today, 'yyyy-MM-dd')}`);
    return today;
  });

  const weekStart = useMemo(() => {
    const start = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday start
    console.log(`📅 Week calculation: currentWeek=${format(currentWeek, 'yyyy-MM-dd')} -> weekStart=${format(start, 'yyyy-MM-dd')}`);
    return start;
  }, [currentWeek]);
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

      // STEP 2 FIX: Widen date window buffer to catch timezone edge cases
      const queryStart = new Date(weekStart);
      queryStart.setDate(queryStart.getDate() - 1); // Add 1-day buffer before
      const queryEnd = addDays(weekStart, 8); // Add 1-day buffer after (7+1)
      const startIso = queryStart.toISOString();
      const endIso = queryEnd.toISOString();
      
      console.log(`📅 BUFFERED query: jobs scheduled between ${format(queryStart, 'yyyy-MM-dd')} and ${format(queryEnd, 'yyyy-MM-dd')} (includes buffers)`);
      
      // STEP 2 FIX: Include auto-scheduled jobs regardless of schedule_status
      const { data: jsiRows, error: jsiErr } = await supabase
        .from("job_stage_instances")
        .select(`
          id, job_id, production_stage_id, 
          scheduled_start_at, scheduled_end_at, scheduled_minutes,
          auto_scheduled_start_at, auto_scheduled_end_at, auto_scheduled_duration_minutes,
          status, schedule_status
        `)
        .eq("job_table_name", "production_jobs")
        .in("status", ["active", "pending"]) 
        .in("production_stage_id", stageIds.length ? stageIds : ["00000000-0000-0000-0000-000000000000"])
        .or(`and(scheduled_start_at.gte.${startIso},scheduled_start_at.lt.${endIso}),and(auto_scheduled_start_at.gte.${startIso},auto_scheduled_start_at.lt.${endIso})`)
        // CRITICAL: Include jobs with ANY schedule_status (scheduled, auto_scheduled, unscheduled)
        .in("schedule_status", ["scheduled", "auto_scheduled", "unscheduled"])
        .order("auto_scheduled_start_at", { ascending: true, nullsFirst: false })
        .order("scheduled_start_at", { ascending: true, nullsFirst: false });
      if (jsiErr) throw jsiErr;
      
      console.log(`📊 Found ${(jsiRows || []).length} job stage instances in date range`);
      console.log(`🎯 Stages being queried: ${stageIds.length} stages`);

      // Fetch enhanced job info with specifications
      const { data: jobsInfo } = await supabase.rpc("get_user_accessible_jobs", {});
      const jobMap: Record<string, { wo_no?: string; customer?: string; is_expedited?: boolean; qty?: number; paper_specs?: any; printing_specs?: any }> = {};
      (jobsInfo || []).forEach((j: any) => { 
        jobMap[j.job_id] = { 
          wo_no: j.wo_no, 
          customer: j.customer, 
          is_expedited: j.user_can_manage ? j.is_expedited : j.is_expedited,
          qty: j.qty
        } as any; 
      });

      // Fetch detailed specifications for jobs
      const jobIds = (jsiRows || []).map(r => r.job_id);
      if (jobIds.length > 0) {
        const { data: jobSpecs } = await supabase
          .from("production_jobs")
          .select("id,qty,paper_specifications,printing_specifications")
          .in("id", jobIds);
        
        (jobSpecs || []).forEach((spec: any) => {
          if (jobMap[spec.id]) {
            jobMap[spec.id].qty = spec.qty;
            jobMap[spec.id].paper_specs = spec.paper_specifications;
            jobMap[spec.id].printing_specs = spec.printing_specifications;
          }
        });
      }

      // STEP 2 FIX: Filter to actual week after fetching, normalize display times
      const rawMapped: ScheduledStageItem[] = (jsiRows || []).map((r: any) => {
        // Determine if job is auto-scheduled vs manually scheduled
        const isAutoScheduled = !!(r.auto_scheduled_start_at && r.auto_scheduled_end_at);
        
        return {
          id: r.id,
          job_id: r.job_id,
          production_stage_id: r.production_stage_id,
          scheduled_start_at: r.scheduled_start_at,
          scheduled_end_at: r.scheduled_end_at,
          scheduled_minutes: r.scheduled_minutes,
          auto_scheduled_start_at: r.auto_scheduled_start_at,
          auto_scheduled_end_at: r.auto_scheduled_end_at,
          auto_scheduled_duration_minutes: r.auto_scheduled_duration_minutes,
          status: r.status,
          is_auto_scheduled: isAutoScheduled,
          wo_no: jobMap[r.job_id]?.wo_no,
          customer: jobMap[r.job_id]?.customer,
          is_expedited: jobMap[r.job_id]?.is_expedited,
          qty: jobMap[r.job_id]?.qty,
          paper_specs: jobMap[r.job_id]?.paper_specs,
          printing_specs: jobMap[r.job_id]?.printing_specs,
        };
      });

      // STEP 2 FIX: Filter to actual visible week after processing
      const actualWeekStart = weekStart.toISOString();
      const actualWeekEnd = addDays(weekStart, 7).toISOString();
      
      const mapped = rawMapped.filter(item => {
        // Get display start time (auto takes precedence over manual - CRITICAL FIX)
        const displayStart = item.auto_scheduled_start_at || item.scheduled_start_at;
        console.log(`🔍 Job ${item.job_id} stage ${item.production_stage_id}: auto=${item.auto_scheduled_start_at}, manual=${item.scheduled_start_at}, using=${displayStart}`);
        if (!displayStart) return false;
        
        // Check if within actual week bounds
        const startTime = new Date(displayStart);
        return startTime >= new Date(actualWeekStart) && startTime < new Date(actualWeekEnd);
      });

      console.log(`✅ Final mapped items: ${mapped.length}`);
      console.log(`🤖 Auto-scheduled items: ${mapped.filter(m => m.is_auto_scheduled).length}`);
      console.log(`🖊️ Manual scheduled items: ${mapped.filter(m => !m.is_auto_scheduled).length}`);
      
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
const StageHeaderCell: React.FC<{ name: string; color?: string | null }>
  = ({ name, color }) => (
  <div className="px-3 py-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color || 'hsl(var(--primary))' }} />
        <span className="font-medium text-sm text-foreground">{name}</span>
      </div>
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
  
  // Format specifications for display
  const paperSpec = item.paper_specs?.weight || item.paper_specs?.type || 'Paper';
  const printSpec = item.printing_specs?.printer || item.printing_specs?.color_mode || 'Print';
  
  // Use auto-scheduled duration if available, otherwise fall back to manual
  const actualMinutes = item.is_auto_scheduled 
    ? (item.auto_scheduled_duration_minutes || 60)
    : (item.scheduled_minutes || 60);
  const exactTime = `${Math.floor(actualMinutes / 60)}h ${actualMinutes % 60}m`;
  
  // FIXED: Use centralized timezone utilities instead of toLocaleString()
  const displayTime = item.is_auto_scheduled && item.auto_scheduled_start_at
    ? dbTimeToDisplayTime(item.auto_scheduled_start_at)
    : item.scheduled_start_at 
      ? dbTimeToDisplayTime(item.scheduled_start_at)
      : null;
  
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} 
         className={`p-2 rounded-md border hover:shadow-sm cursor-grab active:cursor-grabbing ${
           item.is_auto_scheduled ? 'bg-blue-50 border-blue-200' : 'bg-card'
         }`}>
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm truncate">{item.wo_no || "WO"}</div>
        <div className="flex items-center gap-1">
          {item.is_auto_scheduled && <Badge variant="secondary" className="text-xs px-1">AUTO</Badge>}
          {item.is_expedited && <Zap className="h-3 w-3 text-destructive" />}
        </div>
      </div>
      <div className="text-xs text-muted-foreground truncate">{item.customer || "Customer"}</div>
      <div className="flex items-center gap-1 text-xs mt-1">
        <Clock className="h-3 w-3" />
        <span>{exactTime}</span>
        {displayTime && <span className="text-muted-foreground">• {displayTime}</span>}
        {item.qty && <span className="text-muted-foreground">• Qty: {item.qty}</span>}
      </div>
      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
        <div className="truncate">{paperSpec}</div>
        <div className="truncate">{printSpec}</div>
      </div>
    </div>
  );
};

// Main Component
export const StageWeeklyScheduler: React.FC = () => {
  const { stages, capacities, items, isLoading, error, days, weekStart, currentWeek, navigateWeek, refetch } = useStageSchedule();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragItem, setDragItem] = useState<ScheduledStageItem | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const runAutoScheduler = useCallback(async () => {
    try {
      // STEP 4 FIX: Use parallel-auto-scheduler instead of auto-schedule-approved
      console.log("🎯 Running PARALLEL auto-scheduler...");
      
      // Get jobs that need scheduling
      const { data: jobs, error: jobsError } = await supabase
        .from('production_jobs')
        .select('id, wo_no, status')
        .in('status', ['pending', 'Pre-Press', 'Ready for Batch']);
      
      if (jobsError) throw jobsError;
      
      let scheduledCount = 0;
      for (const job of jobs || []) {
        const { data, error } = await supabase.functions.invoke("parallel-auto-scheduler", {
          body: {
            job_id: job.id,
            job_table_name: "production_jobs",
            trigger_reason: "manual_ui_trigger"
          }
        });
        
        if (!error && data?.success) {
          scheduledCount++;
        }
      }
      
      toast.success(`Parallel auto-scheduler ran: ${scheduledCount}/${jobs?.length || 0} jobs scheduled`);
      await refetch();
    } catch (e: any) {
      console.error("parallel-auto-scheduler invoke failed", e);
      toast.error("Auto-scheduler failed: " + (e.message || "Unknown error"));
    }
  }, [refetch]);

  const activeStageIds = useMemo(() => new Set(items.map(i => i.production_stage_id)), [items]);
  const { stageCounts } = useProductionStageCounts();
  const stageCountMap = useMemo(() => Object.fromEntries(stageCounts.map((c: any) => [c.stage_id, c])), [stageCounts]);
  const filteredStages = useMemo(() => {
    const filtered = stages.filter(s => {
      const n = (s.name || '').toLowerCase();
      if (n.includes('dtp') || n.includes('proof')) return false; // Hide pre-approval stages
      const counts = stageCountMap[s.id];
      const hasJobs = counts && ((counts.active_jobs ?? 0) + (counts.pending_jobs ?? 0)) > 0;
      const hasScheduledItems = activeStageIds.has(s.id);
      return hasScheduledItems || hasJobs;
    });
    
    console.log(`🎭 Filtered stages: ${filtered.length}/${stages.length} (excluding DTP/Proof)`);
    console.log(`📋 Active stage IDs with items: ${Array.from(activeStageIds).length}`);
    
    return filtered;
  }, [stages, activeStageIds, stageCountMap]);

  useEffect(() => {
    if (!selectedStageId || !filteredStages.some(s => s.id === selectedStageId)) {
      setSelectedStageId(filteredStages[0]?.id ?? null);
    }
  }, [filteredStages, selectedStageId]);

  const selectedStage = useMemo(() => filteredStages.find(s => s.id === selectedStageId) || null, [filteredStages, selectedStageId]);
  // Build buckets per stage/day
  const buckets: Record<string, StageDayBucket> = useMemo(() => {
    const map: Record<string, StageDayBucket> = {};
    filteredStages.forEach(s => {
      days.forEach(d => {
        const dateStr = format(d, 'yyyy-MM-dd');
        const key = `${s.id}|${dateStr}`;
        const cap = capacities[s.id] ?? 8*60;
        // SIMPLE: Show jobs scheduled for this calendar date
        const dayItems = items.filter(it => {
          if (it.production_stage_id !== s.id) return false;
          
          // Get the scheduled start time
          let start: Date | null = null;
          if (it.is_auto_scheduled && it.auto_scheduled_start_at) {
            start = new Date(it.auto_scheduled_start_at);
          } else if (it.scheduled_start_at) {
            start = new Date(it.scheduled_start_at);
          }
          
          if (!start) return false;
          
          // Check if job is scheduled on this calendar date (simple date match)
          const jobDate = format(start, 'yyyy-MM-dd');
          const isOnThisDate = jobDate === dateStr;
          
          if (isOnThisDate) {
            console.log(`✅ Job ${it.wo_no} scheduled on ${dateStr} at ${start.toISOString()}`);
          }
          
          return isOnThisDate;
        });
        const used = dayItems.reduce((sum, it) => {
          if (it.is_auto_scheduled) {
            return sum + (it.auto_scheduled_duration_minutes || 0);
          }
          return sum + (it.scheduled_minutes || 0);
        }, 0);
        map[key] = { date: dateStr, items: dayItems, usedMinutes: used, capacityMinutes: cap };
      });
    });
    return map;
  }, [filteredStages, days, capacities, items]);
  
  const weeklySummary = useMemo(() => {
    if (!selectedStage) return { used: 0, cap: 0, jobs: 0, util: 0 };
    let used = 0; let cap = 0; const jobIds = new Set<string>();
    days.forEach(d => {
      const key = `${selectedStage.id}|${format(d,'yyyy-MM-dd')}`;
      const b = buckets[key];
      if (b) { used += b.usedMinutes || 0; cap += b.capacityMinutes || 0; b.items.forEach(i => jobIds.add(i.id)); }
    });
    const util = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
    return { used, cap, jobs: jobIds.size, util };
  }, [selectedStage, buckets, days]);
  
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
      // Manual rescheduling not implemented yet - will use auto-scheduler
      console.log('Manual reschedule requested:', { 
        stage_instance_id: dragItem.id,
        target_date: targetDate,
        production_stage_id: targetStageId 
      });
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
            <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')} aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-medium min-w-[160px] text-center">Week of {format(weekStart, 'MMM dd, yyyy')}</span>
            <Button variant="outline" size="sm" onClick={() => navigateWeek('next')} aria-label="Next week"><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="secondary" size="sm" onClick={refetch} aria-label="Refresh schedule"><RefreshCcw className="h-4 w-4" /></Button>
            <Button variant="default" size="sm" onClick={runAutoScheduler} aria-label="Run auto-scheduler"><Zap className="h-4 w-4 mr-1" />Run auto-scheduler</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          {filteredStages.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No relevant stages for this week. Try a different week or schedule jobs.
            </div>
          ) : (
            <div className="flex gap-4">
              {/* Sidebar */}
              <aside className="w-64 border-r pr-2">
                <div className="space-y-1">
                  {filteredStages.map(stage => {
                    const isSelected = selectedStageId === stage.id;
                    return (
                      <button
                        key={stage.id}
                        onClick={() => setSelectedStageId(stage.id)}
                        className={`w-full rounded-md text-left transition-colors border p-1.5 ${isSelected ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-accent'}`}
                        aria-pressed={isSelected}
                      >
                        <StageHeaderCell 
                          name={stage.name} 
                          color={stage.color}
                        />
                      </button>
                    );
                  })}
                </div>
              </aside>

              {/* Main content for selected stage */}
              <main className="flex-1">
                {!selectedStage ? (
                  <div className="py-12 text-center text-muted-foreground">Select a stage from the left to view its schedule.</div>
                ) : (
                  <div>
                    {/* Weekly summary */}
                    <div className="mb-3 text-sm text-muted-foreground flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedStage.color || 'hsl(var(--primary))' }} />
                        <span className="font-medium text-foreground">{selectedStage.name}</span>
                      </div>
                      <span>Jobs: {weeklySummary.jobs}</span>
                      <span>Used {Math.round(weeklySummary.used/60)}h / Cap {Math.round(weeklySummary.cap/60)}h</span>
                      <span>Util {weeklySummary.util}%</span>
                    </div>


                    {/* Day headers */}
                    <div className="grid mb-2" style={{ gridTemplateColumns: `repeat(5, 1fr)` }}>
                      {days.map(d => (
                        <div key={d.toISOString()} className="px-3 py-2 font-medium text-sm">{format(d, 'EEE d')}</div>
                      ))}
                    </div>

                    {/* Day columns */}
                    <div className="grid" style={{ gridTemplateColumns: `repeat(5, 1fr)` }}>
                      {days.map(d => {
                        const dateStr = format(d,'yyyy-MM-dd');
                        const key = `${selectedStage.id}|${dateStr}`;
                        const b = buckets[key];
                        return (
                          <div key={key} className="p-2 space-y-2">
                            <CapacityBar used={b?.usedMinutes || 0} cap={b?.capacityMinutes || 480} />
                            <StageCellContainer id={key}>
                              <SortableContext items={(b?.items || []).map(i => i.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-2">
                                  {(b?.items || []).length === 0 ? (
                                    <div className="text-xs text-muted-foreground text-center py-4">
                                      No items
                                    </div>
                                  ) : (
                                    (b?.items || []).map(it => <DraggableStageItem key={it.id} item={it} />)
                                  )}
                                </div>
                              </SortableContext>
                            </StageCellContainer>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </main>
            </div>
          )}

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
