
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ProductPageJob, ProductPageBatch } from "@/components/product-pages/types/ProductPageTypes";
import { ProductPageBatchOverview } from "@/components/product-pages/ProductPageBatchOverview";
import { format } from "date-fns";

export default function ProductPageBatchDetailsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const batchId = searchParams.get('batchId');
  
  const [batch, setBatch] = useState<ProductPageBatch | null>(null);
  const [jobs, setJobs] = useState<ProductPageJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!batchId) {
      navigate("/admin/product-pages/batches");
      return;
    }

    const fetchBatchDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch batch details
        const { data: batchData, error: batchError } = await supabase
          .from('batches')
          .select('*')
          .eq('id', batchId)
          .single();

        if (batchError) throw batchError;

        // Fetch jobs in this batch
        const { data: jobsData, error: jobsError } = await supabase
          .from('product_pages')
          .select(`
            *,
            product_page_templates!inner(*)
          `)
          .eq('batch_id', batchId);

        if (jobsError) throw jobsError;

        setBatch(batchData);
        
        // Transform the jobsData to have properly typed custom_fields
        const typedJobs = (jobsData || []).map(job => ({
          ...job,
          custom_fields: job.custom_fields as Record<string, any>
        })) as ProductPageJob[];
        
        setJobs(typedJobs);
      } catch (err) {
        console.error("Error fetching batch details:", err);
        setError("Failed to load batch details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBatchDetails();
  }, [batchId, navigate]);

  const handleDownloadOverview = async () => {
    if (!batch?.overview_pdf_url) {
      toast.error("No overview PDF available");
      return;
    }

    try {
      // Open the PDF in a new tab
      window.open(batch.overview_pdf_url, "_blank");
    } catch (err) {
      toast.error("Failed to download overview PDF");
      console.error("Error downloading PDF:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="container mx-auto py-8">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          <h2 className="text-lg font-medium">Error</h2>
          <p>{error || "Batch not found"}</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => navigate("/admin/product-pages/batches")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Batches
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button 
            variant="outline" 
            size="sm" 
            className="mr-4"
            onClick={() => navigate("/admin/product-pages/batches")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <h1 className="text-2xl font-bold">{batch.name}</h1>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            disabled={!batch.overview_pdf_url}
            onClick={handleDownloadOverview}
          >
            <Download className="mr-2 h-4 w-4" /> Download Overview
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{batch.status}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Due Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {format(new Date(batch.due_date), "MMM d, yyyy")}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Job Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobs.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Batch Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-sm font-medium text-muted-foreground">Paper Type</div>
              <div>{batch.paper_type || "Not specified"}</div>
              
              <div className="text-sm font-medium text-muted-foreground">Paper Weight</div>
              <div>{batch.paper_weight || "Not specified"}</div>
              
              <div className="text-sm font-medium text-muted-foreground">Printer Type</div>
              <div>{batch.printer_type || "Not specified"}</div>
              
              <div className="text-sm font-medium text-muted-foreground">Sheet Size</div>
              <div>{batch.sheet_size || "Not specified"}</div>
              
              <div className="text-sm font-medium text-muted-foreground">SLA Target Days</div>
              <div>{batch.sla_target_days || "Not specified"}</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Batch Jobs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Name</th>
                    <th className="text-left p-2 font-medium">Job Number</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b hover:bg-muted/50">
                      <td className="p-2">{job.name}</td>
                      <td className="p-2">{job.job_number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batch Overview Section */}
      <ProductPageBatchOverview jobs={jobs} batchName={batch.name} />
    </div>
  );
}
