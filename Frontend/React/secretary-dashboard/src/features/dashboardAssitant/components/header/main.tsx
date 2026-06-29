import { LeftSection, RightSection, SearchBar } from ".";

export function Header() {
  return (
    <header className="h-16 w-full border-b border-neutral-200 bg-white px-6 flex items-center justify-between shrink-0 z-10">
      {/* Drawer Icons and Date Picker */}
      <LeftSection />

      {/* Main Search Input Workspace Context */}
      <SearchBar />

      {/* Profile and Settings Control Bar */}
      <RightSection />
    </header>
  );
}
