
import { Badge } from "@/components/ui/badge";
import { LaminationType } from "./JobsTable";

interface LaminationFilterProps {
  laminationFilter: LaminationType | null;
  setLaminationFilter: (type: LaminationType | null) => void;
}

const LaminationFilter = ({ laminationFilter, setLaminationFilter }: LaminationFilterProps) => {
  return (
    <div className="flex border-b p-4 bg-gray-50 gap-2">
      <Badge 
        variant="outline" 
        className={`cursor-pointer hover:bg-gray-100 ${!laminationFilter ? 'bg-gray-200 border-gray-300' : ''}`}
        onClick={() => setLaminationFilter(null)}
      >
        All
      </Badge>
      <Badge 
        variant="outline" 
        className={`cursor-pointer hover:bg-gray-100 ${laminationFilter === 'gloss' ? 'bg-gray-200 border-gray-300' : ''}`}
        onClick={() => setLaminationFilter('gloss')}
      >
        Gloss
      </Badge>
      <Badge 
        variant="outline" 
        className={`cursor-pointer hover:bg-gray-100 ${laminationFilter === 'matt' ? 'bg-gray-200 border-gray-300' : ''}`}
        onClick={() => setLaminationFilter('matt')}
      >
        Matt
      </Badge>
      <Badge 
        variant="outline" 
        className={`cursor-pointer hover:bg-gray-100 ${laminationFilter === 'soft_touch' ? 'bg-gray-200 border-gray-300' : ''}`}
        onClick={() => setLaminationFilter('soft_touch')}
      >
        Soft Touch
      </Badge>
      <Badge 
        variant="outline" 
        className={`cursor-pointer hover:bg-gray-100 ${laminationFilter === 'none' ? 'bg-gray-200 border-gray-300' : ''}`}
        onClick={() => setLaminationFilter('none')}
      >
        None
      </Badge>
    </div>
  );
};

export default LaminationFilter;
