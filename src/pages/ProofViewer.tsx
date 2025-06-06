
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
          setError("This proof link is invalid or has expired");
          setLoading(false);
          return;
        }

        setProofData(proofLink);

        // Get job data from the appropriate table
        let job = null;
        const tableName = proofLink.job_table_name;

        if (tableName === 'production_jobs') {
          const { data, error } = await supabase
            .from('production_jobs')
            .select('*')
            .eq('id', proofLink.job_id)
            .single();
          job = data;
        }

        if (!job) {
          setError("Unable to load job details");
          setLoading(false);
          return;
        }

        setJobData(job);

        // Check for proof PDF URL from stage instance first, then fallback to job PDF
        const proofPdfUrl = proofLink.job_stage_instances?.proof_pdf_url;
        
        if (proofPdfUrl) {
          setPdfUrl(proofPdfUrl);
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
      const { error } = await supabase.functions.invoke('handle-proof-approval/submit-approval', {
        body: {
          token,
          response,
          notes: notes.trim() || null
        }
      });

      if (error) {
        throw error;
      }

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
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <Card className="max-w-md mx-auto text-center">
          <CardHeader className="pb-4">
            <div className="mb-6">
              <img 
                src="/lovable-uploads/013852ed-9663-4b6d-98a6-1a788ab41f21.png" 
                alt="IMPRESS" 
                className="h-12 mx-auto"
              />
            </div>
            <CardTitle className="flex items-center justify-center text-green-600 text-lg">
              <CheckCircle className="h-5 w-5 mr-2" />
              Thank You!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Your feedback has been submitted successfully. Our team will review your response and get back to you soon.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expiresAt = new Date(proofData.expires_at);
  const isExpiring = expiresAt.getTime() - Date.now() < 24 * 60 * 60 * 1000;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <img 
            src="/lovable-uploads/013852ed-9663-4b6d-98a6-1a788ab41f21.png" 
            alt="IMPRESS" 
            className="h-12 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-900">Proof Review</h1>
          <p className="text-gray-600 mt-2">Please review your proof and provide feedback below</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Job Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <div className="flex items-center">
                <FileText className="h-5 w-5 mr-2 text-blue-600" />
                Job #{jobData?.job_number || jobData?.wo_no || 'N/A'}
              </div>
              <div className="flex items-center text-sm text-gray-500">
                <Clock className="h-4 w-4 mr-1" />
                Expires: {expiresAt.toLocaleDateString()}
                {isExpiring && (
                  <span className="ml-2 text-amber-600 font-medium">(Soon!)</span>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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
              <CardTitle className="text-lg">Your Proof</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                <iframe
                  src={pdfUrl}
                  className="w-full h-96"
                  title="Proof Document"
                />
              </div>
              <p className="text-sm text-gray-600 mt-3 text-center">
                Having trouble viewing? <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Open in new tab</a>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Feedback Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comments (optional)
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Please add any comments or specific change requests..."
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={() => handleSubmitResponse('approved')}
                disabled={isSubmitting}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-base font-medium"
                size="lg"
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                {isSubmitting ? 'Submitting...' : 'Approve Proof'}
              </Button>
              
              <Button
                onClick={() => handleSubmitResponse('changes_needed')}
                disabled={isSubmitting}
                variant="outline"
                className="w-full border-red-300 text-red-700 hover:bg-red-50 py-3 text-base font-medium"
                size="lg"
              >
                <XCircle className="h-5 w-5 mr-2" />
                {isSubmitting ? 'Submitting...' : 'Request Changes'}
              </Button>
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                <strong>Approve:</strong> The job will move forward to printing.<br />
                <strong>Request Changes:</strong> The job will be sent back to our design team for revisions.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProofViewer;
