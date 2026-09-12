"use client";

import { Card, PageHeader } from "@/components/ui";

export default function BackupPage() {
  return (
    <div>
      <PageHeader
        title="Backup & Recovery"
        description="This application uses Firebase. Browser users cannot execute a server backup from this screen."
      />
      <Card className="p-5 text-sm leading-6 text-slate-700">
        <p className="font-semibold text-slate-900">Backup is managed by configured backend/cloud process.</p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>Firestore and Authentication backups are performed by the organization&apos;s Google Cloud / Firebase backup configuration.</li>
          <li>This screen does not report a fake &quot;backup successful&quot; status from the browser.</li>
          <li>Export individual registers from Reports where permission allows.</li>
          <li>Restore is a controlled cloud procedure, not an in-app undo.</li>
        </ul>
      </Card>
    </div>
  );
}
