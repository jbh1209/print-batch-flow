
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Printer, Download, QrCode } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { QRCodeLabel } from "@/components/tracker/QRCodeLabel";
import { generateQRCodeData, generateQRCodeImage } from "@/utils/qrCodeGenerator";
import { toast } from "sonner";

interface ProductionJob {
  id: string;
  wo_no: string;
  customer?: string;
  due_date?: string;
  qr_code_data?: string;
  qr_code_url?: string;
}

const TrackerLabels = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, [user?.id]);

  const fetchJobs = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('production_jobs')
        .select('id, wo_no, customer, due_date, qr_code_data, qr_code_url')
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

  const generateMissingQRCodes = async () => {
    const jobsNeedingQR = jobs.filter(job => !job.qr_code_url && selectedJobs.has(job.id));
    
    if (jobsNeedingQR.length === 0) return;

    setGenerating(true);
    try {
      for (const job of jobsNeedingQR) {
        const qrData = generateQRCodeData({
          wo_no: job.wo_no,
          job_id: job.id,
          customer: job.customer,
          due_date: job.due_date
        });

        const qrUrl = await generateQRCodeImage(qrData);

        await supabase
          .from('production_jobs')
          .update({
            qr_code_data: qrData,
            qr_code_url: qrUrl
          })
          .eq('id', job.id);

        // Update local state
        setJobs(prev => prev.map(j => 
          j.id === job.id 
            ? { ...j, qr_code_data: qrData, qr_code_url: qrUrl }
            : j
        ));
      }

      toast.success(`Generated QR codes for ${jobsNeedingQR.length} jobs`);
    } catch (error) {
      console.error('Error generating QR codes:', error);
      toast.error('Failed to generate QR codes');
    } finally {
      setGenerating(false);
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

  const printSelectedLabels = () => {
    const selectedJobsData = jobs.filter(job => selectedJobs.has(job.id) && job.qr_code_url);
    
    if (selectedJobsData.length === 0) {
      toast.error('No jobs with QR codes selected');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const labelsHtml = selectedJobsData.map(job => `
      <div style="page-break-after: always; display: flex; justify-content: center; align-items: center; height: 50mm;">
        <div style="width: 100mm; height: 50mm; border: 1px solid black; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5mm; font-family: Arial, sans-serif;">
          <div style="font-weight: bold; font-size: 12pt; margin-bottom: 2mm;">WO: ${job.wo_no}</div>
          <img src="${job.qr_code_url}" style="width: 30mm; height: 30mm; margin: 2mm 0;" />
          ${job.customer ? `<div style="font-size: 8pt; text-align: center; margin-top: 1mm;">${job.customer}</div>` : ''}
          ${job.due_date ? `<div style="font-size: 8pt;">Due: ${new Date(job.due_date).toLocaleDateString()}</div>` : ''}
        </div>
      </div>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code Labels</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; }
              .no-print { display: none; }
            }
            body { margin: 0; padding: 10px; }
            @page { size: A4; margin: 10mm; }
          </style>
        </head>
        <body>
          ${labelsHtml}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading jobs...</div>;
  }

  const selectedJobsData = jobs.filter(job => selectedJobs.has(job.id));
  const selectedWithQR = selectedJobsData.filter(job => job.qr_code_url);
  const selectedWithoutQR = selectedJobsData.filter(job => !job.qr_code_url);

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
        <h1 className="text-3xl font-bold">QR Code Labels</h1>
        <p className="text-gray-600">Generate and print QR code labels for work orders</p>
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
                      {job.qr_code_url ? (
                        <QrCode className="h-4 w-4 text-green-500" />
                      ) : (
                        <QrCode className="h-4 w-4 text-gray-300" />
                      )}
                      <span className="text-xs text-gray-500">
                        {job.qr_code_url ? 'QR Ready' : 'No QR'}
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
                <div>With QR: {selectedWithQR.length} jobs</div>
                <div>Without QR: {selectedWithoutQR.length} jobs</div>
              </div>

              {selectedWithoutQR.length > 0 && (
                <Button 
                  onClick={generateMissingQRCodes}
                  disabled={generating}
                  className="w-full flex items-center gap-2"
                >
                  <QrCode className="h-4 w-4" />
                  {generating ? 'Generating...' : `Generate ${selectedWithoutQR.length} QR Codes`}
                </Button>
              )}

              <Button 
                onClick={printSelectedLabels}
                disabled={selectedWithQR.length === 0}
                className="w-full flex items-center gap-2"
              >
                <Printer className="h-4 w-4" />
                Print {selectedWithQR.length} Labels
              </Button>
            </CardContent>
          </Card>

          {/* Preview */}
          {selectedWithQR.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {selectedWithQR.slice(0, 3).map(job => (
                    <div key={job.id} className="border rounded p-2">
                      <div 
                        style={{ transform: 'scale(0.3)', transformOrigin: 'top left' }}
                        className="overflow-hidden"
                      >
                        <QRCodeLabel
                          woNo={job.wo_no}
                          qrCodeDataURL={job.qr_code_url!}
                          customer={job.customer}
                          dueDate={job.due_date}
                        />
                      </div>
                    </div>
                  ))}
                  {selectedWithQR.length > 3 && (
                    <div className="text-sm text-gray-500 text-center">
                      +{selectedWithQR.length - 3} more labels
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrackerLabels;
