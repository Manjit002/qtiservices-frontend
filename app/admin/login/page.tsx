'use client';

import { Boxes, Users, LineChart, KeyRound } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { SignInForm } from '@/components/auth/SignInForm';
import { ROUTES } from '@/lib/api/endpoints';

export default function AdminLoginPage() {
  return (
    <AuthLayout
      portal="admin"
      eyebrow="Admin console"
      claim={<>Every order, expert and payment in one place.</>}
      sub="Triage what needs attention, assign the right expert, and keep work moving to deadline."
      points={[
        { icon: Boxes, title: 'Order operations', body: 'Review, price, assign and track to delivery.' },
        { icon: Users, title: 'People', body: 'Manage experts and students, and their access.' },
        { icon: LineChart, title: 'Revenue', body: 'Payments, installments and verification in one view.' },
        { icon: KeyRound, title: 'Access control', body: 'Roles and permissions, down to the action.' },
      ]}
    >
      <SignInForm
        portal="admin"
        heading="Sign in"
        sub="Use your administrator account."
        emailPlaceholder="you@myonlineclasspro.com"
        cta="Sign in"
        redirectTo={ROUTES.adminDashboard}
      />
    </AuthLayout>
  );
}
