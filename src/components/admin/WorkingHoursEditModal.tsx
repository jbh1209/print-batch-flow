import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Clock } from "lucide-react";

interface ShiftSchedule {
  id: string;
  day_of_week: number;
  shift_start_time: string;
  shift_end_time: string;
  is_working_day: boolean;
  is_active: boolean;
}

interface WorkingHoursEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: ShiftSchedule | null;
  onSave: (schedule: Partial<ShiftSchedule>) => void;
  dayName: string;
}

export const WorkingHoursEditModal: React.FC<WorkingHoursEditModalProps> = ({
  isOpen,
  onClose,
  schedule,
  onSave,
  dayName
}) => {
  const [formData, setFormData] = useState({
    shift_start_time: '08:00',
    shift_end_time: '16:30',
    is_working_day: true,
    is_active: true
  });

  useEffect(() => {
    if (schedule) {
      setFormData({
        shift_start_time: schedule.shift_start_time ? schedule.shift_start_time.substring(0, 5) : '08:00',
        shift_end_time: schedule.shift_end_time ? schedule.shift_end_time.substring(0, 5) : '16:30',
        is_working_day: schedule.is_working_day,
        is_active: schedule.is_active
      });
    }
  }, [schedule]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate times
    if (formData.is_working_day && formData.shift_start_time >= formData.shift_end_time) {
      alert('Start time must be before end time');
      return;
    }

    onSave({
      shift_start_time: `${formData.shift_start_time}:00`,
      shift_end_time: `${formData.shift_end_time}:00`,
      is_working_day: formData.is_working_day,
      is_active: formData.is_active
    });
  };

  const calculateHours = () => {
    if (!formData.is_working_day) return '0';
    
    const start = new Date(`2000-01-01T${formData.shift_start_time}:00`);
    const end = new Date(`2000-01-01T${formData.shift_end_time}:00`);
    const diffMs = end.getTime() - start.getTime();
    const hours = diffMs / (1000 * 60 * 60);
    
    return hours > 0 ? hours.toFixed(1) : '0';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Edit Working Hours - {dayName}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="is_working_day" className="text-sm font-medium">
                Working Day
              </Label>
              <Switch
                id="is_working_day"
                checked={formData.is_working_day}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, is_working_day: checked }))
                }
              />
            </div>

            {formData.is_working_day && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_time" className="text-sm font-medium">
                      Start Time
                    </Label>
                    <Input
                      id="start_time"
                      type="time"
                      value={formData.shift_start_time}
                      onChange={(e) => 
                        setFormData(prev => ({ ...prev, shift_start_time: e.target.value }))
                      }
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="end_time" className="text-sm font-medium">
                      End Time
                    </Label>
                    <Input
                      id="end_time"
                      type="time"
                      value={formData.shift_end_time}
                      onChange={(e) => 
                        setFormData(prev => ({ ...prev, shift_end_time: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>

                <div className="text-sm text-muted-foreground text-center">
                  Total Hours: {calculateHours()}h
                </div>
              </>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active" className="text-sm font-medium">
                Active Schedule
              </Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, is_active: checked }))
                }
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};