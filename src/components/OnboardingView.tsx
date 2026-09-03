import React, { useState, useRef, useEffect } from 'react';
import { Headphones, BookOpen, BarChart3, Sparkles, ChevronRight, ChevronLeft, ArrowRight } from 'lucide-react';

interface OnboardingViewProps {
  onComplete: (username: string) => void;
}

const SLIDES = [
  {
    icon: Headphones,
    title: 'Welcome to LibriAudio',
    subtitle: 'Your personal audiobook & ebook companion',
    description: 'Listen, read, and track your literary journey — all in one place.',
    gradient: 'from-amber-500/20 via-amber-600/10 to-transparent',
    iconColor: 'text-amber-400',
  },
  {
    icon: Headphones,
    title: 'Listen Anywhere',
    subtitle: 'Stream or download audiobooks',
    description: 'Thousands of free audiobooks from LibriVox. Stream instantly or download for offline listening.',
    gradient: 'from-purple-500/20 via-purple-600/10 to-transparent',
    iconColor: 'text-purple-400',
  },
  {
    icon: BookOpen,
    title: 'Read Along',
    subtitle: 'Built-in ebook reader',
    description: 'Import EPUBs and read with a beautiful, customizable reader. Highlights, bookmarks, and notes included.',
    gradient: 'from-emerald-500/20 via-emerald-600/10 to-transparent',
    iconColor: 'text-emerald-400',
  },
  {
    icon: BarChart3,
    title: 'Track Progress',
    subtitle: 'Insightful listening stats',
    description: 'See your reading velocity, daily streaks, time-of-day habits, and author rankings.',
    gradient: 'from-sky-500/20 via-sky-600/10 to-transparent',
    iconColor: 'text-sky-400',
  },
  {
    icon: Sparkles,
    title: 'What\'s your name?',
    subtitle: 'Personalize your experience',
    description: 'We\'ll use this to greet you each time you open the app.',
    gradient: 'from-amber-500/20 via-rose-500/10 to-transparent',
    iconColor: 'text-amber-400',
    isInput: true,
  },
];

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [username, setUsername] = useState('');
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [animating, setAnimating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const slide = SLIDES[currentSlide];
  const Icon = slide.icon;
  const isLast = currentSlide === SLIDES.length - 1;

  useEffect(() => {
    if (isLast && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [currentSlide, isLast]);

  const goTo = (idx: number) => {
    if (animating) return;
    setDirection(idx > currentSlide ? 'next' : 'prev');
    setAnimating(true);
    setTimeout(() => {
      setCurrentSlide(idx);
      setAnimating(false);
    }, 50);
  };

  const next = () => {
    if (isLast) {
      onComplete(username.trim() || 'Reader');
      return;
    }
    goTo(currentSlide + 1);
  };

  const prev = () => {
    if (currentSlide > 0) goTo(currentSlide - 1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') next();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[var(--bg)] flex flex-col overflow-hidden">
      {/* Animated gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${slide.gradient} transition-all duration-700 ease-out`} />

      {/* Slide content */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-8">
        {/* Icon */}
        <div
          key={`icon-${currentSlide}`}
          className="mb-8 animate-[fadeSlideUp_0.5s_ease-out_both]"
        >
          <div className={`w-20 h-20 rounded-3xl bg-[var(--surface)] border border-[var(--border-subtle)] flex items-center justify-center shadow-xl ${slide.iconColor}`}>
            <Icon className="w-10 h-10" strokeWidth={1.5} />
          </div>
        </div>

        {/* Title */}
        <h1
          key={`title-${currentSlide}`}
          className="text-2xl sm:text-3xl font-serif-display italic font-bold text-[var(--text-main)] text-center mb-2 animate-[fadeSlideUp_0.5s_ease-out_0.1s_both]"
        >
          {slide.title}
        </h1>

        {/* Subtitle */}
        <p
          key={`sub-${currentSlide}`}
          className="text-sm font-medium text-[var(--accent)] text-center mb-3 animate-[fadeSlideUp_0.5s_ease-out_0.2s_both]"
        >
          {slide.subtitle}
        </p>

        {/* Description */}
        <p
          key={`desc-${currentSlide}`}
          className="text-sm text-[var(--text-dim)] text-center max-w-sm leading-relaxed animate-[fadeSlideUp_0.5s_ease-out_0.3s_both]"
        >
          {slide.description}
        </p>

        {/* Username input (last slide only) */}
        {isLast && (
          <div
            key={`input-${currentSlide}`}
            className="mt-8 w-full max-w-xs animate-[fadeSlideUp_0.5s_ease-out_0.4s_both]"
          >
            <input
              ref={inputRef}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your name..."
              maxLength={24}
              className="w-full px-5 py-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--text-main)] text-center text-lg font-serif-display placeholder:text-[var(--text-dim)]/50 focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all"
            />
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="relative px-8 pb-10 pt-4">
        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentSlide
                  ? 'w-7 bg-[var(--accent)]'
                  : 'w-1.5 bg-[var(--text-dim)]/30 hover:bg-[var(--text-dim)]/50'
              }`}
            />
          ))}
        </div>

        {/* Nav buttons */}
        <div className="flex items-center justify-between">
          {currentSlide > 0 ? (
            <button
              onClick={prev}
              className="flex items-center gap-1.5 text-sm text-[var(--text-dim)] hover:text-[var(--text-main)] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={next}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-sm shadow-lg shadow-[rgba(var(--accent-rgb),0.3)] hover:brightness-110 active:scale-[0.97] transition-all"
          >
            {isLast ? (
              <>
                Get Started
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                Continue
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Skip button */}
      {!isLast && (
        <button
          onClick={() => onComplete('Reader')}
          className="absolute top-5 right-5 text-xs text-[var(--text-dim)]/60 hover:text-[var(--text-dim)] transition-colors px-3 py-1.5"
        >
          Skip
        </button>
      )}
    </div>
  );
};
