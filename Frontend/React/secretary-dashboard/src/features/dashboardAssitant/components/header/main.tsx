import { LeftSection, RightSection, SearchBar, ActiveFilterChips } from ".";

export function Header() {
  return (
    <div className="relative z-30 shrink-0">
      <header className="glass-header flex h-16 w-full items-center justify-between gap-3 px-4 sm:px-6">
        <LeftSection />
        <SearchBar />
        <RightSection />
      </header>
      <ActiveFilterChips />
    </div>
  );
}
