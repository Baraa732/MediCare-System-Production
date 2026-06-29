import { useEffect } from "react";
import { Navigate } from "react-router";
import { useProfileDrawerStore } from "@/stores/profileDrawerStore";

/** Deep link: open the profile drawer and return to dashboard. */
export function ProfilePage() {
  const open = useProfileDrawerStore((s) => s.open);

  useEffect(() => {
    open("profile");
  }, [open]);

  return <Navigate to="/dashboard" replace />;
}
