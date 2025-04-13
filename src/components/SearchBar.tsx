
import { Search } from "lucide-react";

const SearchBar = () => {
  return (
    <div className="relative w-full max-w-md">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
        <Search size={18} />
      </div>
      <input
        type="text"
        className="w-full py-2 pl-10 pr-4 text-sm text-gray-700 bg-gray-100 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        placeholder="Search batches, jobs..."
      />
    </div>
  );
};

export default SearchBar;
