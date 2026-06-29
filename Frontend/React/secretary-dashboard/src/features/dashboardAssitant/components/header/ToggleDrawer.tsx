import { Button } from "@/components/ui/button";
import { SidebarCloseIcon, SidebarOpenIcon } from "lucide-react";
import { useToggleSideBar } from "../../hooks/useToggleSideBar";

export function ToggleDrawer() {
  const isSidebarOpen = useToggleSideBar((state) => state.isSidebarOpen);
  const onToggleSidebar = useToggleSideBar((state) => state.onToggleSidebar);
  return (
    <Button
      onClick={onToggleSidebar}
      variant="ghost"
      className="p-1.5 h-9 w-9 border border-neutral-200 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50 rounded-xl transition-all shadow-3xs"
    >
      {isSidebarOpen ? (
        <SidebarCloseIcon className="w-4 h-4 stroke-[2.5]" />
      ) : (
        <SidebarOpenIcon className="w-4 h-4 stroke-[2.5] animate-in fade-in zoom-in-95 duration-200" />
      )}
    </Button>
  );
}
