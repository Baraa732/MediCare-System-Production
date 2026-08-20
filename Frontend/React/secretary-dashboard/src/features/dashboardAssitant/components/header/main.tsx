import { LeftSection, RightSection, SearchBar } from ".";

export function Header() {
  return (
    <header className="glass-header gpu-layer z-10 flex h-16 w-full shrink-0 items-center justify-between gap-3 px-4 sm:px-6">
      <LeftSection />
      <SearchBar />
      <RightSection />
    </header>
  );
}
