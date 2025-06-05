
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, Copy, Link, Calendar } from "lucide-react";
import { useProofLinks } from "@/hooks/useProofLinks";
import { toast } from "sonner";

interface ProofLinkButtonProps {
  stageInstanceId: string;
  stageName: string;
  disabled?: boolean;
}

const ProofLinkButton: React.FC<ProofLinkButtonProps> = ({
  stageInstanceId,
  stageName,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string>("");
  const { generateProofLink, isGenerating } = useProofLinks();

  const handleGenerateLink = async () => {
    const link = await generateProofLink(stageInstanceId);
    if (link) {
      setGeneratedLink(link);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink);
      toast.success("Link copied to clipboard");
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const openLink = () => {
    if (generatedLink) {
      window.open(generatedLink, '_blank');
    }
  };

  // Only show for proof stages
  const isProofStage = stageName.toLowerCase().includes('proof');
  if (!isProofStage) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="bg-blue-50 hover:bg-blue-100 border-blue-200"
        >
          <Link className="h-4 w-4 mr-1" />
          Generate Proof Link
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <ExternalLink className="h-5 w-5 mr-2 text-blue-600" />
            External Proof Link
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            Generate a secure link that clients can use to review and approve this proof. 
            The link will expire in 7 days.
          </div>

          {!generatedLink ? (
            <Button
              onClick={handleGenerateLink}
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin h-4 w-4 mr-2 border-2 border-b-transparent border-white rounded-full"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Link className="h-4 w-4 mr-2" />
                  Generate Link
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-3">
              <div>
                <Label htmlFor="proof-link">Proof Link</Label>
                <div className="flex mt-1">
                  <Input
                    id="proof-link"
                    value={generatedLink}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    onClick={copyToClipboard}
                    variant="outline"
                    size="sm"
                    className="ml-2 shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={openLink}
                  variant="outline"
                  className="flex-1"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                
                <Button
                  onClick={() => setIsOpen(false)}
                  className="flex-1"
                >
                  Done
                </Button>
              </div>

              <div className="flex items-center text-xs text-gray-500">
                <Calendar className="h-3 w-3 mr-1" />
                Expires in 7 days
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProofLinkButton;
