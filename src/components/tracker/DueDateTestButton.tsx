import React from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calculator } from "lucide-react";

export const DueDateTestButton: React.FC = () => {
  const [isLoading, setIsLoading] = React.useState(false);

  const testDualDateSystem = async () => {
    setIsLoading(true);
    try {
      // Get a few proof-approved jobs
      const { data: jobs, error: jobsError } = await supabase
        .from('production_jobs')
        .select('id, wo_no')
        .not('proof_approved_at', 'is', null)
        .limit(3);

      if (jobsError || !jobs || jobs.length === 0) {
        toast.error('No proof-approved jobs found to test');
        return;
      }

      toast.info(`Testing dual date system on ${jobs.length} jobs...`);

      // Call the calculate-due-dates function with dual date mode
      const { data, error } = await supabase.functions.invoke('calculate-due-dates', {
        body: {
          jobIds: jobs.map(j => j.id),
          tableName: 'production_jobs',
          priority: 'high',
          includeTimingCalculation: true,
          dualDateMode: true,
          forceOriginalDateUpdate: true
        }
      });

      if (error) {
        console.error('Due date calculation error:', error);
        toast.error(`Due date calculation failed: ${error.message}`);
      } else {
        console.log('Due date calculation success:', data);
        toast.success(`✅ Dual date system updated for ${jobs.length} jobs!`);
        
        // Refresh the page to show updated dates
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }

    } catch (error) {
      console.error('Test error:', error);
      toast.error('Failed to test dual date system');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={testDualDateSystem}
      disabled={isLoading}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <Calculator className="h-4 w-4" />
      {isLoading ? 'Testing...' : 'Test Dual Dates'}
    </Button>
  );
};