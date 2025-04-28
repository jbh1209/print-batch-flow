
import React from 'react';
import { useAllPendingJobs } from '@/hooks/useAllPendingJobs';
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import JobsHeader from '@/components/jobs/JobsHeader';
import JobsFilters from '@/components/jobs/JobsFilters';
import JobTabs from '@/components/jobs/JobTabs';
import JobsTable from '@/components/jobs/JobsTable';
import { useJobFiltering } from '@/hooks/useJobFiltering';

const AllJobsPage: React.FC = () => {
  const { jobs, isLoading, error, refetch } = useAllPendingJobs();
  const {
    searchQuery,
    setSearchQuery,
    filterProductType,
    setFilterProductType,
    sortField,
    sortOrder,
    toggleSort,
    sortedJobs,
    criticalJobs,
    highJobs,
    mediumJobs,
    lowJobs
  } = useJobFiltering(jobs);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Loading jobs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          <div>
            <p className="font-medium">There was a problem loading jobs</p>
            <p className="text-sm mt-1">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => refetch()}
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <JobsHeader 
        title="All Pending Jobs"
        description="View and manage all jobs waiting to be batched across all product types"
      />

      <div className="bg-white shadow rounded-lg mb-8">
        <JobsFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterProductType={filterProductType}
          setFilterProductType={setFilterProductType}
        />
        
        <Tabs defaultValue="all">
          <JobTabs
            allJobs={sortedJobs}
            criticalJobs={criticalJobs}
            highJobs={highJobs}
            mediumJobs={mediumJobs}
            lowJobs={lowJobs}
          />
          
          <TabsContent value="all">
            <JobsTable jobs={sortedJobs} sortField={sortField} sortOrder={sortOrder} toggleSort={toggleSort} />
          </TabsContent>
          
          <TabsContent value="critical">
            <JobsTable jobs={criticalJobs} sortField={sortField} sortOrder={sortOrder} toggleSort={toggleSort} />
          </TabsContent>
          
          <TabsContent value="high">
            <JobsTable jobs={highJobs} sortField={sortField} sortOrder={sortOrder} toggleSort={toggleSort} />
          </TabsContent>
          
          <TabsContent value="medium">
            <JobsTable jobs={mediumJobs} sortField={sortField} sortOrder={sortOrder} toggleSort={toggleSort} />
          </TabsContent>
          
          <TabsContent value="low">
            <JobsTable jobs={lowJobs} sortField={sortField} sortOrder={sortOrder} toggleSort={toggleSort} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AllJobsPage;
