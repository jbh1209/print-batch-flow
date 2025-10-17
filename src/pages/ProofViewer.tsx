import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import PdfViewer from "@/components/pdf/PdfViewer";
import { Loader2, CheckCircle, AlertCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { ProofViewerHeader } from "@/components/proof/ProofViewerHeader";
import impressLogo from "@/assets/impress-logo-colour.png";

const ProofViewer = () => {
  const { token } = useParams<{ token: string }>();
  
  const [proofData, setProofData] = useState<any>(null);
  const [jobData, setJobData] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [estimatedCompletion, setEstimatedCompletion] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid proof link");
      setLoading(false);
      return;
    }

    const loadProofData = async () => {
      try {
        const { data: proofLink, error: proofError } = await supabase
          .from("proof_links")
          .select("*")
          .eq("token", token)
          .single();

        if (proofError || !proofLink) {
          setError("Proof link not found or expired");
          setLoading(false);
          return;
        }

        if (proofLink.expires_at && new Date(proofLink.expires_at) < new Date()) {
          setError("This proof link has expired");
          setLoading(false);
          return;
        }

        if (proofLink.client_response) {
          setSubmitted(true);
        }

        setProofData(proofLink);

        const { data: stage } = await supabase
          .from("job_stage_instances")
          .select(`
            *,
            production_jobs(wo_no, contact, due_date, reference, qty)
          `)
          .eq("id", proofLink.stage_instance_id)
          .single();

        if (stage) {
          setJobData(stage);
          setPdfUrl(stage.proof_pdf_url);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error loading proof:", err);
        setError("Failed to load proof");
        setLoading(false);
      }
    };

    loadProofData();
  }, [token]);

  const handleSubmitResponse = async (response: "approved" | "changes_needed") => {
    if (response === "approved" && !approvalConfirmed) {
      toast.error("Please confirm you understand the approval terms");
      return;
    }

    if (response === "changes_needed" && !notes.trim()) {
      toast.error("Please describe the changes needed");
      return;
    }

    setIsSubmitting(true);
    if (response === "approved") {
      setIsScheduling(true);
    }

    try {
      const res = await supabase.functions.invoke("handle-proof-approval/submit-approval", {
        body: { token, response, notes: notes.trim() || null }
      });

      if (res.error) throw res.error;

      // Handle idempotent submissions gracefully
      if (res.data?.alreadyProcessed) {
        toast.success(res.data.message || "Your response was already recorded");
        setSubmitted(true);
        return;
      }

      if (response === "approved" && res.data?.estimatedCompletion) {
        setEstimatedCompletion(res.data.estimatedCompletion);
        setShowSuccess(true);
      } else {
        toast.success(res.data?.message || "Your feedback has been submitted successfully");
        setSubmitted(true);
      }
    } catch (err: any) {
      console.error("Error submitting response:", err);
      
      // Display server-provided error messages when available
      const errorMessage = err?.message || err?.error || "Failed to submit response. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
      setIsScheduling(false);
    }
  };

  if (loading) {
    return (
      <>
        <ProofViewerHeader 
          woNumber={jobData?.production_jobs?.wo_no} 
          contact={jobData?.production_jobs?.contact}
          reference={jobData?.production_jobs?.reference}
          qty={jobData?.production_jobs?.qty}
        />
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <ProofViewerHeader 
          woNumber={jobData?.production_jobs?.wo_no} 
          contact={jobData?.production_jobs?.contact}
          reference={jobData?.production_jobs?.reference}
          qty={jobData?.production_jobs?.qty}
        />
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="text-center space-y-4 max-w-md">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold text-gray-900">Unable to Load Proof</h1>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </>
    );
  }

  if (showSuccess && estimatedCompletion) {
    const completionDate = new Date(estimatedCompletion);
    return (
      <>
        <ProofViewerHeader 
          woNumber={jobData?.production_jobs?.wo_no} 
          contact={jobData?.production_jobs?.contact}
          reference={jobData?.production_jobs?.reference}
          qty={jobData?.production_jobs?.qty}
        />
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center space-y-6 max-w-2xl bg-white p-8 rounded-lg shadow-lg">
          <img 
            src={impressLogo} 
            alt="Impress Print" 
            className="h-12 w-auto mx-auto mb-4"
          />
          <CheckCircle className="h-20 w-20 text-green-500 mx-auto" />
          <h1 className="text-3xl font-bold text-gray-900">Order Approved & Scheduled!</h1>
          <p className="text-lg text-gray-600">Your order has been added to our production schedule</p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-2">
            <p className="text-sm font-medium text-blue-900">📅 Estimated Completion</p>
            <p className="text-2xl font-bold text-blue-900">
              {completionDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left">
            <p className="text-sm text-amber-900">
              ⚠️ <strong>Disclaimer:</strong> This estimate is based on current production capacity 
              and assumes no equipment downtime, material delays, or unforeseen circumstances. 
              While we strive for accuracy, actual completion may vary by ±1 business day.
            </p>
          </div>

          <p className="text-sm text-gray-500">
            📧 You'll receive email updates as production progresses.
          </p>
        </div>
      </div>
      </>
    );
  }

  if (submitted) {
    return (
      <>
        <ProofViewerHeader 
          woNumber={jobData?.production_jobs?.wo_no} 
          contact={jobData?.production_jobs?.contact}
          reference={jobData?.production_jobs?.reference}
          qty={jobData?.production_jobs?.qty}
        />
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center space-y-4 max-w-md bg-white p-8 rounded-lg shadow-lg">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900">Response Submitted</h1>
          <p className="text-gray-600">Thank you for your feedback. We'll be in touch soon.</p>
        </div>
      </div>
      </>
    );
  }

  if (isScheduling) {
    return (
      <>
        <ProofViewerHeader 
          woNumber={jobData?.production_jobs?.wo_no} 
          contact={jobData?.production_jobs?.contact}
          reference={jobData?.production_jobs?.reference}
          qty={jobData?.production_jobs?.qty}
        />
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center space-y-6 max-w-md bg-white p-8 rounded-lg shadow-lg">
          <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-gray-900">⏳ Scheduling Your Order...</h2>
          <div className="space-y-3 text-left">
            <p className="flex items-center gap-2 text-gray-700">
              <CheckCircle className="h-5 w-5 text-green-500" /> Mark proof as approved
            </p>
            <p className="flex items-center gap-2 text-gray-700">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" /> Calculate production timeline
            </p>
            <p className="flex items-center gap-2 text-gray-500">
              <div className="h-5 w-5" /> Reserve equipment slots
            </p>
            <p className="flex items-center gap-2 text-gray-500">
              <div className="h-5 w-5" /> Update delivery estimate
            </p>
          </div>
          <p className="text-sm text-gray-500">This usually takes 5-10 seconds</p>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <ProofViewerHeader 
        woNumber={jobData?.production_jobs?.wo_no} 
        contact={jobData?.production_jobs?.contact}
        reference={jobData?.production_jobs?.reference}
        qty={jobData?.production_jobs?.qty}
      />
      <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 space-y-6">
        {/* Hero Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Review Your Proof</h1>
              <p className="text-gray-600">Job: {jobData?.production_jobs?.wo_no}</p>
              {jobData?.production_jobs?.contact && (
                <p className="text-gray-600">For: {jobData.production_jobs.contact}</p>
              )}
            </div>
            <div className="px-4 py-2 bg-amber-100 text-amber-900 rounded-full font-medium">
              Awaiting Your Approval
            </div>
          </div>
          {proofData?.expires_at && (
            <p className="text-sm text-gray-500">
              ⏰ This proof link expires in {Math.ceil((new Date(proofData.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
            </p>
          )}
        </div>

        {/* PDF Viewer */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Proof Document</h2>
            {pdfUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(pdfUrl, '_blank')}
              >
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            )}
          </div>
          <PdfViewer url={pdfUrl} className="w-full h-[600px]" />
        </div>

        {/* Decision Interface */}
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Your Decision</h2>
          
          <div className="grid md:grid-cols-2 gap-4">
            <Button
              size="lg"
              className="h-auto py-6 flex flex-col gap-2 bg-green-600 hover:bg-green-700"
              onClick={() => {
                if (!approvalConfirmed) {
                  toast.error("Please confirm the approval terms below first");
                  return;
                }
                handleSubmitResponse("approved");
              }}
              disabled={isSubmitting}
            >
              <CheckCircle className="h-8 w-8" />
              <span className="text-lg font-semibold">Approve & Schedule for Production</span>
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="h-auto py-6 flex flex-col gap-2 border-amber-300 hover:bg-amber-50"
              onClick={() => handleSubmitResponse("changes_needed")}
              disabled={isSubmitting || !notes.trim()}
            >
              <AlertCircle className="h-8 w-8 text-amber-600" />
              <span className="text-lg font-semibold text-amber-900">Request Changes</span>
            </Button>
          </div>

          {/* Approval Confirmation */}
          <div className="border border-red-200 bg-red-50 rounded-lg p-4 space-y-3">
            <p className="font-semibold text-red-900">⚠️ IMPORTANT: Final Approval Confirmation</p>
            <p className="text-sm text-red-800">By approving this proof, you confirm that:</p>
            <ul className="text-sm text-red-800 space-y-1 ml-4">
              <li>• All details are correct and final</li>
              <li>• No further changes can be made</li>
              <li>• Your order will be scheduled for immediate production</li>
              <li>• The estimated completion date is binding</li>
            </ul>
            <div className="flex items-start gap-2 pt-2">
              <Checkbox
                id="approval-confirm"
                checked={approvalConfirmed}
                onCheckedChange={(checked) => setApprovalConfirmed(checked as boolean)}
              />
              <label
                htmlFor="approval-confirm"
                className="text-sm font-medium text-red-900 cursor-pointer"
              >
                I understand and approve this proof for production
              </label>
            </div>
          </div>

          {/* Changes Text Area */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Request Changes (describe what needs to be changed)
            </label>
            <Textarea
              placeholder="Please describe the changes needed in detail..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              maxLength={1000}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">
              {notes.length}/1000 characters
            </p>
          </div>
        </div>

        {/* Support Info */}
        <div className="text-center text-sm text-gray-500">
          <p>Having trouble viewing? Contact us for support</p>
        </div>
      </div>
    </div>
    </>
  );
};

export default ProofViewer;
