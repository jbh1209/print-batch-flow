import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fixProofApprovals } from "@/utils/fixProofApprovals";
import { useDivision } from "@/contexts/DivisionContext";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

export const ProofApprovalFixer = () => {
  const { selectedDivision } = useDivision();
  const [isFixing, setIsFixing] = useState(false);
  const [result, setResult] = useState<{ fixed: number; scheduled: boolean } | null>(null);

  const handleFix = async () => {
    if (!selectedDivision) {
      console.error('No division selected');
      return;
    }
    
    setIsFixing(true);
    setResult(null);
    
    try {
      const fixResult = await fixProofApprovals(selectedDivision);
      setResult(fixResult);
    } catch (error) {
      console.error('Fix failed:', error);
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          Fix Proof Approvals
        </CardTitle>
        <CardDescription>
          Fix jobs with completed proof stages but missing approval timestamps
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleFix}
          disabled={isFixing || !selectedDivision}
          className="w-full"
        >
          {isFixing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fixing...
            </>
          ) : (
            'Fix Missing Proof Approvals'
          )}
        </Button>
        
        {!selectedDivision && (
          <p className="text-sm text-amber-600">Please select a division first</p>
        )}
        
        {result && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Fixed {result.fixed} jobs</span>
            </div>
            {result.scheduled && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Scheduler executed successfully</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};