
import React from 'react';
import { Badge } from '@/components/ui/badge';

interface JobStatusBadgeProps {
  status: string;
}

const JobStatusBadge: React.FC<JobStatusBadgeProps> = ({ status }) => {
  // Get appropriate styling based on status
  const getStatusStyles = () => {
    switch (status) {
      case 'queued':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'batched':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'processing':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'sent_to_print':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Format status text for display
  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  };

  return (
    <Badge variant="outline" className={`${getStatusStyles()} capitalize font-medium`}>
      {formatStatus(status)}
    </Badge>
  );
};

export default JobStatusBadge;
