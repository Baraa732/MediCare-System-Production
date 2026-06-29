import { Navigate } from "react-router";

/** Analytics merged into Overview — keep route for bookmarks */
export function AnalyticsPage() {
  return <Navigate to="/dashboard" replace />;
}
