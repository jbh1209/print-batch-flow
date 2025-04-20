
import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { format } from "date-fns";

interface JobDetailsCardProps {
  name: string;
  jobNumber: string;
  createdAt: string;
  status: string;
}

export const JobDetailsCard = ({
  name,
  jobNumber,
  createdAt,
  status
}: JobDetailsCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Job Details</CardTitle>
        <CardDescription>Basic information about this job</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-500">Client:</span>
            <span>{name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-500">Job Number:</span>
            <span>{jobNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-500">Created:</span>
            <span>{format(new Date(createdAt), 'PPP')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-500">Status:</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium 
              ${status === 'queued' ? 'bg-yellow-100 text-yellow-800' : 
              status === 'batched' ? 'bg-blue-100 text-blue-800' : 
              status === 'completed' ? 'bg-green-100 text-green-800' : 
              'bg-gray-100 text-gray-800'}`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
