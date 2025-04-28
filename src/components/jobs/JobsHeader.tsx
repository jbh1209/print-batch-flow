
import React from 'react';

interface JobsHeaderProps {
  title: string;
  description: string;
}

const JobsHeader: React.FC<JobsHeaderProps> = ({ title, description }) => {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  );
};

export default JobsHeader;
