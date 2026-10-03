// app/about/page.tsx: kept for old links; opens the dashboard on the "method" tab.
import { DashboardView } from "../../rr/views/DashboardView";

export default function Page() {
  return <DashboardView initial="method" />;
}
