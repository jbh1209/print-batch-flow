
import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { SleeveJobForm } from "@/components/sleeves/SleeveJobForm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SleeveJobEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("sleeve_jobs")
          .select("*")
          .eq("id", id)
          .single();
          
        if (error) throw error;
        
        setJob(data);
      } catch (error) {
        console.error("Error fetching sleeve job:", error);
        toast.error("Failed to load sleeve job details");
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
          <p className="text-gray-500">The requested sleeve job could not be found.</p>
        </div>
      </div>
    );
  }

  return <SleeveJobForm mode="edit" initialData={job} />;
};

export default SleeveJobEditPage;
