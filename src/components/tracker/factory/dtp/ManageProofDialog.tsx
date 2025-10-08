import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, RefreshCw, Edit, Loader2 } from "lucide-react";

interface ManageProofDialogProps {
  isOpen: boolean;
  onClose: () => void;
  stageInstanceId: string;
  jobId: string;
  currentEmail?: string;
  currentName?: string;
  onRefresh?: () => void;
}

export const ManageProofDialog: React.FC<ManageProofDialogProps> = ({
  isOpen,
  onClose,
  stageInstanceId,
  jobId,
  currentEmail = '',
  currentName = '',
  onRefresh
}) => {
  const [editedEmail, setEditedEmail] = useState(currentEmail);
  const [editedName, setEditedName] = useState(currentName);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Reset form when dialog opens or props change
  useEffect(() => {
    if (isOpen) {
      setEditedEmail(currentEmail);
      setEditedName(currentName);
    }
  }, [isOpen, currentEmail, currentName]);

  const handleUpdateClientDetails = async () => {
    if (!editedEmail || !editedEmail.includes('@')) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsUpdating(true);
    try {
      console.log('📝 Updating client details for stage:', stageInstanceId);

      // Update stage instance
      const { error: stageError } = await supabase
        .from('job_stage_instances')
        .update({
          client_email: editedEmail,
          client_name: editedName || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', stageInstanceId);

      if (stageError) throw stageError;

      // Also update production job for future reference
      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({
          client_email: editedEmail,
          client_name: editedName || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (jobError) {
        console.error('Warning: Failed to update job client details:', jobError);
        // Don't fail the whole operation
      }

      toast.success("✅ Client details updated successfully");
      onRefresh?.();
    } catch (error) {
      console.error('Error updating client details:', error);
      toast.error("Failed to update client details");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResendEmail = async () => {
    setIsResending(true);
    try {
      console.log('📧 Resending proof email for stage:', stageInstanceId);

      // Get the latest proof link for this stage
      const { data: proofLink, error: linkError } = await supabase
        .from('proof_links')
        .select('id, token')
        .eq('stage_instance_id', stageInstanceId)
        .eq('is_used', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (linkError || !proofLink) {
        toast.error("No active proof link found. Please regenerate the link first.");
        return;
      }

      // Call edge function to resend email
      const { data, error } = await supabase.functions.invoke('handle-proof-approval/resend-email', {
        body: { proofLinkId: proofLink.id }
      });

      if (error) {
        throw error;
      }

      toast.success("✅ Proof email resent successfully");
    } catch (error: any) {
      console.error('Error resending email:', error);
      toast.error(error.message || "Failed to resend email");
    } finally {
      setIsResending(false);
    }
  };

  const handleRegenerateLink = async () => {
    setIsRegenerating(true);
    try {
      console.log('🔄 Regenerating proof link for stage:', stageInstanceId);

      // Call edge function to regenerate link
      const { data, error } = await supabase.functions.invoke('handle-proof-approval/regenerate-link', {
        body: { stageInstanceId }
      });

      if (error) {
        throw error;
      }

      toast.success("✅ Proof link regenerated and sent to client");
      onRefresh?.();
    } catch (error: any) {
      console.error('Error regenerating link:', error);
      toast.error(error.message || "Failed to regenerate link");
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Proof</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="edit" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="edit">Edit Details</TabsTrigger>
            <TabsTrigger value="resend">Resend</TabsTrigger>
            <TabsTrigger value="regenerate">Regenerate</TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">Client Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={editedEmail}
                onChange={(e) => setEditedEmail(e.target.value)}
                placeholder="client@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-name">Client Name</Label>
              <Input
                id="edit-name"
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="John Doe"
              />
            </div>

            <Button 
              onClick={handleUpdateClientDetails}
              disabled={isUpdating || !editedEmail}
              className="w-full"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground">
              Note: This only updates the stored details. To send to a new email, update the email and then use "Regenerate" to create and send a new link.
            </p>
          </TabsContent>

          <TabsContent value="resend" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Resend the proof email using the existing link to the current email address: <strong>{currentEmail}</strong>
            </p>

            <Button 
              onClick={handleResendEmail}
              disabled={isResending}
              className="w-full"
            >
              {isResending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Resend Email
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="regenerate" className="space-y-4 mt-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Generate a new proof link and send it to: <strong>{currentEmail}</strong>
              </p>
              <p className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded">
                ⚠️ This will invalidate the old link. Use this if the old link has expired or if you've updated the client email.
              </p>
            </div>

            <Button 
              onClick={handleRegenerateLink}
              disabled={isRegenerating}
              className="w-full"
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate & Send
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
