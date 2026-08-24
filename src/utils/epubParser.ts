import JSZip from 'jszip';
import { Audiobook, EbookChapter } from '../types';

/**
 * Splits raw Gutenberg or plain/HTML text into organized chapters.
 */
export function splitManuscriptIntoChapters(rawContent: string, bookTitle: string): EbookChapter[] {
  if (!rawContent || !rawContent.trim()) {
    return [{ id: 'ch_1', title: bookTitle || 'Chapter 1', content: '<p>Manuscript text ready.</p>' }];
  }

  // 1. Strip Project Gutenberg header / footer if present
  let clean = rawContent;
  const startGutenbergMarker = clean.search(/\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\*]*\*\*\*/i);
  if (startGutenbergMarker !== -1) {
    const afterMarker = clean.indexOf('\n', startGutenbergMarker);
    if (afterMarker !== -1) {
      clean = clean.substring(afterMarker).trim();
    }
  }
  const endGutenbergMarker = clean.search(/\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i);
  if (endGutenbergMarker !== -1) {
    clean = clean.substring(0, endGutenbergMarker).trim();
  }

  // Strip script and style tags for safety
  clean = clean
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<\?xml[^>]*\?>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '');

  const isHtml = clean.includes('<p>') || clean.includes('</div>') || clean.includes('<h1') || clean.includes('<h2') || clean.includes('<h3');

  const chapters: EbookChapter[] = [];

  if (isHtml) {
    // If HTML has headings, split on <h1..>, <h2..>, <h3..>
    const headingSplitRegex = /(?=<h[1-3][^>]*>|<div[^>]+class=["'][^"']*chapter[^"']*["'])/gi;
    const rawParts = clean.split(headingSplitRegex).filter((p) => p.trim().length > 50);

    if (rawParts.length > 1) {
      rawParts.forEach((part, idx) => {
        const hMatch = part.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
        const rawTitle = hMatch ? hMatch[1].replace(/<[^>]*>/g, '').trim() : '';
        const title = rawTitle || `Chapter ${idx + 1}`;
        chapters.push({
          id: `ch_${idx + 1}`,
          title,
          content: part,
        });
      });
    }
  }

  // If text or single HTML chunk, check for chapter patterns in text
  if (chapters.length <= 1) {
    const plainText = isHtml
      ? clean.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]*>/g, ' ')
      : clean;

    const chapterMarkerRegex = /\n\s*(?:CHAPTER|Chapter|Book|BOOK|ACT|Act|SCENE|Scene|SECTION|Section|Part|PART|Letter|LETTER)\s+([0-9IVXLCDM]+(?:[.:\s–-]+[^\n]+)?)/g;

    const matches: { index: number; title: string }[] = [];
    let match: RegExpExecArray | null;
    while ((match = chapterMarkerRegex.exec(plainText)) !== null) {
      const line = match[0].trim();
      if (line.length < 90) {
        matches.push({ index: match.index, title: line });
      }
    }

    if (matches.length > 1) {
      for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index;
        const end = i < matches.length - 1 ? matches[i + 1].index : plainText.length;
        const chunk = plainText.substring(start, end).trim();
        const paragraphs = chunk
          .split(/\n\s*\n/)
          .filter((p) => p.trim().length > 0)
          .map((p) => `<p>${p.trim().replace(/\n/g, '<br/>')}</p>`)
          .join('');

        chapters.push({
          id: `ch_${i + 1}`,
          title: matches[i].title,
          content: paragraphs || `<p>${chunk}</p>`,
        });
      }
    }
  }

  // Fallback: If still single block and lengthy, split into readable sections (~3000 words each)
  if (chapters.length <= 1) {
    const formatted = isHtml
      ? clean
      : clean
          .split(/\n\s*\n/)
          .filter(Boolean)
          .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
          .join('');

    if (formatted.length > 25000) {
      const pTags = formatted.split(/(?=<p>)/i);
      const chunkSize = Math.max(8, Math.ceil(pTags.length / Math.min(20, Math.ceil(formatted.length / 15000))));
      let secIndex = 1;
      for (let i = 0; i < pTags.length; i += chunkSize) {
        const slice = pTags.slice(i, i + chunkSize).join('');
        if (slice.trim().length > 50) {
          chapters.push({
            id: `sec_${secIndex}`,
            title: `Section ${secIndex}`,
            content: slice,
          });
          secIndex++;
        }
      }
    } else {
      chapters.push({
        id: 'ch_1',
        title: bookTitle || 'Complete Text',
        content: formatted || `<p>${clean}</p>`,
      });
    }
  }

  return chapters;
}

