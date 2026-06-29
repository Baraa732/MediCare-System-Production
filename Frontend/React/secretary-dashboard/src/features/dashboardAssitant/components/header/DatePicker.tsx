import React from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useHandleDatePicker } from "../../hooks/useHandleDatePicker";

export function DatePacker() {
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const date = useHandleDatePicker((state) => state.date);
  const handleChangeDate = useHandleDatePicker(
    (state) => state.handleChangeDate,
  );
  return (
    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
      <PopoverTrigger asChild>
        <button
          // className="text-base font-bold tracking-tight text-neutral-900 min-w-[160px] text-left hover:text-[#0066ff] transition-colors flex items-center gap-2 group cursor-pointer"
          className="text-base font-bold tracking-tight text-neutral-900 min-w-40 text-left hover:text-[#0066ff] transition-colors flex items-center gap-2 group cursor-pointer"
          title="Click to pick a custom date"
        >
          <span>{format(date, "EEEE, MMMM d")}</span>
          <CalendarIcon className="w-4 h-4 text-neutral-400 group-hover:text-[#0066ff] transition-colors opacity-0 group-hover:opacity-100 duration-200 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 border-none bg-transparent shadow-none"
        align="start"
      >
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          captionLayout="dropdown"
          onSelect={(date) => date && handleChangeDate(date)}
          className="border-none"
        />
      </PopoverContent>
    </Popover>
  );
}
