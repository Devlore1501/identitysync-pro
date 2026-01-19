import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { UtmGenerator } from "@/components/dashboard/UtmGenerator";
import { UtmTable } from "@/components/dashboard/UtmTable";

export default function UtmTracker() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">UTM Tracker</h1>
          <p className="text-muted-foreground">
            Genera link UTM tracciabili e monitora le performance delle tue campagne
          </p>
        </div>

        <UtmGenerator />
        <UtmTable />
      </div>
    </DashboardLayout>
  );
}