export async function parseUploadedEpub(file: File): Promise<Audiobook> {
  const fileName = file.name.toLowerCase();

  // Support plain text or HTML files directly
  if (fileName.endsWith('.txt') || fileName.endsWith('.html') || fileName.endsWith('.htm') || fileName.endsWith('.md')) {
    const text = await file.text();
    const title = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    const chapters = splitManuscriptIntoChapters(text, title);

    const bookId = `custom_${Date.now()}`;
    return {
      id: bookId,
      title,
      author: 'Uploaded Document',
      description: `Uploaded manuscript: ${title} (${chapters.length} chapter${chapters.length > 1 ? 's' : ''}).`,
      coverImageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80',
      language: 'English',
      totalTimeSecs: chapters.length * 600,
      reader: 'EPUB / AI Voice Reader',
      tracks: chapters.map((ch, idx) => ({
        id: `${bookId}_tr_${idx + 1}`,
        title: ch.title,
        audioUrl: 'https://archive.org/download/librivox_audio_collection/placeholder.mp3',
        durationSeconds: 600,
        trackNumber: idx + 1,
      })),
      ebookChapters: chapters,
    };
  }

  // Parse EPUB archive via JSZip
  const zip = new JSZip();
  const zipContent = await zip.loadAsync(file);

  // 1. Locate container.xml to find OPF path
  let opfPath = '';
  const containerFile =
    zipContent.file('META-INF/container.xml') ||
    zipContent.file('meta-inf/container.xml') ||
    zipContent.file('META-INF/Container.xml');

  if (containerFile) {
    const containerXmlText = await containerFile.async('text');
    const opfPathMatch = containerXmlText.match(/full-path="([^"]+)"/i);
    if (opfPathMatch && opfPathMatch[1]) {
      opfPath = opfPathMatch[1].trim();
    }
  }

  // Fallback: look for any .opf file in the zip
  if (!opfPath) {
    const anyOpf = Object.keys(zipContent.files).find((p) => p.toLowerCase().endsWith('.opf'));
    if (anyOpf) opfPath = anyOpf;
  }

  if (!opfPath) {
    throw new Error('Invalid EPUB file: No OPF package manifest found.');
  }

  const opfFolder = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
  const opfFile = zipContent.file(opfPath);
  if (!opfFile) {
    throw new Error(`OPF manifest file not found in package at ${opfPath}`);
  }

  const opfText = await opfFile.async('text');

  // Extract title and author
  const titleMatch = opfText.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
  const authorMatch = opfText.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);

  const rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
  const rawAuthor = authorMatch ? authorMatch[1].replace(/<[^>]*>/g, '').trim() : '';

  const title = rawTitle || file.name.replace(/\.epub$/i, '').replace(/[-_]/g, ' ');
  const author = rawAuthor || 'Custom Author';

  // Extract manifest items
  const manifestItems: Record<string, string> = {};
  const imageItemUrls: Record<string, string> = {};
  let coverHref = '';
  let tocNcxHref = '';

  const itemRegex = /<item\s+([^>]+)>/gi;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemRegex.exec(opfText)) !== null) {
    const attrs = itemMatch[1];
    const idMatch = attrs.match(/id="([^"]+)"/i);
    const hrefMatch = attrs.match(/href="([^"]+)"/i);
    const mediaMatch = attrs.match(/media-type="([^"]+)"/i);
    if (idMatch && hrefMatch) {
      const id = idMatch[1];
      const href = hrefMatch[1];
      manifestItems[id] = href;

      const mediaType = mediaMatch ? mediaMatch[1].toLowerCase() : '';
      if (mediaType.includes('ncx') || id.toLowerCase().includes('ncx') || href.endsWith('.ncx')) {
        tocNcxHref = href;
      }

      if (
        mediaType.startsWith('image/') ||
        href.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i)
      ) {
        if (id.toLowerCase().includes('cover') || attrs.toLowerCase().includes('cover')) {
          coverHref = href;
        }
      }
    }
  }

  // Pre-generate object URLs for images in EPUB so illustrations work
  for (const [, href] of Object.entries(manifestItems)) {
    if (href.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i)) {
      try {
        const fullImgPath = opfFolder + href;
        const imgFile =
          zipContent.file(fullImgPath) ||
          zipContent.file(href) ||
          zipContent.file(decodeURIComponent(fullImgPath));
        if (imgFile) {
          const blob = await imgFile.async('blob');
          if (blob.size > 0) {
            const objUrl = URL.createObjectURL(blob);
            imageItemUrls[href] = objUrl;
            imageItemUrls[fullImgPath] = objUrl;
            // Also store just the file name
            const bareName = href.substring(href.lastIndexOf('/') + 1);
            imageItemUrls[bareName] = objUrl;
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // Attempt to extract cover image
  let coverImageUrl = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80';
  if (coverHref && imageItemUrls[coverHref]) {
    coverImageUrl = imageItemUrls[coverHref];
  } else if (coverHref) {
    try {
      const coverFile =
        zipContent.file(opfFolder + coverHref) ||
        zipContent.file(coverHref) ||
        zipContent.file(decodeURIComponent(opfFolder + coverHref));
      if (coverFile) {
        const coverBlob = await coverFile.async('blob');
        if (coverBlob.size > 0) {
          coverImageUrl = URL.createObjectURL(coverBlob);
        }
      }
    } catch {
      // Fallback
    }
  }

  // Parse Table of Contents from toc.ncx if available
  const ncxTitles: Record<string, string> = {};
  if (tocNcxHref) {
    try {
      const ncxFile =
        zipContent.file(opfFolder + tocNcxHref) ||
        zipContent.file(tocNcxHref) ||
        zipContent.file(decodeURIComponent(opfFolder + tocNcxHref));
      if (ncxFile) {
        const ncxText = await ncxFile.async('text');
        const navPointRegex = /<navPoint[^>]*>[\s\S]*?<navLabel>\s*<text>([\s\S]*?)<\/text>\s*<\/navLabel>\s*<content\s+src="([^"#]+)(?:#[^"]*)?"[\s\S]*?<\/navPoint>/gi;
        let npMatch: RegExpExecArray | null;
        while ((npMatch = navPointRegex.exec(ncxText)) !== null) {
          const navTitle = npMatch[1].replace(/<[^>]*>/g, '').trim();
          const navSrc = npMatch[2].trim();
          if (navTitle && navSrc) {
            ncxTitles[navSrc] = navTitle;
            const bareSrc = navSrc.substring(navSrc.lastIndexOf('/') + 1);
            ncxTitles[bareSrc] = navTitle;
          }
        }
      }
    } catch {
      // NCX parse failed, fall back to heading extraction
    }
  }

  // Extract spine itemrefs
  const spineIds: string[] = [];
  const spineRegex = /<itemref\s+idref="([^"]+)"/gi;
  let spineMatch: RegExpExecArray | null;
  while ((spineMatch = spineRegex.exec(opfText)) !== null) {
    spineIds.push(spineMatch[1]);
  }

  const chapters: EbookChapter[] = [];
  let trackIndex = 1;

  for (const idref of spineIds) {
    const relativeHref = manifestItems[idref];
    if (!relativeHref) continue;

    const fullItemPath = opfFolder + relativeHref;
    const chapterFile =
      zipContent.file(fullItemPath) ||
      zipContent.file(relativeHref) ||
      zipContent.file(decodeURIComponent(fullItemPath));

    if (chapterFile) {
      let chapterHtml = await chapterFile.async('text');

      // Strip dangerous tags and xml headers
      chapterHtml = chapterHtml
        .replace(/<\?xml[^>]*\?>/gi, '')
        .replace(/<!DOCTYPE[^>]*>/gi, '')
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

      try {
        const domParser = new DOMParser();
        const doc = domParser.parseFromString(chapterHtml, 'text/html');

        // Resolve img src
        const imgs = doc.querySelectorAll('img');
        imgs.forEach((img) => {
          const rawSrc = img.getAttribute('src') || '';
          if (rawSrc) {
            const cleanKey = rawSrc.replace(/^(\.\/|\.\.\/)+/, '');
            const bareName = rawSrc.substring(rawSrc.lastIndexOf('/') + 1);
            const resolved =
              imageItemUrls[rawSrc] ||
              imageItemUrls[cleanKey] ||
              imageItemUrls[bareName] ||
              imageItemUrls[opfFolder + cleanKey];
            if (resolved) {
              img.setAttribute('src', resolved);
            }
          }
          img.classList.add('libriaudio-reader-img');
          img.setAttribute('loading', 'lazy');
          img.setAttribute('decoding', 'async');
        });

        // Resolve svg image tags
        const svgImages = doc.querySelectorAll('image');
        svgImages.forEach((sImg) => {
          const rawHref =
            sImg.getAttribute('xlink:href') ||
            sImg.getAttribute('href') ||
            '';
          if (rawHref) {
            const cleanKey = rawHref.replace(/^(\.\/|\.\.\/)+/, '');
            const bareName = rawHref.substring(rawHref.lastIndexOf('/') + 1);
            const resolved =
              imageItemUrls[rawHref] ||
              imageItemUrls[cleanKey] ||
              imageItemUrls[bareName] ||
              imageItemUrls[opfFolder + cleanKey];
            if (resolved) {
              sImg.setAttribute('xlink:href', resolved);
              sImg.setAttribute('href', resolved);
            }
          }
        });

        // Extract chapter title from NCX, <h1>-<h3>, or fallback
        const bodyContent = doc.body ? doc.body.innerHTML : chapterHtml;
        const bareFileName = relativeHref.substring(relativeHref.lastIndexOf('/') + 1);
        let chapterTitle = ncxTitles[relativeHref] || ncxTitles[bareFileName] || '';

        if (!chapterTitle) {
          const heading = doc.querySelector('h1, h2, h3');
          if (heading && heading.textContent) {
            chapterTitle = heading.textContent.trim();
          }
        }

        if (!chapterTitle || chapterTitle.length > 80) {
          chapterTitle = `Chapter ${trackIndex}`;
        }

        if (bodyContent.trim().length > 20) {
          chapters.push({
            id: `uploaded_ch_${trackIndex}`,
            title: chapterTitle,
            content: bodyContent,
          });
          trackIndex++;
        }
      } catch {
        const bodyMatch = chapterHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        const contentHtml = bodyMatch ? bodyMatch[1] : chapterHtml;
        chapters.push({
          id: `uploaded_ch_${trackIndex}`,
          title: `Chapter ${trackIndex}`,
          content: contentHtml,
        });
        trackIndex++;
      }
    }
  }

  // If spine was empty, read any HTML/XHTML files in the zip
  if (chapters.length === 0) {
    const htmlFilePaths = Object.keys(zipContent.files).filter((p) =>
      p.match(/\.(html|xhtml|htm)$/i)
    );
    for (const p of htmlFilePaths) {
      const f = zipContent.file(p);
      if (f) {
        const text = await f.async('text');
        const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        const content = bodyMatch ? bodyMatch[1] : text;
        if (content.trim().length > 30) {
          chapters.push({
            id: `uploaded_ch_${trackIndex}`,
            title: `Chapter ${trackIndex}`,
            content,
          });
          trackIndex++;
        }
      }
    }
  }

  if (chapters.length === 0) {
    chapters.push({
      id: 'uploaded_ch_1',
      title: title,
      content: '<p>EPUB document content loaded successfully.</p>',
    });
  }

  const bookId = `uploaded_${Date.now()}`;
  const totalTimeSecs = chapters.length * 600;

  const audiobook: Audiobook = {
    id: bookId,
    title,
    author,
    description: `Custom uploaded EPUB by ${author}. Contains ${chapters.length} chapter${chapters.length > 1 ? 's' : ''}.`,
    coverImageUrl,
    language: 'English',
    totalTimeSecs,
    reader: 'EPUB Reader / AI Voice',
    tracks: chapters.map((ch, idx) => ({
      id: `${bookId}_tr_${idx + 1}`,
      title: ch.title,
      audioUrl: 'https://archive.org/download/librivox_audio_collection/placeholder.mp3',
      durationSeconds: 600,
      trackNumber: idx + 1,
    })),
    ebookChapters: chapters,
  };

  return audiobook;
}

