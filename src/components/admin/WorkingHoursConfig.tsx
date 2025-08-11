import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface WorkingHoursSettings {
  work_start_hour: number;
  work_end_hour: number;
  work_end_minute: number;
  busy_period_active: boolean;
  busy_start_hour: number;
  busy_end_hour: number;
  busy_end_minute: number;
}

export function WorkingHoursConfig() {
  const [settings, setSettings] = useState<WorkingHoursSettings>({
    work_start_hour: 8,
    work_end_hour: 16,
    work_end_minute: 30,
    busy_period_active: false,
    busy_start_hour: 8,
    busy_end_hour: 18,
    busy_end_minute: 0,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_working_hours_config');
      
      if (error) {
        console.error('Error loading working hours:', error);
        toast.error('Failed to load working hours configuration');
        return;
      }

      if (data && data.length > 0) {
        setSettings(data[0]);
      }
    } catch (error) {
      console.error('Error loading working hours:', error);
      toast.error('Failed to load working hours configuration');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Update all working hours settings
      const updates = [
        { setting_type: 'working_hours', sla_target_days: settings.work_start_hour },
        { setting_type: 'working_hours_end', sla_target_days: settings.work_end_hour },
        { setting_type: 'working_hours_end_minute', sla_target_days: settings.work_end_minute },
        { setting_type: 'busy_period_active', sla_target_days: settings.busy_period_active ? 1 : 0 },
        { setting_type: 'busy_period_start_hour', sla_target_days: settings.busy_start_hour },
        { setting_type: 'busy_period_end_hour', sla_target_days: settings.busy_end_hour },
        { setting_type: 'busy_period_end_minute', sla_target_days: settings.busy_end_minute },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('app_settings')
          .upsert({
            setting_type: update.setting_type,
            product_type: 'global',
            sla_target_days: update.sla_target_days,
            updated_at: new Date().toISOString(),
          });

        if (error) {
          throw error;
        }
      }

      toast.success('Working hours configuration updated successfully');
    } catch (error) {
      console.error('Error saving working hours:', error);
      toast.error('Failed to save working hours configuration');
    } finally {
      setSaving(false);
    }
  };

  const normalWorkingMinutes = (settings.work_end_hour - settings.work_start_hour) * 60 + settings.work_end_minute;
  const busyPeriodMinutes = (settings.busy_end_hour - settings.busy_start_hour) * 60 + settings.busy_end_minute;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Working Hours Configuration...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Working Hours Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Normal Working Hours */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Normal Working Hours</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="work_start_hour">Start Hour</Label>
              <Input
                id="work_start_hour"
                type="number"
                min="0"
                max="23"
                value={settings.work_start_hour}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  work_start_hour: parseInt(e.target.value) || 0 
                }))}
              />
            </div>
            <div>
              <Label htmlFor="work_end_hour">End Hour</Label>
              <Input
                id="work_end_hour"
                type="number"
                min="0"
                max="23"
                value={settings.work_end_hour}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  work_end_hour: parseInt(e.target.value) || 0 
                }))}
              />
            </div>
            <div>
              <Label htmlFor="work_end_minute">End Minute</Label>
              <Input
                id="work_end_minute"
                type="number"
                min="0"
                max="59"
                value={settings.work_end_minute}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  work_end_minute: parseInt(e.target.value) || 0 
                }))}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Normal schedule: {settings.work_start_hour}:00 - {settings.work_end_hour}:{settings.work_end_minute.toString().padStart(2, '0')} 
            ({Math.floor(normalWorkingMinutes / 60)}h {normalWorkingMinutes % 60}m)
          </p>
        </div>

        {/* Busy Period Settings */}
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <Switch
              id="busy_period_active"
              checked={settings.busy_period_active}
              onCheckedChange={(checked) => setSettings(prev => ({ 
                ...prev, 
                busy_period_active: checked 
              }))}
            />
            <Label htmlFor="busy_period_active" className="text-lg font-semibold">
              Busy Period Mode
            </Label>
          </div>
          
          {settings.busy_period_active && (
            <div className="pl-6 border-l-2 border-orange-200">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="busy_start_hour">Busy Start Hour</Label>
                  <Input
                    id="busy_start_hour"
                    type="number"
                    min="0"
                    max="23"
                    value={settings.busy_start_hour}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      busy_start_hour: parseInt(e.target.value) || 0 
                    }))}
                  />
                </div>
                <div>
                  <Label htmlFor="busy_end_hour">Busy End Hour</Label>
                  <Input
                    id="busy_end_hour"
                    type="number"
                    min="0"
                    max="23"
                    value={settings.busy_end_hour}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      busy_end_hour: parseInt(e.target.value) || 0 
                    }))}
                  />
                </div>
                <div>
                  <Label htmlFor="busy_end_minute">Busy End Minute</Label>
                  <Input
                    id="busy_end_minute"
                    type="number"
                    min="0"
                    max="59"
                    value={settings.busy_end_minute}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      busy_end_minute: parseInt(e.target.value) || 0 
                    }))}
                  />
                </div>
              </div>
              <p className="text-sm text-orange-600 mt-2">
                Busy period schedule: {settings.busy_start_hour}:00 - {settings.busy_end_hour}:{settings.busy_end_minute.toString().padStart(2, '0')} 
                ({Math.floor(busyPeriodMinutes / 60)}h {busyPeriodMinutes % 60}m)
              </p>
            </div>
          )}
        </div>

        {/* Current Status */}
        <div className="bg-muted p-4 rounded-lg">
          <h4 className="font-semibold mb-2">Current Active Schedule</h4>
          {settings.busy_period_active ? (
            <p className="text-orange-600 font-medium">
              🚨 BUSY PERIOD ACTIVE: {settings.busy_start_hour}:00 - {settings.busy_end_hour}:{settings.busy_end_minute.toString().padStart(2, '0')} 
              ({Math.floor(busyPeriodMinutes / 60)}h {busyPeriodMinutes % 60}m per day)
            </p>
          ) : (
            <p className="text-green-600 font-medium">
              ✅ Normal hours: {settings.work_start_hour}:00 - {settings.work_end_hour}:{settings.work_end_minute.toString().padStart(2, '0')} 
              ({Math.floor(normalWorkingMinutes / 60)}h {normalWorkingMinutes % 60}m per day)
            </p>
          )}
        </div>

        {/* Save Button */}
        <Button 
          onClick={saveSettings} 
          disabled={saving}
          className="w-full"
        >
          {saving ? 'Saving...' : 'Save Working Hours Configuration'}
        </Button>

        {/* Warning */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            ⚠️ <strong>Important:</strong> Changes to working hours will affect all new scheduling calculations. 
            Existing scheduled jobs will not be automatically rescheduled.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}