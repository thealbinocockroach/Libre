import React from 'react';
import {
  getTimeOfDayDistribution,
  getListeningVelocity,
} from '../utils/activityTracker';
import { Sun, Sunset, Moon, Coffee, Clock, Zap } from 'lucide-react';

export const TimeOfDayWidget: React.FC = () => {
  const timeOfDay = getTimeOfDayDistribution();
  const velocity = getListeningVelocity();

  const periods = [
    {
      name: 'Morning',
      timeSpan: '6:00 AM - 12:00 PM',
      icon: Coffee,
      mins: timeOfDay.morningMins,
      percent: timeOfDay.morningPercent,
      color: 'text-amber-300',
      barColor: 'bg-amber-400',
    },
    {
      name: 'Afternoon',
      timeSpan: '12:00 PM - 6:00 PM',
      icon: Sun,
      mins: timeOfDay.afternoonMins,
      percent: timeOfDay.afternoonPercent,
      color: 'text-orange-400',
      barColor: 'bg-orange-400',
    },
    {
      name: 'Evening',
      timeSpan: '6:00 PM - 10:00 PM',
      icon: Sunset,
      mins: timeOfDay.eveningMins,
      percent: timeOfDay.eveningPercent,
      color: 'text-purple-400',
      barColor: 'bg-purple-400',
    },
    {
      name: 'Night',
      timeSpan: '10:00 PM - 6:00 AM',
      icon: Moon,
      mins: timeOfDay.nightMins,
      percent: timeOfDay.nightPercent,
      color: 'text-indigo-300',
      barColor: 'bg-indigo-400',
    },
  ];

  return (
    <div
      id="time-of-day-widget"
      className="p-5 rounded-2xl bg-[#111111] border border-white/[0.08] shadow-xl space-y-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-[#C5A059]/15 border border-[#C5A059]/30 flex items-center justify-center text-[#C5A059]">
            <Clock className="w-4 h-4 text-[#C5A059]" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
              Listening Window & Velocity
            </h3>
            <p className="text-[11px] text-white/50 mt-0.5">
              When you listen and your daily audiobook velocity
            </p>
          </div>
        </div>

        {/* Peak Window Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-medium text-white/80 self-start sm:self-auto">
          <Zap className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>
            Peak Time: <strong className="text-[#C5A059]">{timeOfDay.peakPeriod}</strong>
          </span>
        </div>
      </div>

      {/* Velocity Banner Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-[10px] uppercase font-semibold text-white/40 block">
            Daily Average
          </span>
          <div className="text-sm sm:text-base font-mono font-bold text-white mt-1">
            {velocity.dailyAverageMinutes}m <span className="text-[10px] text-white/40 font-sans">/ day</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-[10px] uppercase font-semibold text-white/40 block">
            Weekly Velocity
          </span>
          <div className="text-sm sm:text-base font-mono font-bold text-[#C5A059] mt-1">
            {velocity.weeklyVelocityHours}h <span className="text-[10px] text-white/40 font-sans">/ week</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-[10px] uppercase font-semibold text-white/40 block">
            Most Active Day
          </span>
          <div className="text-sm sm:text-base font-serif-display italic font-bold text-white mt-1 truncate">
            {velocity.mostActiveDay}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-[10px] uppercase font-semibold text-white/40 block">
            Projected Month
          </span>
          <div className="text-sm sm:text-base font-mono font-bold text-emerald-400 mt-1">
            ~{velocity.projectedMonthlyHours}h <span className="text-[10px] text-white/40 font-sans">/ mo</span>
          </div>
        </div>
      </div>

      {/* Multi-Period Stacked Visual Bar */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[11px] text-white/50 font-mono">
          <span>Daytime Immersion Split</span>
          <span>100% distribution</span>
        </div>
        <div className="h-3 w-full rounded-full bg-white/5 flex overflow-hidden p-0.5 border border-white/10">
          {periods.map((p) => {
            if (p.percent <= 0) return null;
            return (
              <div
                key={p.name}
                className={`${p.barColor} h-full first:rounded-l-full last:rounded-r-full transition-all duration-700`}
                style={{ width: `${Math.max(4, p.percent)}%` }}
                title={`${p.name}: ${p.percent}% (${p.mins}m)`}
              />
            );
          })}
        </div>
      </div>

      {/* 4-Column Time of Day Breakdown Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {periods.map((p) => {
          const Icon = p.icon;
          const isPeak = timeOfDay.peakPeriod === p.name;
          return (
            <div
              key={p.name}
              className={`p-3 rounded-xl border transition-all ${
                isPeak
                  ? 'bg-white/[0.04] border-[#C5A059]/40 shadow-sm shadow-[#C5A059]/10'
                  : 'bg-white/[0.02] border-white/5'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-3.5 h-3.5 ${p.color}`} />
                  <span className="text-xs font-semibold text-white">{p.name}</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-white/70">
                  {p.percent}%
                </span>
              </div>
              <p className="text-[9px] text-white/40 font-mono truncate mb-1">
                {p.timeSpan}
              </p>
              <div className="text-xs font-mono font-semibold text-white/90">
                {p.mins} mins
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
