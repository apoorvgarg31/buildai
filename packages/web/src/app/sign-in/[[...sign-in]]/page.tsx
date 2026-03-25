'use client';

import { SignIn } from '@clerk/nextjs';
import AuthShell from '@/components/AuthShell';

export default function SignInPage() {
  return (
    <AuthShell mode="sign-in">
      <SignIn
        appearance={{
          elements: {
            rootBox: 'w-full',
            cardBox: 'w-full shadow-none',
            card: 'w-full border-0 bg-transparent shadow-none p-0',
            header: 'hidden',
            headerTitle: 'hidden',
            headerSubtitle: 'hidden',
            socialButtonsBlockButton:
              'rounded-2xl border border-white/10 bg-white/6 text-white hover:bg-white/10 hover:border-white/20 backdrop-blur-xl transition text-sm font-medium min-h-11',
            socialButtonsBlockButtonText: 'text-white text-sm font-medium',
            dividerLine: 'bg-white/10',
            dividerText: 'text-white/36 text-[11px] uppercase tracking-[0.28em]',
            formFieldLabel: 'text-[13px] font-medium text-white/62',
            formFieldInput:
              'rounded-2xl border border-white/10 bg-white/6 text-white placeholder:text-white/28 text-sm min-h-12 focus:border-white/24 focus:ring-[0_0_0_4px_rgba(126,102,255,0.18)] transition',
            formButtonPrimary:
              'min-h-12 rounded-2xl border border-white/20 bg-[linear-gradient(135deg,#8f7eff,#5ed9ff)] text-[#060816] text-sm font-semibold normal-case shadow-[0_18px_40px_rgba(93,120,255,0.35)] hover:scale-[1.01] hover:brightness-110 transition',
            footerActionLink: 'text-white hover:text-white font-medium',
            identityPreviewEditButton: 'text-white',
            formFieldAction: 'text-white/48 hover:text-white/78',
            footer: 'hidden',
            formResendCodeLink: 'text-white/72 hover:text-white',
            otpCodeFieldInput:
              'rounded-2xl border border-white/10 bg-white/6 text-white focus:border-white/24 focus:ring-[0_0_0_4px_rgba(126,102,255,0.18)]',
            alert: 'rounded-2xl border border-rose-400/25 bg-rose-500/10 text-rose-100',
          },
          layout: {
            socialButtonsPlacement: 'bottom',
            showOptionalFields: false,
          },
        }}
      />
    </AuthShell>
  );
}
