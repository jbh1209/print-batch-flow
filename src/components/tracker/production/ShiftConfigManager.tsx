import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Clock, Settings, Calendar } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface StageCapacity {
  id: string;
  production_stage_id: string;
  stage_name: string;
  daily_capacity_hours: number;
  shift_hours_per_day: number;
  working_days_per_week: number;
  efficiency_factor: number;
  is_bottleneck: boolean;
}

export const ShiftConfigManager: React.FC = () => {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch stage capacity profiles
  const { data: stageCapacities, isLoading } = useQuery({
    queryKey: ['stage-capacity-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stage_capacity_profiles')
        .select(`
          id,
          production_stage_id,
          daily_capacity_hours,
          shift_hours_per_day,
          working_days_per_week,
          efficiency_factor,
          is_bottleneck,
          production_stages!inner(name)
        `)
        .order('daily_capacity_hours', { ascending: false });

      if (error) throw error;
      
      return data?.map(item => ({
        ...item,
        stage_name: (item as any).production_stages?.name || 'Unknown Stage'
      })) as StageCapacity[];
    }
  });

  // Update stage capacity mutation
  const updateCapacityMutation = useMutation({
    mutationFn: async (updates: { 
      stageId: string; 
      dailyHours: number; 
      shiftHours: number; 
      workingDays: number;
      efficiency: number;
    }) => {
      const { error } = await supabase
        .from('stage_capacity_profiles')
        .update({
          daily_capacity_hours: updates.dailyHours,
          shift_hours_per_day: updates.shiftHours,
          working_days_per_week: updates.workingDays,
          efficiency_factor: updates.efficiency
        })
        .eq('production_stage_id', updates.stageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stage-capacity-profiles'] });
      toast.success('Shift configuration updated successfully');
    },
    onError: (error) => {
      console.error('Error updating shift config:', error);
      toast.error('Failed to update shift configuration');
    }
  });

  const handleUpdateCapacity = (stage: StageCapacity, updates: Partial<StageCapacity>) => {
    updateCapacityMutation.mutate({
      stageId: stage.production_stage_id,
      dailyHours: updates.daily_capacity_hours ?? stage.daily_capacity_hours,
      shiftHours: updates.shift_hours_per_day ?? stage.shift_hours_per_day,
      workingDays: updates.working_days_per_week ?? stage.working_days_per_week,
      efficiency: updates.efficiency_factor ?? stage.efficiency_factor
    });
  };

  const extendAllShifts = (additionalHours: number) => {
    if (!stageCapacities) return;
    
    stageCapacities.forEach(stage => {
      updateCapacityMutation.mutate({
        stageId: stage.production_stage_id,
        dailyHours: stage.daily_capacity_hours + additionalHours,
        shiftHours: stage.shift_hours_per_day + additionalHours,
        workingDays: stage.working_days_per_week,
        efficiency: stage.efficiency_factor
      });
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            <span>Loading shift configuration...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Shift Configuration Manager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button 
              variant="outline" 
              onClick={() => extendAllShifts(2)}
              disabled={updateCapacityMutation.isPending}
            >
              <Clock className="h-4 w-4 mr-2" />
              Extend All Shifts +2hrs
            </Button>
            <Button 
              variant="outline" 
              onClick={() => extendAllShifts(4)}
              disabled={updateCapacityMutation.isPending}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Busy Period +4hrs
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            Current operating schedule: Monday to Friday, 8:00 AM - 4:30 PM (Standard)
          </div>
        </CardContent>
      </Card>

      {/* Stage Capacity Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Stage Capacity Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {stageCapacities?.map((stage) => (
              <div key={stage.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{stage.stage_name}</h3>
                    {stage.is_bottleneck && (
                      <Badge variant="destructive" className="text-xs">
                        Bottleneck
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedStage(
                      selectedStage === stage.production_stage_id ? null : stage.production_stage_id
                    )}
                  >
                    {selectedStage === stage.production_stage_id ? 'Collapse' : 'Configure'}
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Daily Hours</Label>
                    <div className="font-medium">{stage.daily_capacity_hours}h</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Shift Length</Label>
                    <div className="font-medium">{stage.shift_hours_per_day}h</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Working Days</Label>
                    <div className="font-medium">{stage.working_days_per_week} days/week</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Efficiency</Label>
                    <div className="font-medium">{Math.round(stage.efficiency_factor * 100)}%</div>
                  </div>
                </div>

                {selectedStage === stage.production_stage_id && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`daily-${stage.id}`}>Daily Capacity Hours</Label>
                        <Input
                          id={`daily-${stage.id}`}
                          type="number"
                          min="1"
                          max="24"
                          defaultValue={stage.daily_capacity_hours}
                          onBlur={(e) => {
                            const value = parseInt(e.target.value);
                            if (value !== stage.daily_capacity_hours) {
                              handleUpdateCapacity(stage, { daily_capacity_hours: value });
                            }
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`shift-${stage.id}`}>Shift Hours Per Day</Label>
                        <Input
                          id={`shift-${stage.id}`}
                          type="number"
                          min="1"
                          max="24"
                          defaultValue={stage.shift_hours_per_day}
                          onBlur={(e) => {
                            const value = parseInt(e.target.value);
                            if (value !== stage.shift_hours_per_day) {
                              handleUpdateCapacity(stage, { shift_hours_per_day: value });
                            }
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`efficiency-${stage.id}`}>Efficiency Factor (%)</Label>
                        <Input
                          id={`efficiency-${stage.id}`}
                          type="number"
                          min="10"
                          max="100"
                          defaultValue={Math.round(stage.efficiency_factor * 100)}
                          onBlur={(e) => {
                            const value = parseInt(e.target.value) / 100;
                            if (value !== stage.efficiency_factor) {
                              handleUpdateCapacity(stage, { efficiency_factor: value });
                            }
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`working-days-${stage.id}`}>Working Days/Week</Label>
                        <Input
                          id={`working-days-${stage.id}`}
                          type="number"
                          min="1"
                          max="7"
                          defaultValue={stage.working_days_per_week}
                          onBlur={(e) => {
                            const value = parseInt(e.target.value);
                            if (value !== stage.working_days_per_week) {
                              handleUpdateCapacity(stage, { working_days_per_week: value });
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};