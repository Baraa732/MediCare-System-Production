import type { LucideProps } from "lucide-react";

export interface QuickStateType {
  label: string;
  count: number;
  icon: React.ForwardRefExoticComponent<
    Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>
  >;
  color: string;
  bg: string;
}
