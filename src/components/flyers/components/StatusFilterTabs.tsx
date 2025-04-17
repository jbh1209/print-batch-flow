
interface StatusFilterTabsProps {
  filterView: 'all' | 'queued' | 'batched' | 'completed';
  setFilterView: (view: 'all' | 'queued' | 'batched' | 'completed') => void;
  filterCounts: {
    all: number;
    queued: number;
    batched: number;
    completed: number;
  };
}

export const StatusFilterTabs = ({ 
  filterView, 
  setFilterView,
  filterCounts 
}: StatusFilterTabsProps) => {
  return (
    <div className="border-b">
      <div className="flex">
        <button
          className={`px-4 py-2 text-sm font-medium ${
            filterView === 'all' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'
          }`}
          onClick={() => setFilterView('all')}
        >
          All ({filterCounts.all})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            filterView === 'queued' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'
          }`}
          onClick={() => setFilterView('queued')}
        >
          Queued ({filterCounts.queued})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            filterView === 'batched' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'
          }`}
          onClick={() => setFilterView('batched')}
        >
          Batched ({filterCounts.batched})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            filterView === 'completed' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'
          }`}
          onClick={() => setFilterView('completed')}
        >
          Completed ({filterCounts.completed})
        </button>
      </div>
    </div>
  );
};
