import { DatePacker, DateSwitcher, ToggleDrawer } from ".";

export function LeftSection() {
    return (
      <div className="flex items-center gap-4">
        {/* Sidebar Close/Open Toggle Control */}
        <ToggleDrawer />

        {/* Dynamic Popover Calendar Date Picker */}
        <DatePacker />

        {/* Day Switcher Quick Actions Layout */}
        <DateSwitcher />
      </div>
    );
  }