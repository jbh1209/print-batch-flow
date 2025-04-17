
interface JobsSelectionHeaderProps {
  selectedJobsCount: number;
  totalJobsCount: number;
}

export const JobsSelectionHeader = ({
  selectedJobsCount,
  totalJobsCount,
}: JobsSelectionHeaderProps) => {
  return (
    <div className="p-4 border-b">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Select Jobs</h3>
          <p className="text-sm text-muted-foreground">
            {selectedJobsCount} of {totalJobsCount} jobs selected
          </p>
        </div>
      </div>
    </div>
  );
};
