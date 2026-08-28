export const RISK_COLORS = {
  danger: {
    bg: 'bg-gradient-to-b from-red-950 via-slate-950 to-red-950/30',
    border: 'border-red-500/30',
    accent: 'text-red-400',
    badge: 'bg-red-500/20 text-red-300',
    progress: 'from-red-500 to-orange-500',
  },
  warning: {
    bg: 'bg-gradient-to-b from-yellow-950 via-slate-950 to-yellow-950/30',
    border: 'border-yellow-500/30',
    accent: 'text-yellow-400',
    badge: 'bg-yellow-500/20 text-yellow-300',
    progress: 'from-yellow-500 to-amber-500',
  },
  safe: {
    bg: 'bg-gradient-to-b from-green-950 via-slate-950 to-green-950/30',
    border: 'border-green-500/30',
    accent: 'text-green-400',
    badge: 'bg-green-500/20 text-green-300',
    progress: 'from-green-500 to-emerald-500',
  },
  neutral: {
    bg: 'bg-gradient-to-b from-indigo-950 via-slate-950 to-indigo-950/30',
    border: 'border-indigo-500/30',
    accent: 'text-indigo-400',
    badge: 'bg-indigo-500/20 text-indigo-300',
    progress: 'from-indigo-500 to-cyan-500',
  },
} as const;

export type RiskTheme = typeof RISK_COLORS;
