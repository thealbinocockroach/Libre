import { Audiobook, AudioTrack, AudioQualityPreference } from '../types';
export type { AudioQualityPreference };

export const STREAMING_QUALITY_KEY = 'libriaudio_streaming_quality';

export const QUALITY_CONFIGS: {
  id: AudioQualityPreference;
  name: string;
  bitrateLabel: string;
  badge: string;
  description: string;
}[] = [
  {
    id: '128k',
    name: 'High Quality',
    bitrateLabel: '128 kbps',
    badge: 'HQ Audio',
    description: 'Crisp narration & wider frequency response for broadband / Wi-Fi.',
  },
  {
    id: '64k',
    name: 'Data Saver',
    bitrateLabel: '64 kbps',
    badge: 'Standard',
    description: 'Fast buffering and low bandwidth usage. Classic LibriVox stream.',
  },
  {
    id: 'auto',
    name: 'Auto / Best',
    bitrateLabel: 'Adaptive',
    badge: 'Smart Stream',
    description: 'Streams the highest available audio quality for each recording.',
  },
];

/**
 * Retrieve saved streaming audio quality preference from localStorage
 */
export function getSavedQualityPreference(): AudioQualityPreference {
  try {
    const saved = localStorage.getItem(STREAMING_QUALITY_KEY);
    if (saved === '128k' || saved === '64k' || saved === 'auto') {
      return saved as AudioQualityPreference;
    }
  } catch {}
  return '128k';
}

/**
 * Save user streaming quality preference and broadcast change event
 */
export function saveQualityPreference(quality: AudioQualityPreference): void {
  try {
    localStorage.setItem(STREAMING_QUALITY_KEY, quality);
    window.dispatchEvent(
      new CustomEvent('libriaudio_quality_changed', {
        detail: { quality },
      })
    );
  } catch (err) {
    console.warn('Failed to save streaming quality preference:', err);
  }
}

/**
 * Detect quality tier from archive.org file metadata or filename
 */
export function detectQualityFromMetadata(
  filename: string,
  format?: string,
  bitrate?: string | number
): '128k' | '64k' | 'vbr' | 'standard' {
  const fLower = (filename || '').toLowerCase();
  const fmtLower = (format || '').toLowerCase();
  const bRate = typeof bitrate === 'number' ? bitrate : parseInt(String(bitrate || '0'), 10);

  if (fmtLower.includes('128kbps') || fLower.includes('128kb') || fLower.includes('128k.') || bRate === 128) {
    return '128k';
  }
  if (fmtLower.includes('64kbps') || fLower.includes('64kb') || fLower.includes('64k.') || bRate === 64) {
    return '64k';
  }
  if (fmtLower.includes('vbr') || fLower.includes('_vbr.mp3')) {
    return 'vbr';
  }
  if (fmtLower.includes('mp3') || fLower.endsWith('.mp3')) {
    // Check if filename has any other pattern
    if (/_128[k\.]/i.test(fLower)) return '128k';
    if (/_64[k\.]/i.test(fLower)) return '64k';
  }
  return 'standard';
}

/**
 * Extract canonical chapter or track sequence number
 */
