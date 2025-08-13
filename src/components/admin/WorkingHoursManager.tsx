import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Edit } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { WorkingHoursEditModal } from "./WorkingHoursEditModal";

interface ShiftSchedule {
  id: string;
  day_of_week: number;
  shift_start_time: string;
  shift_end_time: string;
  is_working_day: boolean;
  is_active: boolean;
}

const DAYS_OF_WEEK = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

export const WorkingHoursManager: React.FC = () => {
  const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSchedule, setEditingSchedule] = useState<ShiftSchedule | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('shift_schedules')
        .select('*')
        .order('day_of_week');

      if (error) throw error;
      setSchedules(data || []);
    } catch (err: any) {
      toast.error(`Failed to load working hours: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (schedule: ShiftSchedule) => {
    setEditingSchedule(schedule);
    setIsModalOpen(true);
  };

  const handleSave = async (updatedSchedule: Partial<ShiftSchedule>) => {
    try {
      const { error } = await supabase
        .from('shift_schedules')
        .update({
          shift_start_time: updatedSchedule.shift_start_time,
          shift_end_time: updatedSchedule.shift_end_time,
          is_working_day: updatedSchedule.is_working_day,
          is_active: updatedSchedule.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingSchedule?.id);

      if (error) throw error;

      toast.success("Working hours updated successfully");
      fetchSchedules();
      setIsModalOpen(false);
      setEditingSchedule(null);
    } catch (err: any) {
      toast.error(`Failed to update working hours: ${err.message}`);
    }
  };

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Working Hours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading working hours...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Working Hours Configuration
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage daily working hours for the production scheduler. Changes take effect immediately.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {DAYS_OF_WEEK.map((dayName, dayIndex) => {
            const schedule = schedules.find(s => s.day_of_week === dayIndex);
            
            return (
              <div key={dayIndex} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-20 font-medium">
                    {dayName}
                  </div>
                  {schedule ? (
                    <>
                      <div className="flex items-center gap-2">
                        {schedule.is_working_day ? (
                          <>
                            <Badge variant="secondary">
                              {formatTime(schedule.shift_start_time)} - {formatTime(schedule.shift_end_time)}
                            </Badge>
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              Working Day
                            </Badge>
                          </>
                        ) : (
                          <Badge variant="outline" className="text-red-600 border-red-600">
                            Non-Working Day
                          </Badge>
                        )}
                        {!schedule.is_active && (
                          <Badge variant="destructive">Inactive</Badge>
                        )}
                      </div>
                    </>
                  ) : (
                    <Badge variant="outline" className="text-orange-600 border-orange-600">
                      Not Configured
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(schedule || {
                    id: '',
                    day_of_week: dayIndex,
                    shift_start_time: '08:00:00',
                    shift_end_time: '16:30:00',
                    is_working_day: dayIndex >= 1 && dayIndex <= 5, // Mon-Fri default
                    is_active: true
                  } as ShiftSchedule)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <WorkingHoursEditModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSchedule(null);
        }}
        schedule={editingSchedule}
        onSave={handleSave}
        dayName={editingSchedule ? DAYS_OF_WEEK[editingSchedule.day_of_week] : ''}
      />
    </>
  );
};