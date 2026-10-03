// app/search/page.tsx: kept for old links; opens the dashboard on the "lookup" tab.
import { DashboardView } from "../../rr/views/DashboardView";

export default function Page() {
  return <DashboardView initial="lookup" />;
}
