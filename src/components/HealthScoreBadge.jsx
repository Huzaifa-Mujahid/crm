import React from 'react';

const HealthScoreBadge = ({ score, compact = false }) => {
  const getHealthColor = (val) => {
    if (val >= 80) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (val >= 60) return 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20';
    if (val >= 40) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
  };

  const colorClasses = getHealthColor(score);

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${colorClasses}`}>
        {score}%
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
        <span>Health</span>
        <span className={colorClasses.split(' ')[0]}>{score}%</span>
      </div>
      <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ${colorClasses.split(' ')[1].replace('/10', '')}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
};

export default HealthScoreBadge;
