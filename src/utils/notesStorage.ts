import { BookNote } from '../types';

const STORAGE_KEY = 'libriaudio_book_notes_v1';

export function getAllBookNotes(): BookNote[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const notes: BookNote[] = JSON.parse(raw);
    return Array.isArray(notes) ? notes.sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch (err) {
    console.warn('Failed to load notes from localStorage', err);
    return [];
  }
}

export function getNotesForBook(bookId: string): BookNote[] {
  return getAllBookNotes().filter((n) => n.bookId === bookId);
}

export function saveBookNote(
  noteData: Omit<BookNote, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: string;
    createdAt?: number;
    updatedAt?: number;
  }
): BookNote {
  const allNotes = getAllBookNotes();
  const now = Date.now();

  let finalNote: BookNote;

  if (noteData.id) {
    const existingIndex = allNotes.findIndex((n) => n.id === noteData.id);
    if (existingIndex >= 0) {
      finalNote = {
        ...allNotes[existingIndex],
        ...noteData,
        id: noteData.id,
        updatedAt: now,
      };
      allNotes[existingIndex] = finalNote;
    } else {
      finalNote = {
        ...noteData,
        id: noteData.id,
        createdAt: noteData.createdAt || now,
        updatedAt: now,
      } as BookNote;
      allNotes.unshift(finalNote);
    }
  } else {
    finalNote = {
      ...noteData,
      id: `note_${now}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    } as BookNote;
    allNotes.unshift(finalNote);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allNotes));
    window.dispatchEvent(new CustomEvent('libriaudio_notes_updated', { detail: finalNote }));
  } catch (err) {
    console.warn('Failed to persist notes to localStorage', err);
  }

  return finalNote;
}

export function deleteBookNote(noteId: string): void {
  const allNotes = getAllBookNotes();
  const filtered = allNotes.filter((n) => n.id !== noteId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent('libriaudio_notes_updated', { detail: { deletedId: noteId } }));
  } catch (err) {
    console.warn('Failed to delete note from localStorage', err);
  }
}

export function exportBookNotesAsMarkdown(
  bookTitleOrNotes: string | BookNote[],
  maybeNotes?: BookNote[]
): string {
  let title = 'My Audiobooks Library';
  let notes: BookNote[] = [];

  if (typeof bookTitleOrNotes === 'string') {
    title = bookTitleOrNotes;
    notes = maybeNotes || [];
  } else if (Array.isArray(bookTitleOrNotes)) {
    notes = bookTitleOrNotes;
    if (notes.length > 0 && notes[0].bookTitle) {
      title = notes[0].bookTitle;
    }
  }

  let md = `# Reading Notes & Reflections: ${title}\n`;
  md += `*Exported from LibriAudio on ${new Date().toLocaleDateString()}*\n\n---\n\n`;

  notes.forEach((n, idx) => {
    md += `### ${idx + 1}. ${n.title || 'Untitled Note'} (${n.bookTitle})\n`;
    if (n.trackTitle || n.timestamp !== undefined) {
      const timeStr = n.timestamp !== undefined ? formatNoteTime(n.timestamp) : '';
      md += `*Audio Location: ${n.trackTitle || 'Track'} ${timeStr ? `(${timeStr})` : ''}*\n\n`;
    }
    if (n.tags && n.tags.length > 0) {
      md += `*Tags:* ${n.tags.map((t) => `#${t}`).join(' ')}\n\n`;
    }
    md += `${n.content}\n\n`;
    md += `*Saved: ${new Date(n.createdAt).toLocaleString()}*\n\n---\n\n`;
  });

  return md;
}

function formatNoteTime(secs: number): string {
  if (isNaN(secs) || secs < 0) return '0:00';
  const mins = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${mins}:${s < 10 ? '0' : ''}${s}`;
}
