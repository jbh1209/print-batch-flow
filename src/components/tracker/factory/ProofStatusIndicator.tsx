
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Mail, Clock, CheckCircle, XCircle, PrinterIcon, Zap, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProofStatusIndicatorProps {
  stageInstance: {
    status: string;
    proof_emailed_at?: string;
    client_email?: string;
    client_name?: string;
    updated_at?: string;
  };
  variant?: "default" | "prominent" | "corner-badge";
  showTimeElapsed?: boolean;
}

export const ProofStatusIndicator: React.FC<ProofStatusIndicatorProps> = ({ 
  stageInstance, 
  variant = "default",
  showTimeElapsed = true 
}) => {
  const { status, proof_emailed_at, client_email, client_name, updated_at } = stageInstance;

  // Calculate time elapsed for urgency indicators
  const getTimeElapsed = (timestamp?: string) => {
    if (!timestamp) return null;
    const elapsed = Date.now() - new Date(timestamp).getTime();
    const days = Math.floor(elapsed / (1000 * 60 * 60 * 24));
    const hours = Math.floor((elapsed % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return "Recent";
  };

  const getUrgencyLevel = (timestamp?: string) => {
    if (!timestamp) return "normal";
    const elapsed = Date.now() - new Date(timestamp).getTime();
    const days = Math.floor(elapsed / (1000 * 60 * 60 * 24));
    
    if (days >= 3) return "critical";
    if (days >= 1) return "warning";
    return "normal";
  };

  // Status: Proof emailed, awaiting client response
  if (status === 'awaiting_approval' && proof_emailed_at) {
    const timeElapsed = getTimeElapsed(proof_emailed_at);
    const urgency = getUrgencyLevel(proof_emailed_at);
    const isUrgent = urgency === "critical" || urgency === "warning";

    if (variant === "corner-badge") {
      return (
        <div className="absolute -top-1 -right-1 z-10">
          <Badge 
            variant="outline" 
            className={cn(
              "factory-info border-2 animate-pulse text-xs font-bold shadow-lg",
              isUrgent && "factory-warning"
            )}
          >
            <Mail className="h-3 w-3" />
          </Badge>
        </div>
      );
    }

    if (variant === "prominent") {
      return (
        <div className={cn(
          "p-4 rounded-lg border-l-4",
          "factory-info border-l-blue-500",
          isUrgent && "factory-warning border-l-orange-500 factory-pulse"
        )}>
          <div className="flex items-center gap-2 mb-2">
            <Mail className="h-4 w-4" />
            <span className="font-semibold">Proof Sent - Awaiting Response</span>
            {isUrgent && <AlertTriangle className="h-4 w-4 text-orange-600" />}
          </div>
          <div className="text-sm space-y-1">
            <div>Sent to: <span className="font-medium">{client_email}</span></div>
            {client_name && <div>Client: <span className="font-medium">{client_name}</span></div>}
            {showTimeElapsed && timeElapsed && (
              <div className={cn(
                "flex items-center gap-1",
                isUrgent && "text-orange-700 font-medium"
              )}>
                <Clock className="h-3 w-3" />
                {timeElapsed}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <Badge 
          variant="outline" 
          className={cn(
            "factory-info",
            isUrgent && "factory-warning animate-pulse"
          )}
        >
          <Mail className="h-3 w-3 mr-1" />
          Proof Sent
          {isUrgent && <AlertTriangle className="h-3 w-3 ml-1" />}
        </Badge>
        <div className="text-xs text-muted-foreground">
          <div>Sent to: {client_email}</div>
          {client_name && <div>Client: {client_name}</div>}
          {showTimeElapsed && timeElapsed && (
            <div className={cn(
              "flex items-center gap-1 mt-1",
              isUrgent && "text-orange-700 font-medium"
            )}>
              <Clock className="h-3 w-3" />
              {timeElapsed}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Status: Proof approved - ready for production
  if (status === 'completed') {
    if (variant === "corner-badge") {
      return (
        <div className="absolute -top-1 -right-1 z-10">
          <Badge variant="outline" className="factory-success border-2 text-xs font-bold shadow-lg">
            <PrinterIcon className="h-3 w-3" />
          </Badge>
        </div>
      );
    }

    if (variant === "prominent") {
      return (
        <div className="p-4 rounded-lg border-l-4 factory-success border-l-green-500">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="font-semibold text-green-800">READY FOR PRODUCTION</span>
            <Zap className="h-4 w-4 text-green-600" />
          </div>
          <div className="text-sm text-green-700">
            Proof approved - Send to printer immediately
          </div>
        </div>
      );
    }

    return (
      <Badge variant="outline" className="factory-success font-semibold">
        <PrinterIcon className="h-3 w-3 mr-1" />
        READY FOR PRINT
        <Zap className="h-3 w-3 ml-1" />
      </Badge>
    );
  }

  // Status: Changes requested
  if (status === 'reworked') {
    if (variant === "corner-badge") {
      return (
        <div className="absolute -top-1 -right-1 z-10">
          <Badge variant="outline" className="factory-critical border-2 text-xs font-bold shadow-lg">
            <XCircle className="h-3 w-3" />
          </Badge>
        </div>
      );
    }

    if (variant === "prominent") {
      return (
        <div className="p-4 rounded-lg border-l-4 factory-critical border-l-red-500">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-4 w-4 text-red-600" />
            <span className="font-semibold text-red-800">Changes Requested</span>
          </div>
          <div className="text-sm text-red-700">
            Client requested revisions - Update and resend proof
          </div>
        </div>
      );
    }

    return (
      <Badge variant="outline" className="factory-critical">
        <XCircle className="h-3 w-3 mr-1" />
        Changes Requested
      </Badge>
    );
  }

  return null;
};
