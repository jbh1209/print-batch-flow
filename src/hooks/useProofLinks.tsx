
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useProofLinks = () => {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateProofLink = async (stageInstanceId: string): Promise<string | null> => {
    setIsGenerating(true);
    try {
      console.log('🔗 Generating proof link for stage instance:', stageInstanceId);

      const { data, error } = await supabase.functions.invoke('handle-proof-approval/generate-link', {
        body: { stageInstanceId }
      });

      if (error) {
        console.error('❌ Failed to generate proof link:', error);
        const errorMsg = error.message || 'Failed to generate proof link';
        toast.error(errorMsg);
        return null;
      }

      console.log('✅ Proof link generated:', data.proofUrl);
      toast.success('Proof link generated successfully');
      return data.proofUrl;
    } catch (err) {
      console.error('❌ Error generating proof link:', err);
      toast.error('Failed to generate proof link');
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateProofLink,
    isGenerating
  };
};
