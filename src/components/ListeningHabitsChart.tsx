import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { getOverallActivitySummary, formatTrueDuration } from '../utils/activityTracker';
import { Headphones, BookOpen, Flame, Activity } from 'lucide-react';

interface DayMetric {
  dayLabel: string;
  fullDate: string;
  listenMins: number;
  readMins: number;
  totalMins: number;
}

export const ListeningHabitsChart: React.FC = () => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<SVGSVGElement>(null);
  const [summary, setSummary] = useState(getOverallActivitySummary());
  const [activeView, setActiveView] = useState<'both' | 'listen' | 'read'>('both');

  const updateStats = () => {
    setSummary(getOverallActivitySummary());
  };

  useEffect(() => {
    updateStats();
    const interval = setInterval(updateStats, 2500);
    return () => clearInterval(interval);
  }, []);

  // Build the last 7 days metrics
  const last7Days: DayMetric[] = [];
  const today = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const log = summary.dailyLogs.find((l) => l.date === dateStr);

    const listenSecs = log?.listenedSeconds || 0;
    const readSecs = log?.readSeconds || 0;

    last7Days.push({
      dayLabel: i === 0 ? 'Today' : dayNames[d.getDay()],
      fullDate: dateStr,
      listenMins: parseFloat((listenSecs / 60).toFixed(1)),
      readMins: parseFloat((readSecs / 60).toFixed(1)),
      totalMins: parseFloat(((listenSecs + readSecs) / 60).toFixed(1)),
    });
  }

  const hasActivity = last7Days.some((d) => Number.isFinite(d.totalMins) && d.totalMins > 0);

  useEffect(() => {
    if (!wrapperRef.current || !chartRef.current) return;

    const renderChart = () => {
      if (!wrapperRef.current || !chartRef.current) return;
      const clientWidth = wrapperRef.current.clientWidth;
      if (clientWidth <= 0) return;

      d3.select(chartRef.current).selectAll('*').remove();

      const margin = { top: 15, right: 15, bottom: 25, left: 35 };
      const width = Math.max(0, clientWidth - margin.left - margin.right);
      const height = Math.max(0, 150 - margin.top - margin.bottom);

      const svg = d3
        .select(chartRef.current)
        .attr('width', '100%')
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const x = d3
        .scaleBand()
        .range([0, width])
        .padding(0.35)
        .domain(last7Days.map((d) => d.dayLabel));

      const maxMins =
        d3.max(last7Days, (d) =>
          activeView === 'listen' ? d.listenMins : activeView === 'read' ? d.readMins : d.totalMins
        ) || 10;
      const safeMax = Number.isFinite(maxMins) ? maxMins : 10;
      const yMax = Math.max(safeMax * 1.25, 5);

      const y = d3.scaleLinear().range([height, 0]).domain([0, yMax]);

      // X Axis
      svg
        .append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).tickSize(0))
        .call((g) => g.select('.domain').remove())
        .selectAll('text')
        .attr('fill', '#999999')
        .attr('font-size', '10px')
        .attr('dy', '1em');

      // Y Axis
      svg
        .append('g')
        .call(
          d3
            .axisLeft(y)
            .ticks(3)
            .tickFormat((d) => `${d}m`)
            .tickSize(0)
        )
        .call((g) => g.select('.domain').remove())
        .selectAll('text')
        .attr('fill', '#666666')
        .attr('font-size', '9px')
        .attr('dx', '-0.3em');

      // Grid lines
      svg
        .append('g')
        .attr('class', 'grid')
        .call(
          d3
            .axisLeft(y)
            .ticks(3)
            .tickSize(-width)
            .tickFormat(() => '')
        )
        .call((g) => g.select('.domain').remove())
        .selectAll('.tick line')
        .attr('stroke', 'rgba(255, 255, 255, 0.05)')
        .attr('stroke-dasharray', '2,2');

      // Bars
      last7Days.forEach((d) => {
        const barX = x(d.dayLabel) || 0;
        const barWidth = x.bandwidth();

        if (activeView === 'both') {
          const listenHeight = height - y(d.listenMins);
          const readHeight = height - y(d.readMins);

          // Background base pill
          svg
            .append('rect')
            .attr('x', barX)
            .attr('y', 0)
            .attr('width', barWidth)
            .attr('height', height)
            .attr('fill', 'rgba(255,255,255,0.02)')
            .attr('rx', 4);

          // Listening sub-bar
          if (d.listenMins > 0) {
            svg
              .append('rect')
              .attr('x', barX)
              .attr('y', y(d.listenMins))
              .attr('width', barWidth)
              .attr('height', listenHeight)
              .attr('fill', '#C5A059')
              .attr('rx', 4)
              .attr('opacity', 0.9);
          }

          // Reading sub-bar (if reading is higher or present)
          if (d.readMins > 0) {
            svg
              .append('rect')
              .attr('x', barX + barWidth * 0.2)
              .attr('y', y(d.readMins))
              .attr('width', barWidth * 0.6)
              .attr('height', readHeight)
              .attr('fill', '#60a5fa')
              .attr('rx', 3)
              .attr('opacity', 0.85);
          }
        } else {
          const val = activeView === 'listen' ? d.listenMins : d.readMins;
          const barH = height - y(val);
          const color = activeView === 'listen' ? '#C5A059' : '#60a5fa';

          svg
            .append('rect')
            .attr('x', barX)
            .attr('y', y(val))
            .attr('width', barWidth)
            .attr('height', Math.max(barH, val > 0 ? 3 : 0))
            .attr('fill', color)
            .attr('rx', 4);
        }
      });
    };

    renderChart();

    const handleResize = () => renderChart();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [summary, activeView]);

  return (
    <div
      id="true-activity-widget"
      className="p-4 sm:p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] shadow-lg"
    >
      {/* Top Metrics Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
              True Reading & Listening Time
            </h3>
          </div>
          <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
            Real time logged on this device across audiobooks and ebooks
          </p>
        </div>

        {/* Day Streak Badge */}
        {summary.dailyStreak > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-dim)] border border-[var(--accent)] text-[var(--accent)] text-xs font-bold font-mono">
            <Flame className="w-3.5 h-3.5 fill-current text-amber-400" />
            <span>{summary.dailyStreak} Day Streak</span>
          </div>
        )}
      </div>

      {/* Primary True Time Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
        <div className="p-3 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[var(--text-dim)] text-[10px] uppercase tracking-wider">
            <span>True Listening</span>
            <Headphones className="w-3.5 h-3.5 text-[var(--accent)]" />
          </div>
          <div className="text-sm sm:text-base font-bold font-mono text-[var(--text-main)] mt-1">
            {formatTrueDuration(summary.totalListenedSeconds)}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[var(--text-dim)] text-[10px] uppercase tracking-wider">
            <span>True Reading</span>
            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-sm sm:text-base font-bold font-mono text-[var(--text-main)] mt-1">
            {formatTrueDuration(summary.totalReadSeconds)}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] col-span-2 sm:col-span-1 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[var(--text-dim)] text-[10px] uppercase tracking-wider">
            <span>Books Engaged</span>
            <Activity className="w-3.5 h-3.5 text-[var(--accent)]" />
          </div>
          <div className="text-sm sm:text-base font-bold font-mono text-[var(--accent)] mt-1">
            {summary.booksStartedCount} Book{summary.booksStartedCount !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Chart Filter Toggles */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] font-semibold">
          7-Day Activity Trend
        </span>
        <div className="flex items-center gap-1 bg-[var(--surface-raised)] p-0.5 rounded-lg border border-[var(--border-subtle)]">
          <button
            onClick={() => setActiveView('both')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
              activeView === 'both' ? 'bg-[var(--accent)] text-black font-bold' : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveView('listen')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
              activeView === 'listen' ? 'bg-[var(--accent)] text-black font-bold' : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> Audio
          </button>
          <button
            onClick={() => setActiveView('read')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
              activeView === 'read' ? 'bg-blue-400 text-black font-bold' : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Reading
          </button>
        </div>
      </div>

      {/* D3 Real-Time SVG Canvas */}
      <div ref={wrapperRef} className="w-full relative">
        <svg ref={chartRef} className="w-full overflow-visible" />
        {!hasActivity && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--text-dim)] text-center px-4">
            No listening or reading activity recorded in the last 7 days yet.
          </div>
        )}
      </div>
    </div>
  );
};
