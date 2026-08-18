import { Search } from "lucide-react";
import { useScheduleGridStore } from "../../hooks/scheduleGridStore";

export function SearchBar() {
  const searchQuery = useScheduleGridStore((s) => s.searchQuery);
  const setSearchQuery = useScheduleGridStore((s) => s.setSearchQuery);

  return (
    <div className="w-full max-w-105 relative">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 stroke-[2.5]" />
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search patient or doctor"
        className="w-full h-9.5 pl-10 pr-8 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium placeholder-neutral-400 focus:outline-hidden focus:border-[#0066ff] focus:bg-white transition-all"
      />
    </div>
  );
}
