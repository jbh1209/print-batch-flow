import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, FileText, Clock, AlertTriangle } from "lucide-react";

const ProofViewer = () => {
  const { token } = useParams<{ token: string }>();
  const [proofData, setProofData] = useState<any>(null);
  const [jobData, setJobData] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const loadProofData = async () => {
      if (!token) {
        setError("Invalid proof link");
        setLoading(false);
        return;
      }

      try {
        console.log('Loading proof data for token:', token);

        // Get proof link data
        const { data: proofLink, error: proofError } = await supabase
          .from('proof_links')
          .select(`
            *,
            job_stage_instances(
              *,
              production_stage:production_stages(name, color)
            )
          `)
          .eq('token', token)
          .eq('is_used', false)
          .gte('expires_at', new Date().toISOString())
          .single();

        if (proofError || !proofLink) {
          console.error('Proof link error:', proofError);
          setError("This proof link is invalid or has expired");
          setLoading(false);
          return;
        }

        console.log('Proof link data loaded:', proofLink);
        setProofData(proofLink);

        // Get job data from the appropriate table
        let job = null;
        let jobError = null;

        const tableName = proofLink.job_table_name;
        console.log('Fetching job data from table:', tableName);

        if (tableName === 'production_jobs') {
          const { data, error } = await supabase
            .from('production_jobs')
            .select('*')
            .eq('id', proofLink.job_id)
            .single();
          job = data;
          jobError = error;
        } else if (tableName === 'business_card_jobs') {
          const { data, error } = await supabase
            .from('business_card_jobs')
            .select('*')
            .eq('id', proofLink.job_id)
            .single();
          job = data;
          jobError = error;
        } else if (tableName === 'flyer_jobs') {
          const { data, error } = await supabase
            .from('flyer_jobs')
            .select('*')
            .eq('id', proofLink.job_id)
            .single();
          job = data;
          jobError = error;
        } else if (tableName === 'postcard_jobs') {
          const { data, error } = await supabase
            .from('postcard_jobs')
            .select('*')
            .eq('id', proofLink.job_id)
            .single();
          job = data;
          jobError = error;
        } else if (tableName === 'sleeve_jobs') {
          const { data, error } = await supabase
            .from('sleeve_jobs')
            .select('*')
            .eq('id', proofLink.job_id)
            .single();
          job = data;
          jobError = error;
        } else if (tableName === 'cover_jobs') {
          const { data, error } = await supabase
            .from('cover_jobs')
            .select('*')
            .eq('id', proofLink.job_id)
            .single();
          job = data;
          jobError = error;
        } else if (tableName === 'box_jobs') {
          const { data, error } = await supabase
            .from('box_jobs')
            .select('*')
            .eq('id', proofLink.job_id)
            .single();
          job = data;
          jobError = error;
        } else if (tableName === 'poster_jobs') {
          const { data, error } = await supabase
            .from('poster_jobs')
            .select('*')
            .eq('id', proofLink.job_id)
            .single();
          job = data;
          jobError = error;
        } else if (tableName === 'sticker_jobs') {
          const { data, error } = await supabase
            .from('sticker_jobs')
            .select('*')
            .eq('id', proofLink.job_id)
            .single();
          job = data;
          jobError = error;
        }

        if (jobError || !job) {
          console.error('Job data error:', jobError);
          setError("Unable to load job details");
          setLoading(false);
          return;
        }

        console.log('Job data loaded:', job);
        setJobData(job);

        // Check for proof PDF URL from stage instance first, then fallback to job PDF
        const proofPdfUrl = proofLink.job_stage_instances?.proof_pdf_url || job.pdf_url;
        
        if (proofPdfUrl) {
          console.log('Setting PDF URL:', proofPdfUrl);
          setPdfUrl(proofPdfUrl);
        } else {
          console.warn('No PDF URL found in proof stage instance or job data');
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading proof data:', err);
        setError("Failed to load proof details");
        setLoading(false);
      }
    };

    loadProofData();
  }, [token]);

  const handleSubmitResponse = async (response: 'approved' | 'changes_needed') => {
    if (!token) return;

    setIsSubmitting(true);
    try {
      console.log('Submitting proof response:', response, 'with notes:', notes);

      const { data, error } = await supabase.functions.invoke('handle-proof-approval/submit-approval', {
        body: {
          token,
          response,
          notes: notes.trim() || null
        }
      });

      if (error) {
        console.error('Error submitting response:', error);
        throw error;
      }

      console.log('Response submitted successfully:', data);
      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting response:', err);
      setError("Failed to submit your response. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-b-transparent border-blue-600 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading proof details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center text-red-600">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Unable to Load Proof
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <div className="text-center mb-4">
              <img 
                src="/lovable-uploads/013852ed-9663-4b6d-98a6-1a788ab41f21.png" 
                alt="IMPRESS" 
                className="h-16 mx-auto mb-4"
              />
            </div>
            <CardTitle className="flex items-center justify-center text-green-600">
              <CheckCircle className="h-5 w-5 mr-2" />
              Response Submitted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-center">
              Thank you for your feedback! Your response has been submitted and our team has been notified.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expiresAt = new Date(proofData.expires_at);
  const isExpiring = expiresAt.getTime() - Date.now() < 24 * 60 * 60 * 1000; // Less than 24 hours

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header with Logo */}
        <div className="text-center mb-8">
          <img 
            src="/lovable-uploads/013852ed-9663-4b6d-98a6-1a788ab41f21.png" 
            alt="IMPRESS" 
            className="h-20 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-800">Proof Review</h1>
        </div>

        {/* Job Details Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-6 w-6 mr-2 text-blue-600" />
              {jobData?.name || jobData?.wo_no || 'Job Details'}
            </CardTitle>
            <div className="flex items-center text-sm text-gray-600">
              <Clock className="h-4 w-4 mr-1" />
              Expires: {expiresAt.toLocaleDateString()} at {expiresAt.toLocaleTimeString()}
              {isExpiring && (
                <span className="ml-2 text-amber-600 font-medium">(Expires soon!)</span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Job Number:</span>
                <span className="ml-2">{jobData?.job_number || jobData?.wo_no || 'N/A'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Customer:</span>
                <span className="ml-2">{jobData?.customer || 'N/A'}</span>
              </div>
              {jobData?.due_date && (
                <div>
                  <span className="font-medium text-gray-700">Due Date:</span>
                  <span className="ml-2">{new Date(jobData.due_date).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* PDF Viewer */}
        {pdfUrl && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Proof Document</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden bg-white">
                <iframe
                  src={pdfUrl}
                  className="w-full h-96"
                  title="Proof Document"
                />
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Having trouble viewing? <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Open in new tab</a>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Feedback Form */}
        <Card>
          <CardHeader>
            <CardTitle>Your Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comments (optional)
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any comments or specific change requests..."
                rows={4}
              />
            </div>

            <div className="flex gap-4">
              <Button
                onClick={() => handleSubmitResponse('approved')}
                disabled={isSubmitting}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Submitting...' : 'Approve'}
              </Button>
              
              <Button
                onClick={() => handleSubmitResponse('changes_needed')}
                disabled={isSubmitting}
                variant="outline"
                className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Submitting...' : 'Request Changes'}
              </Button>
            </div>

            <Alert>
              <AlertDescription>
                <strong>Approve:</strong> The job will automatically move to the next stage (usually printing).<br />
                <strong>Request Changes:</strong> The job will be sent back to the design team for revisions.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProofViewer;
