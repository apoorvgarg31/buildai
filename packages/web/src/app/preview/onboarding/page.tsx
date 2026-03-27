import { notFound } from 'next/navigation';
import WorkspaceOnboardingPage from '@/components/WorkspaceOnboardingPage';

export default function OnboardingPreviewPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#edf4ff,#f9fbff)]">
      <WorkspaceOnboardingPage user={{ name: 'Apoorv Garg', role: 'admin' }} />
    </div>
  );
}
