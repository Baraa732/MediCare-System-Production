import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SettingsSection = "identity" | "location" | "contact" | "operations";

type SettingsSectionNavProps = {
  active: SettingsSection;
  onChange: (section: SettingsSection) => void;
  dirtySections: Set<SettingsSection>;
};

const sections: { id: SettingsSection; label: string; description: string }[] = [
  { id: "identity", label: "Identity", description: "Name & description" },
  { id: "location", label: "Location", description: "Address & region" },
  { id: "contact", label: "Contact", description: "Phone & email" },
  { id: "operations", label: "Operations", description: "Timezone & status" },
];

export function SettingsSectionNav({
  active,
  onChange,
  dirtySections,
}: SettingsSectionNavProps) {
  return (
    <nav className="pbi-panel p-2 space-y-0.5">
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => onChange(section.id)}
          className={cn(
            "w-full text-left px-3 py-2.5 rounded-sm transition-colors relative",
            active === section.id
              ? "bg-[#ecf3ff] text-[#0066ff]"
              : "hover:bg-[#f3f2f1] text-[#1a1b1e]",
          )}
        >
          {active === section.id && (
            <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-[#0066ff]" />
          )}
          <p className="text-sm font-semibold pl-1">{section.label}</p>
          <p className="text-[11px] text-[#929296] pl-1">{section.description}</p>
          {dirtySections.has(section.id) && (
            <span className="absolute right-3 top-3 w-1.5 h-1.5 rounded-full bg-[#0066ff]" />
          )}
        </button>
      ))}
    </nav>
  );
}

export function SettingsFieldGroup({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#929296] flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {title}
      </p>
      {children}
    </div>
  );
}
