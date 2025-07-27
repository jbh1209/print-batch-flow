import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, Clock, AlertTriangle, CheckCircle } from "lucide-react";

interface RecalculationResult {
  updated_job_id: string;
  old_due_date: string;
  new_due_date: string;
  estimated_hours: number;
}

export const BulkJobRecalculation = () => {
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [results, setResults] = useState<RecalculationResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleBulkRecalculation = async () => {
    setIsRecalculating(true);
    setResults([]);
    
    try {
      const { data, error } = await supabase.rpc('bulk_recalculate_job_due_dates');
      
      if (error) {
        console.error('Bulk recalculation error:', error);
        toast.error("Failed to recalculate job due dates");
        return;
      }
      
      if (data && data.length > 0) {
        setResults(data);
        setShowResults(true);
        toast.success(`Successfully recalculated due dates for ${data.length} jobs with workload awareness and 1-day buffer`);
      } else {
        toast.info("No jobs needed due date recalculation");
      }
    } catch (error) {
      console.error('Error during bulk recalculation:', error);
      toast.error("An error occurred during bulk recalculation");
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Bulk Job Due Date Recalculation
          </CardTitle>
          <CardDescription>
            Recalculate due dates for all existing production jobs based on current workload and corrected PROOF stage timing (15 minutes).
            Includes 1-day production buffer for reliable client commitments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800">Important Notes</h4>
                  <ul className="mt-2 text-sm text-amber-700 space-y-1">
                    <li>• This will update due dates for all incomplete production jobs</li>
                    <li>• New dates are calculated based on current workload queue</li>
                    <li>• PROOF stage timing has been corrected to 15 minutes (from 8 hours)</li>
                    <li>• Each job gets a 1-day buffer for production reliability</li>
                    <li>• Jobs are processed in creation order (FIFO)</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <Button 
              onClick={handleBulkRecalculation}
              disabled={isRecalculating}
              className="w-full"
            >
              <Clock className="h-4 w-4 mr-2" />
              {isRecalculating ? "Recalculating..." : "Recalculate All Job Due Dates"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {showResults && results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Recalculation Results
            </CardTitle>
            <CardDescription>
              Summary of {results.length} jobs with updated due dates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="font-medium text-blue-800">Total Updated</div>
                  <div className="text-2xl font-bold text-blue-600">{results.length}</div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="font-medium text-green-800">Avg Hours/Job</div>
                  <div className="text-2xl font-bold text-green-600">
                    {(results.reduce((sum, r) => sum + r.estimated_hours, 0) / results.length).toFixed(1)}
                  </div>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg">
                  <div className="font-medium text-orange-800">Queue Extended</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {Math.ceil(results.reduce((sum, r) => sum + r.estimated_hours, 0) / 8)} days
                  </div>
                </div>
              </div>
              
              <div className="text-sm text-gray-600">
                All jobs now have realistic due dates based on current production capacity with built-in buffer time.
                Future Excel imports will automatically use this workload-aware scheduling.
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};