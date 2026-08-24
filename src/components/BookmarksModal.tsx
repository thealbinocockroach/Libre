import React, { useState } from 'react';
import { Bookmark, Audiobook, AudioTrack } from '../types';
import { Bookmark as BookmarkIcon, Plus, Trash2, Play, Clock, X, Edit3, MessageSquare } from 'lucide-react';

interface BookmarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: Audiobook | null;
  currentTrack: AudioTrack | null;
  currentTrackIndex: number;
  currentTime: number;
  bookmarks: Bookmark[];
  onAddBookmark: (note?: string) => void;
  onDeleteBookmark: (id: string) => void;
  onJumpToBookmark: (bookmark: Bookmark) => void;
}

export const BookmarksModal: React.FC<BookmarksModalProps> = ({
  isOpen,
  onClose,
  book,
  currentTrack,
  currentTrackIndex,
  currentTime,
  bookmarks,
  onAddBookmark,
  onDeleteBookmark,
  onJumpToBookmark,
}) => {
  const [noteInput, setNoteInput] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  if (!isOpen || !book) return null;

  const bookBookmarks = bookmarks.filter((b) => b.bookId === book.id);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    onAddBookmark(noteInput.trim() || undefined);
    setNoteInput('');
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        id="bookmarks-modal"
        className="w-full max-w-md rounded-3xl bg-[#121212] border border-white/10 shadow-2xl p-6 space-y-5 text-white animate-in zoom-in-95 max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#C5A059]/10 text-[#C5A059] border border-[#C5A059]/20">
              <BookmarkIcon className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-base font-serif-display font-semibold italic text-[#E8E8E8]">
                Audiobook Bookmarks & Notes
              </h3>
              <p className="text-[11px] text-white/50 truncate max-w-[200px]">{book.title}</p>
            </div>
          </div>
          <button
            id="btn-close-bookmarks"
            onClick={onClose}
            className="p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Add at Current Timestamp */}
        <div className="shrink-0">
          {!showAddForm ? (
            <button
              id="btn-open-add-bookmark"
              onClick={() => setShowAddForm(true)}
              className="w-full py-2.5 px-4 rounded-2xl bg-[#C5A059] hover:bg-[#d4af65] text-black font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#C5A059]/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Bookmark at {formatTime(currentTime)} ({currentTrack?.title || 'Current Track'})</span>
            </button>
          ) : (
            <form onSubmit={handleCreate} className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between text-xs text-white/70">
                <span className="font-semibold text-[#C5A059]">Timestamp: {formatTime(currentTime)}</span>
                <span className="text-[10px] text-white/40">{currentTrack?.title}</span>
              </div>
              <input
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Add optional note or reflection..."
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white outline-none focus:border-[#C5A059]"
                autoFocus
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-xl border border-white/10 text-xs text-white/60 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-[#C5A059] text-black font-semibold text-xs hover:bg-[#d4af65]"
                >
                  Save Bookmark
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Bookmarks List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
          {bookBookmarks.length === 0 ? (
            <div className="text-center py-12 space-y-2 text-white/40">
              <BookmarkIcon className="w-8 h-8 mx-auto opacity-30 stroke-1" />
              <p className="text-xs">No bookmarks saved yet for this book.</p>
              <p className="text-[10px] text-white/30">Tap above to mark meaningful quotes or resume points.</p>
            </div>
          ) : (
            bookBookmarks.map((bm) => (
              <div
                key={bm.id}
                className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all flex items-start justify-between gap-3 group"
              >
                <button
                  onClick={() => {
                    onJumpToBookmark(bm);
                    onClose();
                  }}
                  className="flex-1 text-left flex items-start gap-3 min-w-0"
                >
                  <div className="p-2 rounded-xl bg-[#C5A059]/10 text-[#C5A059] group-hover:bg-[#C5A059] group-hover:text-black transition-colors shrink-0 mt-0.5">
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#E8E8E8]">{formatTime(bm.timestamp)}</span>
                      <span className="text-[10px] text-white/40 truncate">{bm.trackTitle}</span>
                    </div>
                    {bm.note ? (
                      <p className="text-xs text-white/80 font-serif-display italic leading-relaxed">"{bm.note}"</p>
                    ) : (
                      <p className="text-[11px] text-white/40 italic">Saved listening point</p>
                    )}
                    <span className="text-[9px] text-white/30 font-mono block">
                      {new Date(bm.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => onDeleteBookmark(bm.id)}
                  className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-white/5 transition-colors shrink-0"
                  title="Delete Bookmark"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