export function extractSectionNumber(
  filename: string,
  title?: string,
  trackField?: string | number
): number {
  if (trackField !== undefined && trackField !== null) {
    const tNum = typeof trackField === 'number' ? trackField : parseInt(String(trackField).split('/')[0], 10);
    if (!isNaN(tNum) && tNum > 0) return tNum;
  }

  // Check filename e.g. "dracula_01_stoker_64kb.mp3" or "01_dracula.mp3"
  const nameMatch = filename.match(/(?:^|[_\-\s])(?:ch|chapter|sec|section|pt|part)?0*(\d{1,4})(?:[_\-\s.]|$)/i);
  if (nameMatch && nameMatch[1]) {
    const num = parseInt(nameMatch[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  // Check title e.g. "Chapter 01 - Letters", "Section 12"
  if (title) {
    const titleMatch = title.match(/(?:^|[_\-\s])(?:ch|chapter|sec|section|pt|part)?0*(\d{1,4})(?:[_\-\s:.]|$)/i);
    if (titleMatch && titleMatch[1]) {
      const num = parseInt(titleMatch[1], 10);
      if (!isNaN(num) && num > 0) return num;
    }
  }

  return 1;
}

/**
 * Clean chapter title by stripping technical bitrate flags and file extensions
 */
export function cleanTrackTitle(rawTitle: string | undefined, filename: string, sectionNum: number): string {
  if (rawTitle && rawTitle.trim() && !rawTitle.toLowerCase().endsWith('.mp3')) {
    return rawTitle
      .replace(/_(?:64|128)kb/gi, '')
      .replace(/_(?:vbr|160kb|320kb)/gi, '')
      .replace(/\[librivox\]/gi, '')
      .replace(/\.mp3$/i, '')
      .trim();
  }

  const base = filename
    .replace(/\.mp3$/i, '')
    .replace(/_(?:64|128)kb/gi, '')
    .replace(/_(?:vbr|160kb|320kb)/gi, '')
    .replace(/[_\-]+/g, ' ')
    .trim();

  if (base.length > 0 && !base.toLowerCase().startsWith('ia ')) {
    return base;
  }

  return `Chapter ${sectionNum}`;
}

export interface SegmentedTrackResult {
  availableQualities: string[];
  qualitySegments: { [qualityKey: string]: AudioTrack[] };
  deduplicatedTracks: AudioTrack[];
}

/**
 * Divide Internet Archive / LibriVox audio files into distinct quality segments,
 * preventing a 41-chapter book from inflating into 82 or 123 duplicate tracks.
 */
export function segmentAndDeduplicateArchiveFiles(
  files: any[],
  bookId: string,
  bookTitle: string,
  activePreference?: AudioQualityPreference
): SegmentedTrackResult {
  const pref = activePreference || getSavedQualityPreference();

  // Filter valid audio files (excluding zips, spectra, logs, metadata xmls)
  const audioFiles = files.filter((f) => {
    if (!f.name) return false;
    const lower = f.name.toLowerCase();
    const isAudio =
      lower.endsWith('.mp3') ||
      lower.endsWith('.ogg') ||
      (f.format && (f.format.includes('MP3') || f.format.includes('Vorbis')));
    const isExcluded =
      lower.includes('_spectrogram') ||
      lower.includes('_sample') ||
      lower.endsWith('.zip') ||
      lower.endsWith('_thumb.jpg') ||
      lower.endsWith('.torrent') ||
      lower.endsWith('.xml') ||
      lower.endsWith('.sqlite');
    return isAudio && !isExcluded;
  });

  if (audioFiles.length === 0) {
    const fallbackTrack: AudioTrack = {
      id: `${bookId}_tr_1`,
      title: `${bookTitle} - Chapter 1`,
      audioUrl: `https://archive.org/download/${bookId}/${bookId}_64kb.mp3`,
      durationSeconds: 1800,
      trackNumber: 1,
      quality: '64k',
      variants: {
        '64k': `https://archive.org/download/${bookId}/${bookId}_64kb.mp3`,
        '128k': `https://archive.org/download/${bookId}/${bookId}_128kb.mp3`,
      },
    };
    return {
      availableQualities: ['64k', '128k'],
      qualitySegments: {
        '64k': [fallbackTrack],
        '128k': [{ ...fallbackTrack, quality: '128k', audioUrl: `https://archive.org/download/${bookId}/${bookId}_128kb.mp3` }],
      },
      deduplicatedTracks: [fallbackTrack],
    };
  }

  // Map each file to a parsed item
  interface ParsedFile {
    file: any;
    filename: string;
    quality: '128k' | '64k' | 'vbr' | 'standard';
    sectionNum: number;
    title: string;
    duration: number;
    url: string;
  }

  const parsedItems: ParsedFile[] = audioFiles.map((file, idx) => {
    const filename = file.name || '';
    const quality = detectQualityFromMetadata(filename, file.format, file.bitrate);
    const sectionNum = extractSectionNumber(filename, file.title, file.track || idx + 1);
    const title = cleanTrackTitle(file.title, filename, sectionNum);
    const duration = Math.round(parseFloat(file.length || '0') || 1200);
    const url = `https://archive.org/download/${bookId}/${encodeURIComponent(filename).replace(/%2F/g, '/')}`;

    return {
      file,
      filename,
      quality,
      sectionNum,
      title,
      duration,
      url,
    };
  });

  // Collect distinct section numbers in numeric ascending order
  const sectionNumbers = Array.from(new Set(parsedItems.map((p) => p.sectionNum))).sort((a, b) => a - b);

  // Group items by quality tier
  const qualityTiersFound = Array.from(new Set(parsedItems.map((p) => p.quality)));

  // Build quality segments
  const qualitySegments: { [qualityKey: string]: AudioTrack[] } = {};

  // For each quality tier found, construct the complete sequential chapter list
  qualityTiersFound.forEach((tier) => {
    const tierItems = parsedItems.filter((p) => p.quality === tier);
    // Map section numbers to track
    const tracksForTier: AudioTrack[] = sectionNumbers.map((secNum, seqIdx) => {
      const match = tierItems.find((p) => p.sectionNum === secNum) || tierItems[seqIdx] || parsedItems.find((p) => p.sectionNum === secNum) || parsedItems[0];
      const allMatchesForSec = parsedItems.filter((p) => p.sectionNum === secNum);
      
      const variants: { [k: string]: string } = {};
      allMatchesForSec.forEach((m) => {
        variants[m.quality] = m.url;
      });

      return {
        id: `${bookId}_ch_${secNum}`,
        title: match.title,
        audioUrl: match.url,
        durationSeconds: match.duration,
        trackNumber: seqIdx + 1,
        sectionNumber: secNum,
        quality: tier,
        variants,
      };
    });

    qualitySegments[tier] = tracksForTier;
  });

  // Determine available quality list
  const availableQualities: string[] = [];
  if (qualitySegments['128k']) availableQualities.push('128k');
  if (qualitySegments['64k']) availableQualities.push('64k');
  if (qualitySegments['vbr']) availableQualities.push('vbr');
  if (qualitySegments['standard'] && availableQualities.length === 0) availableQualities.push('standard');

  // Select preferred active quality
  let chosenTier: string = '64k';
  if (pref === '128k') {
    chosenTier = qualitySegments['128k'] ? '128k' : availableQualities[0] || '64k';
  } else if (pref === '64k') {
    chosenTier = qualitySegments['64k'] ? '64k' : availableQualities[0] || '128k';
  } else if (pref === 'auto') {
    chosenTier = qualitySegments['128k'] ? '128k' : qualitySegments['64k'] ? '64k' : availableQualities[0] || 'standard';
  }

  const deduplicatedTracks = qualitySegments[chosenTier] || Object.values(qualitySegments)[0] || [];

  return {
    availableQualities: availableQualities.length > 0 ? availableQualities : ['64k'],
    qualitySegments,
    deduplicatedTracks,
  };
}

/**
 * Apply the user's streaming quality preference to an Audiobook,
 * updating track URLs seamlessly while retaining playback state.
 */
export function applyQualityToAudiobook(
  book: Audiobook,
  preferredQuality?: AudioQualityPreference
): Audiobook {
  const pref = preferredQuality || getSavedQualityPreference();

  // If book has qualitySegments, pick the matching quality segment
  if (book.qualitySegments && Object.keys(book.qualitySegments).length > 0) {
    let targetTier = '64k';
    if (pref === '128k' && book.qualitySegments['128k']) {
      targetTier = '128k';
    } else if (pref === '64k' && book.qualitySegments['64k']) {
      targetTier = '64k';
    } else if (pref === 'auto') {
      targetTier = book.qualitySegments['128k'] ? '128k' : book.qualitySegments['64k'] ? '64k' : Object.keys(book.qualitySegments)[0];
    } else {
      targetTier = book.qualitySegments[pref] ? pref : Object.keys(book.qualitySegments)[0];
    }

    const newTracks = book.qualitySegments[targetTier];
    if (newTracks && newTracks.length > 0) {
      return {
        ...book,
        selectedQuality: targetTier,
        tracks: newTracks,
        totalTimeSecs: newTracks.reduce((acc, t) => acc + (t.durationSeconds || 0), 0) || book.totalTimeSecs,
      };
    }
  }

  // If tracks have variants attached, update audioUrls to the matching variant
  if (book.tracks && book.tracks.length > 0) {
    const updatedTracks = book.tracks.map((track) => {
      if (track.variants) {
        let chosenUrl = track.audioUrl;
        let activeQ = track.quality || 'standard';

        if (pref === '128k' && track.variants['128k']) {
          chosenUrl = track.variants['128k'];
          activeQ = '128k';
        } else if (pref === '64k' && track.variants['64k']) {
          chosenUrl = track.variants['64k'];
          activeQ = '64k';
        } else if (pref === 'auto') {
          if (track.variants['128k']) {
            chosenUrl = track.variants['128k'];
            activeQ = '128k';
          } else if (track.variants['64k']) {
            chosenUrl = track.variants['64k'];
            activeQ = '64k';
          }
        }

        return {
          ...track,
          audioUrl: chosenUrl,
          quality: activeQ,
        };
      }
      return track;
    });

    return {
      ...book,
      selectedQuality: pref,
      tracks: updatedTracks,
    };
  }

  return book;
}
