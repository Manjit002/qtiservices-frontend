import { CountUp } from './CountUp';

export type StatTone = 'gold' | 'cyan' | 'green' | 'purple' | 'red' | 'blue';

export interface StatCardProps {
  icon: string;
  tone: StatTone;
  value: number | string;
  label: string;
}

export function StatCard({ icon, tone, value, label }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className={`sc-icon ${tone}`} aria-hidden>{icon}</div>
      <div className="sc-val"><CountUp value={value} /></div>
      <div className="sc-label">{label}</div>
    </div>
  );
}

export function StatGrid({ stats }: { stats: StatCardProps[] }) {
  return (
    <div className="stat-grid">
      {stats.map((s) => <StatCard key={s.label} {...s} />)}
    </div>
  );
}
