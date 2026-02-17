'use client';

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-full flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-[380px]">
        {/* BuildAI Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#171717] text-white font-bold text-xl mb-4">
            B
          </div>
          <h1 className="text-xl font-semibold text-[#171717]">Welcome to BuildAI</h1>
          <p className="text-sm text-[#8e8e8e] mt-1">AI-Powered Construction Management</p>
        </div>

        {/* Clerk Sign-In */}
        <div className="flex justify-center">
          <SignIn
            appearance={{
              elements: {
                rootBox: 'w-full',
                cardBox: 'w-full shadow-none',
                card: 'w-full shadow-none border border-[#e5e5e5] rounded-2xl p-0',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
                socialButtonsBlockButton:
                  'border-[#e5e5e5] text-[#171717] hover:bg-[#f9f9f9] rounded-xl text-sm font-medium',
                socialButtonsBlockButtonText: 'text-[#171717] text-sm font-medium',
                dividerLine: 'bg-[#e5e5e5]',
                dividerText: 'text-[#8e8e8e] text-[11px] uppercase tracking-wider',
                formFieldLabel: 'text-[13px] font-medium text-[#666]',
                formFieldInput:
                  'rounded-xl border-[#e5e5e5] text-[#171717] placeholder-[#b4b4b4] text-sm focus:ring-[#171717]/10 focus:border-[#171717]/30',
                formButtonPrimary:
                  'bg-[#171717] hover:bg-[#333] rounded-xl text-sm font-medium normal-case',
                footerActionLink: 'text-[#171717] hover:text-[#333] font-medium',
                identityPreviewEditButton: 'text-[#171717]',
                formFieldAction: 'text-[#8e8e8e] hover:text-[#171717]',
                footer: 'hidden',
              },
              layout: {
                socialButtonsPlacement: 'bottom',
                showOptionalFields: false,
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
