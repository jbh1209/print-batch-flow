
import React from "react";

type Props = {
  viewMode: "card" | "list";
  onChange: (mode: "card" | "list") => void;
};

const ColumnViewToggle: React.FC<Props> = ({ viewMode, onChange }) => (
  <div className="flex gap-1 items-center">
    <button
      className={`p-1 rounded ${viewMode === "card" ? "bg-green-200" : "bg-gray-100"} text-xs`}
      title="Card View"
      onClick={() => onChange("card")}
    >
      <svg width={16} height={16} viewBox="0 0 16 16" className="inline">
        <rect x="1" y="1" width="6" height="6" rx="1" fill={viewMode==="card"?"#22c55e":"#e5e7eb"}/>
        <rect x="9" y="1" width="6" height="6" rx="1" fill={viewMode==="card"?"#22c55e":"#e5e7eb"}/>
        <rect x="1" y="9" width="6" height="6" rx="1" fill={viewMode==="card"?"#22c55e":"#e5e7eb"}/>
        <rect x="9" y="9" width="6" height="6" rx="1" fill={viewMode==="card"?"#22c55e":"#e5e7eb"}/>
      </svg>
    </button>
    <button
      className={`p-1 rounded ${viewMode === "list" ? "bg-green-200" : "bg-gray-100"} text-xs`}
      title="List View"
      onClick={() => onChange("list")}
    >
      <svg width={16} height={16} viewBox="0 0 16 16" className="inline">
        <rect x="2" y="3" width="12" height="2" rx="1" fill={viewMode==="list"?"#22c55e":"#e5e7eb"}/>
        <rect x="2" y="7" width="12" height="2" rx="1" fill={viewMode==="list"?"#22c55e":"#e5e7eb"}/>
        <rect x="2" y="11" width="12" height="2" rx="1" fill={viewMode==="list"?"#22c55e":"#e5e7eb"}/>
      </svg>
    </button>
  </div>
);

export default ColumnViewToggle;
