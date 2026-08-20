import { cn } from "@/lib/utils";
import { useToggleSideBar } from "../../hooks/useToggleSideBar";
import {
  ControlButton,
  PendingRequestSection,
  QuickStateSection,
  TitleSideBar,
} from ".";

const SIDEBAR_WIDTH = "min(19.2vw, 320px)";

export function Sidebar() {
  const isOpen = useToggleSideBar((state) => state.isSidebarOpen);

  return (
    <aside
      style={{ width: isOpen ? SIDEBAR_WIDTH : "0px" }}
      className={cn(
        "gpu-layer relative z-20 h-full shrink-0 overflow-hidden border-r border-neutral-200/80 bg-white/95 backdrop-blur-md transition-[width,opacity] duration-300 ease-out",
        isOpen ? "opacity-100" : "pointer-events-none border-r-0 opacity-0",
      )}
      aria-hidden={!isOpen}
    >
      <div
        style={{ width: SIDEBAR_WIDTH }}
        className="flex h-full flex-col overflow-hidden"
      >
        <TitleSideBar />
        <ControlButton />
        <QuickStateSection />
        <PendingRequestSection />
      </div>
    </aside>
  );
}
