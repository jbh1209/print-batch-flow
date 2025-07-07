
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Printer, Download, Barcode, Search } from "lucide-react";
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
  qr_code_data?: string;
  qr_code_url?: string;
  status?: string;
  created_at?: string;
}

const TrackerLabels = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("production");

  useEffect(() => {
    fetchJobs();
  }, [user?.id, activeTab]);

  const fetchJobs = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('production_jobs')
        .select('id, wo_no, customer, due_date, qr_code_data, qr_code_url, status, created_at')
        .eq('user_id', user.id);

      // Apply filters based on active tab
      switch (activeTab) {
        case 'production':
          // Current orders in production (not completed)
          query = query.neq('status', 'Completed')
            .order('created_at', { ascending: false });
          break;
        case 'recent':
          // Last import - orders from the last 7 days
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          query = query.gte('created_at', sevenDaysAgo.toISOString())
            .order('created_at', { ascending: false });
          break;
        case 'all':
          // All orders for search
          query = query.order('wo_no', { ascending: true });
          break;
      }

      const { data, error } = await query;

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const filteredJobs = jobs.filter(job => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      job.wo_no.toLowerCase().includes(query) ||
      job.customer?.toLowerCase().includes(query) ||
      job.status?.toLowerCase().includes(query)
    );
  });

  const generateMissingBarcodes = async () => {
    const jobsNeedingBarcode = filteredJobs.filter(job => !job.qr_code_url && selectedJobs.has(job.id));
    
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
            qr_code_data: barcodeData,
            qr_code_url: barcodeUrl
          })
          .eq('id', job.id);

        // Update local state
        setJobs(prev => prev.map(j => 
          j.id === job.id 
            ? { ...j, qr_code_data: barcodeData, qr_code_url: barcodeUrl }
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
    const selectedJobsData = filteredJobs.filter(job => selectedJobs.has(job.id));
    
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
        status: job.status || 'pending',
        reference: job.customer
      }));

      console.log("Calling downloadBarcodeLabelsPDF with", labelData.length, "jobs");
      
      const success = await downloadBarcodeLabelsPDF(labelData, `barcode-labels-${activeTab}-${selectedJobsData.length}-jobs.pdf`);
      
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
    setSelectedJobs(new Set(filteredJobs.map(job => job.id)));
  };

  const clearSelection = () => {
    setSelectedJobs(new Set());
  };

  const getTabDescription = (tab: string) => {
    switch (tab) {
      case 'production':
        return 'Orders currently in production (not completed)';
      case 'recent':
        return 'Orders from the last import (past 7 days)';
      case 'all':
        return 'All orders - use search to find specific orders';
      default:
        return '';
    }
  };

  const getJobCount = () => {
    switch (activeTab) {
      case 'production':
        return `${filteredJobs.length} active`;
      case 'recent':
        return `${filteredJobs.length} recent`;
      case 'all':
        return `${filteredJobs.length} total`;
      default:
        return filteredJobs.length.toString();
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading jobs...</div>;
  }

  const selectedJobsData = filteredJobs.filter(job => selectedJobs.has(job.id));
  const selectedWithBarcode = selectedJobsData.filter(job => job.qr_code_url);
  const selectedWithoutBarcode = selectedJobsData.filter(job => !job.qr_code_url);

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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="production">Current Production</TabsTrigger>
          <TabsTrigger value="recent">Last Import</TabsTrigger>
          <TabsTrigger value="all">Search Orders</TabsTrigger>
        </TabsList>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Jobs List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div>
                    <span>Jobs ({getJobCount()})</span>
                    <p className="text-sm font-normal text-gray-600 mt-1">
                      {getTabDescription(activeTab)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAll}>
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearSelection}>
                      Clear
                    </Button>
                  </div>
                </CardTitle>
                
                {/* Search Input */}
                {activeTab === 'all' && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by order number, customer, or status..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredJobs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-lg font-medium mb-2">No jobs found</p>
                      <p className="text-sm">
                        {searchQuery ? 'Try adjusting your search terms.' : 'No jobs match the current filter.'}
                      </p>
                    </div>
                  ) : (
                    filteredJobs.map(job => (
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
                          {job.status && (
                            <Badge variant="outline" className="text-xs">
                              {job.status}
                            </Badge>
                          )}
                          {job.qr_code_url ? (
                            <Barcode className="h-4 w-4 text-green-500" />
                          ) : (
                            <Barcode className="h-4 w-4 text-gray-300" />
                          )}
                          <span className="text-xs text-gray-500">
                            {job.qr_code_url ? 'Barcode Ready' : 'No Barcode'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
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
                    <Barcode className="h-4 w-4" />
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

            {/* Info Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Filter Info</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span><strong>Current Production:</strong> Active orders only</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span><strong>Last Import:</strong> Orders from past 7 days</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span><strong>Search Orders:</strong> All orders with search</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Tabs>
    </div>
  );
};

export default TrackerLabels;
