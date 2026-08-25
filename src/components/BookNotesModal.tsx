import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FileText,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Check,
  Download,
  Search,
  Tag,
  Clock,
  Play,
  Share2,
  Sparkles,
  Bookmark,
  CheckCircle2,
} from 'lucide-react';
import { Audiobook, BookNote, NoteColor } from '../types';
import {
  getNotesForBook,
  saveBookNote,
  deleteBookNote,
  exportBookNotesAsMarkdown,
} from '../utils/notesStorage';

interface BookNotesModalProps {
  isOpen: boolean;
  book: Audiobook | null;
  currentTrackTitle?: string;
  currentTrackIndex?: number;
  currentTime?: number;
  onClose: () => void;
  onSeekToTime?: (trackIndex: number, seconds: number) => void;
}

const NOTE_COLORS: { id: NoteColor; name: string; bg: string; border: string; text: string; dot: string }[] = [
  { id: 'gold', name: 'Gold', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-400' },
  { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  { id: 'sapphire', name: 'Sapphire', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-400' },
  { id: 'amethyst', name: 'Amethyst', bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', dot: 'bg-purple-400' },
  { id: 'rose', name: 'Rose', bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400', dot: 'bg-rose-400' },
  { id: 'default', name: 'Slate', bg: 'bg-[var(--surface-raised)]', border: 'border-[var(--border-subtle)]', text: 'text-[var(--text-main)]', dot: 'bg-[var(--surface-raised)]' },
];

const PRESET_TAGS = ['Quote', 'Key Idea', 'Character', 'Reflection', 'Plot', 'Favorite'];

export const BookNotesModal: React.FC<BookNotesModalProps> = ({
  isOpen,
  book,
  currentTrackTitle,
  currentTrackIndex,
  currentTime,
  onClose,
  onSeekToTime,
}) => {
  const [notes, setNotes] = useState<BookNote[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formColor, setFormColor] = useState<NoteColor>('gold');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [includeTimestamp, setIncludeTimestamp] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
  const [exportCopied, setExportCopied] = useState(false);

  const loadNotes = () => {
    if (!book) return;
    setNotes(getNotesForBook(book.id));
  };

  useEffect(() => {
    if (isOpen && book) {
      loadNotes();
    }
  }, [isOpen, book?.id]);

  // Listen for background updates
  useEffect(() => {
    const handleUpdate = () => {
      loadNotes();
    };
    window.addEventListener('libriaudio_notes_updated', handleUpdate);
    return () => window.removeEventListener('libriaudio_notes_updated', handleUpdate);
  }, [book?.id]);

  // Filtered Notes
  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (note.tags && note.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

      const matchesTag =
        !selectedTagFilter || (note.tags && note.tags.includes(selectedTagFilter));

      return matchesSearch && matchesTag;
    });
  }, [notes, searchQuery, selectedTagFilter]);

  // Extract all unique tags across all notes
  const allUniqueTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => n.tags?.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [notes]);

  if (!isOpen || !book) return null;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = Math.floor(secs % 60);
    if (hours > 0) {
      return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleOpenCreateForm = () => {
    setEditingNoteId(null);
    setFormTitle('');
    setFormContent('');
    setFormColor('gold');
    setFormTags([]);
    setCustomTagInput('');
    setIncludeTimestamp(currentTime !== undefined && currentTime > 0);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (note: BookNote) => {
    setEditingNoteId(note.id);
    setFormTitle(note.title || '');
    setFormContent(note.content || '');
    setFormColor(note.color || 'gold');
    setFormTags(note.tags || []);
    setCustomTagInput('');
    setIncludeTimestamp(note.timestamp !== undefined);
    setIsFormOpen(true);
  };

  const handleToggleTag = (tag: string) => {
    if (formTags.includes(tag)) {
      setFormTags(formTags.filter((t) => t !== tag));
    } else {
      setFormTags([...formTags, tag]);
    }
  };

  const handleAddCustomTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && customTagInput.trim()) {
      e.preventDefault();
      const cleanTag = customTagInput.trim().replace(/^#/, '');
      if (cleanTag && !formTags.includes(cleanTag)) {
        setFormTags([...formTags, cleanTag]);
      }
      setCustomTagInput('');
    }
  };

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formContent.trim()) return;

    const notePayload = {
      id: editingNoteId || undefined,
      bookId: book.id,
      bookTitle: book.title,
      author: book.author,
      title: formTitle.trim() || (includeTimestamp && currentTime !== undefined ? `Note at ${formatTime(currentTime)}` : 'Book Reflection'),
      content: formContent.trim(),
      color: formColor,
      tags: formTags,
      trackIndex: includeTimestamp ? (editingNoteId ? notes.find(n => n.id === editingNoteId)?.trackIndex : currentTrackIndex) : undefined,
      trackTitle: includeTimestamp ? (editingNoteId ? notes.find(n => n.id === editingNoteId)?.trackTitle : currentTrackTitle) : undefined,
      timestamp: includeTimestamp ? (editingNoteId ? notes.find(n => n.id === editingNoteId)?.timestamp : currentTime) : undefined,
    };

    saveBookNote(notePayload);
    loadNotes();
    setIsFormOpen(false);
  };

  const handleDeleteNote = (noteId: string) => {
    deleteBookNote(noteId);
    loadNotes();
  };

  const handleCopyNote = (note: BookNote) => {
    const text = `${note.title}\n\n${note.content}\n\n— From "${book.title}" by ${book.author}`;
    navigator.clipboard.writeText(text);
    setCopiedNoteId(note.id);
    setTimeout(() => setCopiedNoteId(null), 2000);
  };

  const handleExportMarkdown = () => {
    if (notes.length === 0) return;
    const md = exportBookNotesAsMarkdown(book.title, notes);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${book.title.replace(/[^a-zA-Z0-9]/g, '_')}_reading_notes.md`;
    a.click();
    URL.revokeObjectURL(url);
    setExportCopied(true);
    setTimeout(() => setExportCopied(false), 2500);
  };

  return (
    <div
      id="book-notes-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="book-notes-modal"
        className="relative w-full max-w-2xl bg-[var(--surface)] border border-[var(--border-subtle)] rounded-3xl p-5 sm:p-7 text-[var(--text-main)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background ambient gold glow */}
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-[var(--accent-dim)] rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="relative flex items-center justify-between border-b border-[var(--border-subtle)] pb-4 shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)] shadow-inner shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-serif-display italic font-semibold text-[var(--text-main)] tracking-wide truncate">
                  Book Notes & Reflections
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)] shrink-0">
                  {notes.length} {notes.length === 1 ? 'note' : 'notes'}
                </span>
              </div>
              <p className="text-xs text-[var(--text-dim)] truncate max-w-sm">
                {book.title} • {book.author}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {notes.length > 0 && (
              <button
                id="btn-export-notes-markdown"
                onClick={handleExportMarkdown}
                className="p-2 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--surface-raised)] text-[var(--text-main)] hover:text-[var(--accent)] border border-[var(--border-subtle)] text-xs font-semibold flex items-center gap-1.5 transition-all"
                title="Export Notes as Markdown"
              >
                {exportCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Download className="w-4 h-4" />}
                <span className="hidden sm:inline">{exportCopied ? 'Exported!' : 'Export MD'}</span>
              </button>
            )}
            <button
              id="btn-close-notes-modal"
              onClick={onClose}
              className="p-2 rounded-full text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--surface-raised)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action / Search Bar */}
        <div className="relative flex flex-wrap items-center justify-between gap-2.5 shrink-0 z-10">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reflections, quotes, tags..."
              className="w-full pl-9.5 pr-4 py-2 rounded-xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-xs text-[var(--text-main)] placeholder-white/40 outline-none focus:border-[var(--accent)] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text-main)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* New Note Button */}
          {!isFormOpen && (
            <button
              id="btn-add-new-note"
              onClick={handleOpenCreateForm}
              className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-[rgba(var(--accent-rgb),0.3)] transition-all transform active:scale-95 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Take Note</span>
            </button>
          )}
        </div>

        {/* Tag Filters Bar (if tags exist) */}
        {allUniqueTags.length > 0 && !isFormOpen && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 scrollbar-none">
            <button
              onClick={() => setSelectedTagFilter(null)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all shrink-0 ${
                selectedTagFilter === null
                  ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                  : 'bg-[var(--surface-raised)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-main)]'
              }`}
            >
              All Tags
            </button>
            {allUniqueTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTagFilter(selectedTagFilter === tag ? null : tag)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all shrink-0 flex items-center gap-1 ${
                  selectedTagFilter === tag
                    ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                    : 'bg-[var(--surface-raised)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-main)]'
                }`}
              >
                <Tag className="w-3 h-3" />
                <span>#{tag}</span>
              </button>
            ))}
          </div>
        )}

        {/* Create / Edit Note Form */}
        {isFormOpen && (
          <form
            onSubmit={handleSaveNote}
            className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] space-y-4 shrink-0 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                {editingNoteId ? 'Edit Note' : 'New Book Note'}
              </span>
              <div className="flex items-center gap-2">
                {/* Color Selector */}
                <div className="flex items-center gap-1">
                  {NOTE_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setFormColor(c.id)}
                      className={`w-5 h-5 rounded-full ${c.dot} transition-transform ${
                        formColor === c.id ? 'scale-125 ring-2 ring-white shadow-md' : 'opacity-60 hover:opacity-100'
                      }`}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Note Title */}
            <div>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Note title (e.g. Chapter 1 Quote, Reflection on Ahab...)"
                className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-[var(--border-subtle)] text-xs text-[var(--text-main)] placeholder-white/35 outline-none focus:border-[var(--accent)]"
                autoFocus
              />
            </div>

            {/* Note Content */}
            <div>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Write your thoughts, reflections, favorite quotes, or chapter takeaways..."
                rows={4}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-[var(--border-subtle)] text-xs text-[var(--text-main)] placeholder-white/35 outline-none focus:border-[var(--accent)] leading-relaxed resize-none"
              />
            </div>

            {/* Timestamp Option & Tags */}
            <div className="space-y-2">
              {currentTime !== undefined && currentTime > 0 && (
                <label className="flex items-center gap-2 text-xs text-[var(--text-main)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeTimestamp}
                    onChange={(e) => setIncludeTimestamp(e.target.checked)}
                    className="accent-[#C5A059] rounded"
                  />
                  <Clock className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>
                    Attach Audio Timestamp: <strong>{formatTime(currentTime)}</strong> ({currentTrackTitle || 'Current Track'})
                  </span>
                </label>
              )}

              {/* Tag Quick Select */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-[var(--text-dim)] mr-1 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Tags:
                </span>
                {PRESET_TAGS.map((t) => {
                  const active = formTags.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleToggleTag(t)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition-all ${
                        active
                          ? 'bg-[var(--accent-dim)] border-[var(--accent)] text-[var(--accent)]'
                          : 'bg-[var(--surface-raised)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      +{t}
                    </button>
                  );
                })}
                <input
                  type="text"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyDown={handleAddCustomTag}
                  placeholder="custom tag + Enter"
                  className="px-2 py-0.5 rounded-md bg-black/30 border border-[var(--border-subtle)] text-[10px] text-[var(--text-main)] placeholder-white/30 outline-none w-28 focus:border-[var(--accent)]"
                />
              </div>
            </div>

            {/* Form Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-3.5 py-1.5 rounded-xl border border-[var(--border-subtle)] text-xs text-[var(--text-dim)] hover:text-[var(--text-main)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!formContent.trim()}
                className="px-5 py-1.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-black font-semibold text-xs transition-all shadow-md cursor-pointer"
              >
                {editingNoteId ? 'Update Note' : 'Save Reflection'}
              </button>
            </div>
          </form>
        )}

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-white/10">
          {filteredNotes.length === 0 ? (
            <div className="text-center py-14 space-y-3 text-[var(--text-dim)]">
              <div className="w-12 h-12 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto text-[var(--accent)]">
                <FileText className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--text-main)]">No reflections saved yet</p>
                <p className="text-xs text-[var(--text-dim)] max-w-sm mx-auto leading-relaxed">
                  Capture memorable quotes, character motives, plot insights, or personal reflections while listening.
                </p>
              </div>
              {!isFormOpen && (
                <button
                  onClick={handleOpenCreateForm}
                  className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black font-semibold text-xs inline-flex items-center gap-1.5 hover:bg-[var(--accent-hover)] transition-all shadow-lg"
                >
                  <Plus className="w-4 h-4" />
                  <span>Write First Note</span>
                </button>
              )}
            </div>
          ) : (
            filteredNotes.map((note) => {
              const colorDef = NOTE_COLORS.find((c) => c.id === note.color) || NOTE_COLORS[0];
              return (
                <div
                  key={note.id}
                  id={`note-card-${note.id}`}
                  className={`p-4 rounded-2xl border ${colorDef.bg} ${colorDef.border} space-y-2.5 transition-all hover:border-[var(--accent)] group`}
                >
                  {/* Note Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${colorDef.dot} shrink-0`} />
                        <h4 className="text-xs font-semibold text-[var(--text-main)] tracking-wide truncate">
                          {note.title}
                        </h4>
                      </div>

                      {/* Timestamp & Location */}
                      {(note.timestamp !== undefined || note.trackTitle) && (
                        <div className="flex items-center gap-2 text-[11px] text-[var(--accent)] font-mono">
                          {note.timestamp !== undefined && (
                            <button
                              onClick={() => onSeekToTime && onSeekToTime(note.trackIndex || 0, note.timestamp || 0)}
                              className="hover:underline flex items-center gap-1 font-semibold"
                              title="Jump to audio point"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>{formatTime(note.timestamp)}</span>
                            </button>
                          )}
                          {note.trackTitle && (
                            <span className="text-[var(--text-dim)] truncate max-w-[200px]">
                              • {note.trackTitle}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleCopyNote(note)}
                        className="p-1.5 rounded-lg hover:bg-[var(--surface-raised)] text-[var(--text-dim)] hover:text-[var(--text-main)] transition-colors"
                        title="Copy note text"
                      >
                        {copiedNoteId === note.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleOpenEditForm(note)}
                        className="p-1.5 rounded-lg hover:bg-[var(--surface-raised)] text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
                        title="Edit note"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="p-1.5 rounded-lg hover:bg-[var(--surface-raised)] text-[var(--text-dim)] hover:text-rose-400 transition-colors"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Note Body */}
                  <p className="text-xs text-[var(--text-main)] leading-relaxed whitespace-pre-wrap">
                    {note.content}
                  </p>

                  {/* Note Tags & Date */}
                  <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-dim)]">
                    <div className="flex flex-wrap items-center gap-1">
                      {note.tags?.map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.5 rounded bg-[var(--surface-raised)] text-[var(--text-main)] font-mono text-[9px]"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                    <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
