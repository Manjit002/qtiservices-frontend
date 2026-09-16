'use client';

import { ClipboardList, Clock, Upload, MessagesSquare } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { SignInForm } from '@/components/auth/SignInForm';
import { ROUTES } from '@/lib/api/endpoints';

export default function ExpertLoginPage() {
  return (
    <AuthLayout
      portal="expert"
      eyebrow="Expert workspace"
      claim={<>Your work, ordered by what&rsquo;s due next.</>}
      sub="See the assignments that need you today, deliver the files, and keep the student in the loop."
      points={[
        { icon: ClipboardList, title: 'Your assignments', body: 'Everything assigned to you, and its status.' },
        { icon: Clock, title: 'Deadlines first', body: 'Overdue and due-today surfaced ahead of the rest.' },
        { icon: Upload, title: 'Deliverables', body: 'Upload work and track what you have submitted.' },
        { icon: MessagesSquare, title: 'Availability', body: 'Set your status so you get the right workload.' },
      ]}
    >
      <SignInForm
        portal="expert"
        heading="Sign in"
        sub="Use your expert account."
        emailPlaceholder="you@myonlineclasspro.com"
        cta="Sign in"
        redirectTo={ROUTES.expertDashboard}
      />
    </AuthLayout>
  );
}
