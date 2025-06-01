import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Printer, Download } from "lucide-react";
import { barcode } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { generateBarcodeData, generateBarcodeImage } from "@/utils/barcodeGenerator";
import { downloadBarcodeLabelsPDF, BarcodeLabelData } from "@/utils/barcodeLabelGenerator";
import { toast } from "sonner";

interface ProductionJob {
  id: string;
  wo_no: string;
  customer?: string;
  due_date?: string;
  barcode_data?: string;
  barcode_url?: string;
}

const TrackerLabels = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, [user?.id]);

  const fetchJobs = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('production_jobs')
        .select('id, wo_no, customer, due_date, barcode_data, barcode_url')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const generateMissingBarcodes = async () => {
    const jobsNeedingBarcode = jobs.filter(job => !job.barcode_url && selectedJobs.has(job.id));
    
    if (jobsNeedingBarcode.length === 0) return;

    setGenerating(true);
    try {
      for (const job of jobsNeedingBarcode) {
        const barcodeData = generateBarcodeData({
          wo_no: job.wo_no,
          job_id: job.id,
          customer: job.customer,
          due_date: job.due_date
        });

        const barcodeUrl = await generateBarcodeImage(barcodeData);

        await supabase
          .from('production_jobs')
          .update({
            barcode_data: barcodeData,
            barcode_url: barcodeUrl
          })
          .eq('id', job.id);

        // Update local state
        setJobs(prev => prev.map(j => 
          j.id === job.id 
            ? { ...j, barcode_data: barcodeData, barcode_url: barcodeUrl }
            : j
        ));
      }

      toast.success(`Generated barcodes for ${jobsNeedingBarcode.length} jobs`);
    } catch (error) {
      console.error('Error generating barcodes:', error);
      toast.error('Failed to generate barcodes');
    } finally {
      setGenerating(false);
    }
  };

  const downloadPDFLabels = async () => {
    const selectedJobsData = jobs.filter(job => selectedJobs.has(job.id));
    
    if (selectedJobsData.length === 0) {
      toast.error('No jobs selected');
      return;
    }

    setDownloadingPDF(true);
    try {
      console.log("Converting jobs to barcode label data format");
      
      const labelData: BarcodeLabelData[] = selectedJobsData.map(job => ({
        id: job.id,
        wo_no: job.wo_no,
        customer: job.customer,
        due_date: job.due_date,
        status: 'pending', // Default status
        reference: job.customer // Use customer as reference
      }));

      console.log("Calling downloadBarcodeLabelsPDF with", labelData.length, "jobs");
      
      const success = await downloadBarcodeLabelsPDF(labelData, `barcode-labels-${selectedJobsData.length}-jobs.pdf`);
      
      if (success) {
        toast.success(`Successfully downloaded PDF with ${selectedJobsData.length} barcode labels`);
      } else {
        toast.error('Failed to generate PDF labels');
      }
    } catch (error) {
      console.error('Error downloading PDF labels:', error);
      toast.error('Failed to download PDF labels');
    } finally {
      setDownloadingPDF(false);
    }
  };

  const toggleJobSelection = (jobId: string) => {
    const newSelection = new Set(selectedJobs);
    if (newSelection.has(jobId)) {
      newSelection.delete(jobId);
    } else {
      newSelection.add(jobId);
    }
    setSelectedJobs(newSelection);
  };

  const selectAll = () => {
    setSelectedJobs(new Set(jobs.map(job => job.id)));
  };

  const clearSelection = () => {
    setSelectedJobs(new Set());
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading jobs...</div>;
  }

  const selectedJobsData = jobs.filter(job => selectedJobs.has(job.id));
  const selectedWithBarcode = selectedJobsData.filter(job => job.barcode_url);
  const selectedWithoutBarcode = selectedJobsData.filter(job => !job.barcode_url);

  return (
    <div className="container mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/tracker" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
        <h1 className="text-3xl font-bold">Barcode Labels</h1>
        <p className="text-gray-600">Generate and print barcode labels for work orders</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Jobs List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Jobs ({jobs.length})</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearSelection}>
                    Clear
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {jobs.map(job => (
                  <div 
                    key={job.id}
                    className="flex items-center space-x-3 p-3 border rounded hover:bg-gray-50"
                  >
                    <Checkbox
                      checked={selectedJobs.has(job.id)}
                      onCheckedChange={() => toggleJobSelection(job.id)}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{job.wo_no}</div>
                      {job.customer && (
                        <div className="text-sm text-gray-500">{job.customer}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {job.barcode_url ? (
                        <barcode className="h-4 w-4 text-green-500" />
                      ) : (
                        <barcode className="h-4 w-4 text-gray-300" />
                      )}
                      <span className="text-xs text-gray-500">
                        {job.barcode_url ? 'Barcode Ready' : 'No Barcode'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-1">
                <div>Selected: {selectedJobs.size} jobs</div>
                <div>With Barcode: {selectedWithBarcode.length} jobs</div>
                <div>Without Barcode: {selectedWithoutBarcode.length} jobs</div>
              </div>

              {selectedWithoutBarcode.length > 0 && (
                <Button 
                  onClick={generateMissingBarcodes}
                  disabled={generating}
                  className="w-full flex items-center gap-2"
                >
                  <barcode className="h-4 w-4" />
                  {generating ? 'Generating...' : `Generate ${selectedWithoutBarcode.length} Barcodes`}
                </Button>
              )}

              <Button 
                onClick={downloadPDFLabels}
                disabled={selectedJobsData.length === 0 || downloadingPDF}
                className="w-full flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {downloadingPDF ? 'Generating PDF...' : `Download PDF (${selectedJobsData.length} Labels)`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TrackerLabels;
