// app/dashboard/page.tsx: the dashboard (address lookup, change tests, method).
import { DashboardView } from "../../rr/views/DashboardView";

export default function Page() {
  return <DashboardView initial="lookup" />;
}
