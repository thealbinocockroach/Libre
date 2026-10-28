import React from 'react';
import { BookOpen, Check, Download, Palette, Search, X } from 'lucide-react';

export const CURRENT_RELEASE_NOTES_ID = 'theme-preference-persistence-2026-10-28';

interface ReleaseNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const changes = [
  {
    icon: Palette,
    title: 'Your theme choice stays selected',
    description: 'Follow device appearance switches with the system. Any theme you choose manually is now saved and remains active after restarting the app.',
  },
  {
    icon: BookOpen,
    title: 'Ebooks load without getting stuck',
    description: 'Reader lookup now matches by title instead of reusing colliding catalog IDs. It skips cached text for a different book or language, tries direct Gutenberg text files, then searches public Internet Archive OCR editions.',
  },
  {
    icon: BookOpen,
    title: 'More reliable Gutenberg reading',
    description: 'Ebook requests now have bounded timeouts and an official Project Gutenberg mirror fallback if the main text host is unreachable.',
  },
  {
    icon: Palette,
    title: 'Cleaner profile drawer edge',
    description: 'Removed the colored 3D shadow that created a bright vertical stripe along the drawer edge.',
  },
  {
    icon: BookOpen,
    title: 'Books stay available offline',
    description: 'Ebooks you open are saved on this device. Search can find saved ebooks and downloaded audiobooks without a connection.',
  },
  {
    icon: Palette,
    title: 'One theme across the app',
    description: 'The app and ebook reader share the same colors. Follow device appearance to switch between light and dark automatically.',
  },
  {
    icon: Download,
    title: 'Offline listening and home',
    description: 'Downloaded audiobooks and local book shelves remain accessible when the network is unavailable.',
  },
  {
    icon: Search,
    title: 'Search your device first',
    description: 'Saved, recently opened, and downloaded books appear in local search while online catalogs load in the background.',
  },
];

export const ReleaseNotesModal: React.FC<ReleaseNotesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="release-notes-title">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-2xl text-[var(--text-main)]">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--accent)]">Latest update · October 28, 2026</p>
            <h2 id="release-notes-title" className="mt-1 text-xl font-serif-display italic font-bold">What’s new</h2>
          </div>
          <button onClick={onClose} aria-label="Close release notes" className="rounded-full p-2 text-[var(--text-dim)] hover:bg-[var(--surface)] hover:text-[var(--text-main)]"><X className="w-4 h-4" /></button>
        </div>

        <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
          {changes.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex gap-3 py-3">
              <div className="mt-0.5 h-8 w-8 shrink-0 rounded-xl bg-[var(--accent-dim)] flex items-center justify-center text-[var(--accent)]"><Icon className="w-4 h-4" /></div>
              <div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-relaxed text-[var(--text-dim)]">{description}</p></div>
            </div>
          ))}
        </div>

        <button onClick={onClose} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-hover)]">
          <Check className="w-4 h-4" /> Got it
        </button>
      </div>
    </div>
  );
};
