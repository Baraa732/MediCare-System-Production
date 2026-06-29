import { cn } from "@/lib/utils";
import { useToggleSideBar } from "../../hooks/useToggleSideBar";
import {
  ControlButton,
  PendingRequestSection,
  QuickStateSection,
  TitleSideBar,
} from ".";

export function Sidebar() {
  const isOpen = useToggleSideBar((state) => state.isSidebarOpen);
  return (
    <aside
      className={cn(
        "h-full border-r border-neutral-200 bg-white flex flex-col shrink-0 z-20 relative ",
        "transition-all duration-300 ease-in-out project-drawer-transition ",
        isOpen
          ? "w-[19.2%] opacity-100 overflow-hidden"
          : "w-0 opacity-0 pointer-events-none border-r-0 overflow-hidden",
      )}
    >
      {/* Platform Identity Section */}
      <TitleSideBar />
      {/* Action Controller Tray */}
      <ControlButton />
      {/* Quick Stats Metric Cluster */}
      <QuickStateSection />
      {/* Scrollable Pending Notifications Node */}
      <PendingRequestSection />
    </aside>
  );
}
