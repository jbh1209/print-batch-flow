
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Mail, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface ProofStatusIndicatorProps {
  stageInstance: {
    status: string;
    proof_emailed_at?: string;
    client_email?: string;
    client_name?: string;
    updated_at?: string;
    notes?: string;
  };
}

export const ProofStatusIndicator: React.FC<ProofStatusIndicatorProps> = ({ stageInstance }) => {
  const { status, proof_emailed_at, client_email, client_name, notes } = stageInstance;

  if (status === 'awaiting_approval' && proof_emailed_at) {
    return (
      <div className="space-y-2">
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          <Mail className="h-3 w-3 mr-1" />
          Proof Sent
        </Badge>
        <div className="text-xs text-gray-600">
          <div>Sent to: {client_email}</div>
          {client_name && <div>Client: {client_name}</div>}
          <div>Sent: {new Date(proof_emailed_at).toLocaleDateString()}</div>
        </div>
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          <Clock className="h-3 w-3 mr-1" />
          Awaiting Client Response
        </Badge>
      </div>
    );
  }

  if (status === 'client_approved') {
    return (
      <div className="space-y-2">
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Client Approved
        </Badge>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          <AlertCircle className="h-3 w-3 mr-1" />
          Ready to Complete
        </Badge>
        {notes && (
          <div className="text-xs text-gray-600">
            <div>Notes: {notes}</div>
          </div>
        )}
      </div>
    );
  }

  if (status === 'changes_requested') {
    return (
      <div className="space-y-2">
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <XCircle className="h-3 w-3 mr-1" />
          Changes Requested
        </Badge>
        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
          <AlertCircle className="h-3 w-3 mr-1" />
          Needs Rework
        </Badge>
        {notes && (
          <div className="text-xs text-gray-600">
            <div>Client feedback: {notes}</div>
          </div>
        )}
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        <CheckCircle className="h-3 w-3 mr-1" />
        Stage Completed
      </Badge>
    );
  }

  return null;
};
