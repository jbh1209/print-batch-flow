
interface FilterCounts {
  all: number;
  queued: number;
  batched: number;
  completed: number;
}

interface StatusFilterTabsProps {
  filterView: "all" | "queued" | "batched" | "completed" | "cancelled";
  filterCounts: FilterCounts;
  setFilterView: (view: "all" | "queued" | "batched" | "completed" | "cancelled") => void;
}

const StatusFilterTabs = ({ filterView, filterCounts, setFilterView }: StatusFilterTabsProps) => {
  return (
    <div className="flex border-b">
      <button 
        className={`px-6 py-3 text-sm font-medium ${filterView === 'all' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        onClick={() => setFilterView('all')}
      >
        All ({filterCounts.all})
      </button>
      <button 
        className={`px-6 py-3 text-sm font-medium ${filterView === 'queued' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        onClick={() => setFilterView('queued')}
      >
        Queued ({filterCounts.queued})
      </button>
      <button 
        className={`px-6 py-3 text-sm font-medium ${filterView === 'batched' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        onClick={() => setFilterView('batched')}
      >
        Batched ({filterCounts.batched})
      </button>
      <button 
        className={`px-6 py-3 text-sm font-medium ${filterView === 'completed' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        onClick={() => setFilterView('completed')}
      >
        Completed ({filterCounts.completed})
      </button>
    </div>
  );
};

export default StatusFilterTabs;
