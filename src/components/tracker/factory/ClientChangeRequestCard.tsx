
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Clock, Mail, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ClientChangeRequestCardProps {
  clientName: string | null;
  clientEmail: string | null;
  requestedAt: string | null;
  feedback: string;
  reworkCount?: number;
}

export const ClientChangeRequestCard: React.FC<ClientChangeRequestCardProps> = ({
  clientName,
  clientEmail,
  requestedAt,
  feedback,
  reworkCount = 0
}) => {
  // Parse feedback to remove "CLIENT FEEDBACK:" prefix if present
  const parsedFeedback = feedback?.replace(/^CLIENT FEEDBACK:\s*/i, '').trim() || 'No specific feedback provided';

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <AlertTriangle className="h-5 w-5" />
          Client Requested Changes
          {reworkCount > 0 && (
            <span className="text-sm font-normal text-orange-600">
              (Revision #{reworkCount + 1})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Client Info */}
        <div className="flex flex-wrap gap-3 text-sm text-orange-700">
          {clientName && (
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              <span className="font-medium">{clientName}</span>
            </div>
          )}
          {clientEmail && (
            <div className="flex items-center gap-1">
              <Mail className="h-4 w-4" />
              <span>{clientEmail}</span>
            </div>
          )}
          {requestedAt && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>Requested {formatDistanceToNow(new Date(requestedAt), { addSuffix: true })}</span>
            </div>
          )}
        </div>

        {/* Client Feedback */}
        <div className="bg-white rounded-md p-3 border border-orange-200">
          <p className="text-sm font-medium text-gray-700 mb-1">Client Feedback:</p>
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{parsedFeedback}</p>
        </div>

        {/* Instructions */}
        <div className="text-xs text-orange-600 italic">
          💡 Review the client's feedback carefully, make the necessary changes, and upload a revised proof below.
        </div>
      </CardContent>
    </Card>
  );
};
