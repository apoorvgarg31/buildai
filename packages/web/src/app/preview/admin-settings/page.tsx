import { notFound } from 'next/navigation';
import AdminSettingsPage from '@/components/AdminSettingsPage';

export default function AdminSettingsPreviewPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef4ff,#f8fbff)]">
      <AdminSettingsPage
        initialSettings={{
          companyName: 'Mira Command',
          defaultModel: 'anthropic/claude-sonnet-4-20250514',
          responseStyle: 'detailed',
          maxQueriesPerDay: 700,
          maxAgents: 25,
          dataRetentionDays: 120,
          hasSharedApiKey: true,
        }}
      />
    </div>
  );
}
