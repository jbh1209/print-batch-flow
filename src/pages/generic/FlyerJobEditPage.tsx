
import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { FlyerJobForm } from "@/components/flyers/FlyerJobForm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FlyerJobEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("flyer_jobs")
          .select("*")
          .eq("id", id)
          .maybeSingle();
          
        if (error) throw error;
        
        setJob(data);
      } catch (error) {
        console.error("Error fetching flyer job:", error);
        toast.error("Failed to load flyer job details");
        setJob(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchJob();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center">
          <div className="h-8 w-8 rounded-full border-t-2 border-b-2 border-primary animate-spin mb-2"></div>
          <p className="text-gray-500">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-red-500 mb-2">Job Not Found</h2>
          <p className="text-gray-500">The requested flyer job could not be found.</p>
          <button 
            onClick={() => window.location.href = '/batchflow/batches/flyers/jobs'}
            className="mt-4 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
          >
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  return <FlyerJobForm mode="edit" initialData={job} />;
};

export default FlyerJobEditPage;
