import { Search } from "lucide-react";

  export function SearchBar() {
    return (
      // <div className="w-full max-w-[420px] relative">
      <div className="w-full max-w-105 relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 stroke-[2.5]" />
        <input
          type="text"
          placeholder="Search for anything here"
          className="w-full h-9.5 pl-10 pr-8 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium placeholder-neutral-400 focus:outline-hidden focus:border-[#0066ff] focus:bg-white transition-all"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-neutral-400 bg-white border border-neutral-200 px-1.5 py-0.5 rounded">
          /
        </span>
      </div>
    );
  }