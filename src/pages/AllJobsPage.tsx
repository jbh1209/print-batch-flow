
import React, { useState } from 'react';
import { useAllPendingJobs, ExtendedJob } from '@/hooks/useAllPendingJobs';
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  ArrowUpDown,
  FileText,
  Loader2, 
  Search,
  AlertCircle
} from "lucide-react";
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { calculateJobUrgency, getUrgencyBackgroundClass, getUrgencyText } from '@/utils/dateCalculations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { productConfigs } from '@/config/productTypes';

const AllJobsPage: React.FC = () => {
  const { jobs, isLoading, error, refetch } = useAllPendingJobs();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProductType, setFilterProductType] = useState<string>('all');
  const [sortField, setSortField] = useState<'due_date' | 'productType'>('due_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const navigate = useNavigate();

  // Calculate urgency for each job
  const jobsWithUrgency: ExtendedJob[] = jobs.map(job => ({
    ...job,
    urgency: calculateJobUrgency(job.due_date, job.productConfig)
  }));

  // Filter jobs based on search and product type
  const filteredJobs = jobsWithUrgency.filter(job => {
    const matchesSearch = searchQuery === '' || 
      job.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.job_number.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesProductType = filterProductType === 'all' || 
      job.productConfig.productType === filterProductType;
      
    return matchesSearch && matchesProductType;
  });

  // Sort jobs
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    if (sortField === 'due_date') {
      const dateA = new Date(a.due_date);
      const dateB = new Date(b.due_date);
      return sortOrder === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
    } else if (sortField === 'productType') {
      return sortOrder === 'asc' 
        ? a.productConfig.productType.localeCompare(b.productConfig.productType)
        : b.productConfig.productType.localeCompare(a.productConfig.productType);
    }
    return 0;
  });

  // Group jobs by urgency
  const criticalJobs = sortedJobs.filter(job => job.urgency === 'critical');
  const highJobs = sortedJobs.filter(job => job.urgency === 'high');
  const mediumJobs = sortedJobs.filter(job => job.urgency === 'medium');
  const lowJobs = sortedJobs.filter(job => job.urgency === 'low');

  const toggleSort = (field: 'due_date' | 'productType') => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleNavigateToJob = (job: ExtendedJob) => {
    navigate(job.productConfig.routes.jobDetailPath(job.id));
  };
  
  const renderJobsTable = (jobsList: ExtendedJob[]) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job</TableHead>
            <TableHead 
              className="cursor-pointer"
              onClick={() => toggleSort('productType')}
            >
              Product Type
              <ArrowUpDown size={14} className="ml-1 inline" />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => toggleSort('due_date')}
            >
              Due Date
              <ArrowUpDown size={14} className="ml-1 inline" />
            </TableHead>
            <TableHead>SLA Target</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobsList.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                No jobs found matching your filters
              </TableCell>
            </TableRow>
          ) : (
            jobsList.map((job) => (
              <TableRow 
                key={`${job.productConfig.tableName}-${job.id}`}
                className={getUrgencyBackgroundClass(job.urgency)}
                onClick={() => handleNavigateToJob(job)}
                style={{ 
                  cursor: 'pointer',
                  borderLeft: `4px solid ${job.productConfig.ui.color || '#888'}` 
                }}
              >
                <TableCell>{job.job_number}</TableCell>
                <TableCell>
                  <Badge 
                    style={{ 
                      backgroundColor: job.productConfig.ui.color,
                      color: 'white' 
                    }}
                  >
                    {job.productConfig.productType}
                  </Badge>
                </TableCell>
                <TableCell>{job.name}</TableCell>
                <TableCell>{job.quantity}</TableCell>
                <TableCell>{format(new Date(job.due_date), 'MMM dd, yyyy')}</TableCell>
                <TableCell>
                  <span className="font-medium">
                    {getUrgencyText(job.urgency)}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">Queued</Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All Pending Jobs</h1>
          <p className="text-muted-foreground">
            View and manage all jobs waiting to be batched across all product types
          </p>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg mb-8">
        <div className="p-4 border-b flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs by name or job number..."
              className="w-full md:max-w-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filter by type:</span>
            <Select
              value={filterProductType}
              onValueChange={setFilterProductType}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Product Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Product Types</SelectItem>
                {Object.values(productConfigs).map((config) => (
                  <SelectItem 
                    key={config.productType} 
                    value={config.productType}
                  >
                    {config.productType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <Tabs defaultValue="all">
          <div className="px-4 pt-2">
            <TabsList className="grid grid-cols-5 mb-4">
              <TabsTrigger value="all">
                All Jobs ({sortedJobs.length})
              </TabsTrigger>
              <TabsTrigger value="critical" className="text-red-600">
                Critical ({criticalJobs.length})
              </TabsTrigger>
              <TabsTrigger value="high" className="text-amber-600">
                High ({highJobs.length})
              </TabsTrigger>
              <TabsTrigger value="medium" className="text-yellow-600">
                Medium ({mediumJobs.length})
              </TabsTrigger>
              <TabsTrigger value="low" className="text-emerald-600">
                Low ({lowJobs.length})
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="all">
            {renderJobsTable(sortedJobs)}
          </TabsContent>
          
          <TabsContent value="critical">
            {renderJobsTable(criticalJobs)}
          </TabsContent>
          
          <TabsContent value="high">
            {renderJobsTable(highJobs)}
          </TabsContent>
          
          <TabsContent value="medium">
            {renderJobsTable(mediumJobs)}
          </TabsContent>
          
          <TabsContent value="low">
            {renderJobsTable(lowJobs)}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AllJobsPage;
