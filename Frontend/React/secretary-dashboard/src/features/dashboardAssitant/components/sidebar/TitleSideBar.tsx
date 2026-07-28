export function TitleSideBar() {
  return (
    <div className="h-16 px-5 border-b border-neutral-100 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-[#0066ff] text-white flex items-center justify-center font-black text-base">
          +
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight text-neutral-900 leading-none">
            Project name
          </span>
          <span className="text-[11px] text-neutral-400 font-medium mt-0.5">
            Clinic management system
          </span>
        </div>
      </div>
      {/* <DrawerTrigger asChild> */}
      {/* <Button
        onClick={onClose}
        className="text-neutral-400 hover:text-neutral-600 p-1 rounded-md hover:bg-neutral-50"
      >
        <SidebarCloseIcon className="w-4 h-4" />
      </Button> */}
      {/* </DrawerTrigger> */}
    </div>
  );
}