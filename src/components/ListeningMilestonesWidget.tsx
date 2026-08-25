import React from 'react';
import { Audiobook } from '../types';
import { getListeningMilestones, ListeningMilestone } from '../utils/activityTracker';
import { Award, Lock, Sparkles, CheckCircle2 } from 'lucide-react';

interface ListeningMilestonesWidgetProps {
  history?: Audiobook[];
}

export const ListeningMilestonesWidget: React.FC<ListeningMilestonesWidgetProps> = ({
  history = [],
}) => {
  const milestones = getListeningMilestones(history);
  const unlockedCount = milestones.filter((m) => m.unlocked).length;

  return (
    <div
      id="listening-milestones-widget"
      className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] shadow-xl space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)]">
            <Award className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[var(--text-main)] flex items-center gap-2">
              Listening Milestones & Badges
            </h3>
            <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
              Unlock achievements as your immersion and reading habits grow
            </p>
          </div>
        </div>

        <div className="px-2.5 py-1 rounded-full bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--accent)] font-bold shrink-0">
          {unlockedCount} / {milestones.length} Unlocked
        </div>
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {milestones.map((m) => {
          return (
            <div
              key={m.id}
              id={`milestone-badge-${m.id}`}
              className={`p-3.5 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                m.unlocked
                  ? 'bg-gradient-to-b from-[#181611] to-[var(--surface-raised)] border-[var(--accent)] shadow-md shadow-[rgba(var(--accent-rgb),0.3)]'
                  : 'bg-[var(--surface-raised)] border-[var(--border-subtle)] opacity-70 hover:opacity-90'
              }`}
            >
              {/* Top Row: Icon & Status Badge */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg border ${
                    m.unlocked
                      ? 'bg-[var(--accent-dim)] border-[var(--accent)] shadow-inner'
                      : 'bg-[var(--surface-raised)] border-[var(--border-subtle)] text-[var(--text-dim)] grayscale'
                  }`}
                >
                  {m.icon}
                </div>

                {m.unlocked ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Unlocked
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-[var(--text-dim)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded-md">
                    <Lock className="w-2.5 h-2.5" /> {m.progressPercent}%
                  </span>
                )}
              </div>

              {/* Title & Description */}
              <div className="space-y-1 mb-3">
                <h4 className="text-xs font-bold text-[var(--text-main)] font-serif-display italic tracking-wide">
                  {m.title}
                </h4>
                <p className="text-[11px] text-[var(--text-dim)] leading-snug">
                  {m.description}
                </p>
              </div>

              {/* Progress Bar & Criteria */}
              <div className="space-y-1 pt-1 border-t border-[var(--border-subtle)]">
                <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-dim)]">
                  <span>Progress</span>
                  <span className={m.unlocked ? 'text-[var(--accent)] font-bold' : ''}>
                    {m.currentValue} / {m.targetValue}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[var(--surface-raised)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      m.unlocked ? 'bg-[var(--accent)]' : 'bg-[var(--surface-raised)]'
                    }`}
                    style={{ width: `${m.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
