import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar, Clock, Package } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays, subWeeks, addWeeks, isToday } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface JobOrder {
  id: string;
  wo_no: string;
  customer: string;
  description: string;
  status: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  estimated_hours: number;
  current_stage?: string;
  due_date?: string;
}

interface ScheduleSlot {
  date: Date;
  dayName: string;
  shift: 'morning' | 'afternoon';
  orders: JobOrder[];
  totalHours: number;
  capacity: number; // 4 hours per shift
}

export const WeeklyScheduleBoard: React.FC = () => {
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [scheduleData, setScheduleData] = useState<ScheduleSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate week boundaries
  const weekStart = useMemo(() => {
    return startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday start
  }, [currentWeek]);

  const weekEnd = useMemo(() => {
    return endOfWeek(currentWeek, { weekStartsOn: 1 }); // Sunday end
  }, [currentWeek]);

  // Generate schedule slots for Monday-Friday
  const generateScheduleSlots = useMemo(() => {
    const slots: ScheduleSlot[] = [];
    
    // Monday to Friday (5 days)
    for (let i = 0; i < 5; i++) {
      const date = addDays(weekStart, i);
      const dayName = format(date, 'EEEE');
      
      // Morning shift (8:00 AM - 12:00 PM)
      slots.push({
        date,
        dayName,
        shift: 'morning',
        orders: [],
        totalHours: 0,
        capacity: 4 // 4 hours capacity
      });
      
      // Afternoon shift (1:00 PM - 5:00 PM)
      slots.push({
        date,
        dayName,
        shift: 'afternoon',
        orders: [],
        totalHours: 0,
        capacity: 4 // 4 hours capacity
      });
    }
    
    return slots;
  }, [weekStart]);

  // Load production jobs for the week
  const loadWeeklyJobs = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get all active production jobs
      const { data: jobs, error: jobsError } = await supabase
        .from('production_jobs')
        .select('*')
        .in('status', ['pending', 'active', 'Pre-Press', 'Ready for Batch'])
        .order('created_at', { ascending: true });

      if (jobsError) {
        throw jobsError;
      }

      // For now, just populate the slots structure without actual scheduling
      // This will be enhanced when we add date/time assignment functionality
      const updatedSlots = generateScheduleSlots.map(slot => ({
        ...slot,
        orders: [], // Will be populated when jobs have schedule assignments
        totalHours: 0
      }));

      setScheduleData(updatedSlots);
      
      console.log(`📅 Weekly Schedule: ${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`);
      console.log(`🏭 Found ${jobs?.length || 0} active jobs (not yet scheduled to time slots)`);
      
    } catch (err) {
      console.error('Error loading weekly jobs:', err);
      setError(`Failed to load jobs: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Navigation functions
  const goToPreviousWeek = () => {
    setCurrentWeek(prev => subWeeks(prev, 1));
  };

  const goToNextWeek = () => {
    setCurrentWeek(prev => addWeeks(prev, 1));
  };

  const goToCurrentWeek = () => {
    setCurrentWeek(new Date());
  };

  // Load data when week changes
  useEffect(() => {
    loadWeeklyJobs();
  }, [currentWeek]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'normal': return 'bg-blue-500 text-white';
      case 'low': return 'bg-gray-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getShiftTimeLabel = (shift: 'morning' | 'afternoon') => {
    return shift === 'morning' ? '8:00 AM - 12:00 PM' : '1:00 PM - 5:00 PM';
  };

  const getCapacityColor = (used: number, capacity: number) => {
    const percentage = (used / capacity) * 100;
    if (percentage >= 100) return 'text-red-600';
    if (percentage >= 80) return 'text-orange-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="text-red-800">
            <h3 className="font-semibold mb-2">Error Loading Schedule</h3>
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Week Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Calendar className="h-6 w-6 text-primary" />
                Weekly Schedule Board
              </CardTitle>
              <CardDescription>
                Production schedule for {format(weekStart, 'MMMM d')} - {format(weekEnd, 'd, yyyy')}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
                This Week
              </Button>
              <Button variant="outline" size="sm" onClick={goToNextWeek}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Weekly Grid - Monday to Friday */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((dayName, dayIndex) => {
          const daySlots = scheduleData.filter(slot => slot.dayName === dayName);
          const dayDate = addDays(weekStart, dayIndex);
          const isCurrentDay = isToday(dayDate);
          
          return (
            <Card key={dayName} className={`${isCurrentDay ? 'border-primary shadow-md' : ''}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className={isCurrentDay ? 'text-primary' : ''}>{dayName}</span>
                  <Badge variant={isCurrentDay ? 'default' : 'outline'}>
                    {format(dayDate, 'MMM d')}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Morning Shift */}
                {daySlots
                  .filter(slot => slot.shift === 'morning')
                  .map((slot, index) => (
                    <div key={`morning-${index}`} className="border rounded-lg p-3 bg-yellow-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm font-medium text-yellow-800">Morning</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {slot.totalHours}h / {slot.capacity}h
                        </Badge>
                      </div>
                      <div className="text-xs text-yellow-700 mb-2">
                        {getShiftTimeLabel('morning')}
                      </div>
                      
                      {/* Orders in this slot */}
                      {slot.orders.length === 0 ? (
                        <div className="text-xs text-gray-500 italic text-center py-2">
                          No jobs scheduled
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {slot.orders.map(order => (
                            <div key={order.id} className="bg-white rounded p-2 border">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{order.wo_no}</span>
                                <Badge className={getPriorityColor(order.priority)}>
                                  {order.priority}
                                </Badge>
                              </div>
                              <div className="text-xs text-gray-600">{order.customer}</div>
                              <div className="text-xs text-gray-500">{order.estimated_hours}h</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                {/* Afternoon Shift */}
                {daySlots
                  .filter(slot => slot.shift === 'afternoon')
                  .map((slot, index) => (
                    <div key={`afternoon-${index}`} className="border rounded-lg p-3 bg-blue-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">Afternoon</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {slot.totalHours}h / {slot.capacity}h
                        </Badge>
                      </div>
                      <div className="text-xs text-blue-700 mb-2">
                        {getShiftTimeLabel('afternoon')}
                      </div>
                      
                      {/* Orders in this slot */}
                      {slot.orders.length === 0 ? (
                        <div className="text-xs text-gray-500 italic text-center py-2">
                          No jobs scheduled
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {slot.orders.map(order => (
                            <div key={order.id} className="bg-white rounded p-2 border">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{order.wo_no}</span>
                                <Badge className={getPriorityColor(order.priority)}>
                                  {order.priority}
                                </Badge>
                              </div>
                              <div className="text-xs text-gray-600">{order.customer}</div>
                              <div className="text-xs text-gray-500">{order.estimated_hours}h</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary Info */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">10</div>
              <div className="text-sm text-muted-foreground">Total Shifts</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">40h</div>
              <div className="text-sm text-muted-foreground">Total Capacity</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">0h</div>
              <div className="text-sm text-muted-foreground">Hours Scheduled</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">0%</div>
              <div className="text-sm text-muted-foreground">Utilization</div>
            </div>
          </div>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            💡 Jobs will appear here once they have been assigned to specific time slots
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="p-6 text-center">
            <Package className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p>Loading weekly schedule...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};