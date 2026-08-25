import React, { useState } from 'react';
import { FLUTTER_FILES } from '../data/flutterFiles';
import { FlutterFile } from '../types';
import { ApkExportModal } from './ApkExportModal';
import {
  FileCode,
  FolderTree,
  Copy,
  Check,
  Search,
  Layers,
  Terminal,
  Smartphone,
  Download,
  Info,
  ExternalLink,
  Package,
} from 'lucide-react';

export const CodeExplorer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<FlutterFile>(FLUTTER_FILES[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [showApkModal, setShowApkModal] = useState(false);

  const filteredFiles = FLUTTER_FILES.filter(
    (file) =>
      file.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCategoryBadge = (category: FlutterFile['category']) => {
    switch (category) {
      case 'config':
        return <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-semibold bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]">Config</span>;
      case 'core':
        return <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">Core</span>;
      case 'catalog':
        return <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Catalog</span>;
      case 'player':
        return <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">Player</span>;
      case 'home':
        return <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">Home Shell</span>;
      case 'main':
        return <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">Main</span>;
    }
  };

  return (
    <div id="flutter-codebase-explorer" className="h-full flex flex-col bg-[var(--bg)] text-[var(--text-main)]">
      {/* Top Banner with Architecture overview */}
      <div className="p-4 bg-[var(--bg)] border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)]">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-serif-display italic font-semibold text-[var(--text-main)]">Flutter Codebase Architecture</h2>
              <span className="px-2 py-0.5 rounded-full bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)] text-[10px] font-semibold uppercase tracking-wider">
                {FLUTTER_FILES.length} Files Generated
              </span>
            </div>
            <p className="text-xs text-[var(--text-dim)]">
              Riverpod + Dio + just_audio + audio_service + Material 3 Dark Theme
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-export-apk-guide"
            onClick={() => setShowApkModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black text-xs font-semibold shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)] transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export & Build APK</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 bg-[var(--surface)] px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-main)]">
            <Terminal className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>flutter build apk</span>
          </div>
        </div>
      </div>

      {/* Main split-screen: File Tree + Code Editor */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Sidebar: File List & Search */}
        <div className="w-full md:w-80 border-r border-[var(--border-subtle)] bg-[var(--bg)] flex flex-col shrink-0">
          <div className="p-3 border-b border-[var(--border-subtle)]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Flutter files..."
                className="w-full pl-9 pr-3 py-1.5 bg-[var(--surface)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] placeholder-white/30 focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-white/10">
            {filteredFiles.map((file) => {
              const isSelected = selectedFile.path === file.path;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left p-2.5 rounded-lg text-xs transition-all flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-[var(--accent-dim)] border border-[var(--accent)] text-[var(--text-main)] font-medium shadow-sm'
                      : 'text-[var(--text-dim)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-main)] border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span className="font-mono truncate font-semibold">{file.name}</span>
                    {getCategoryBadge(file.category)}
                  </div>
                  <span className="text-[10px] text-[var(--text-dim)] truncate font-mono">{file.path}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Area: Code Display */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg)]">
          {/* File Header */}
          <div className="p-3 bg-[var(--bg)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span className="font-mono text-xs font-bold text-[var(--text-main)] truncate">{selectedFile.path}</span>
              </div>
              <p className="text-[11px] text-[var(--text-dim)] mt-0.5 line-clamp-1">{selectedFile.description}</p>
            </div>

            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black text-xs font-semibold shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)] transition-all shrink-0 active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-black font-bold" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Code
                </>
              )}
            </button>
          </div>

          {/* Code Viewer with Line Numbers */}
          <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed bg-[var(--bg)] text-[var(--text-main)] scrollbar-thin scrollbar-thumb-white/10">
            <pre className="table w-full">
              {selectedFile.content.split('\n').map((line, idx) => (
                <div key={idx} className="table-row hover:bg-[var(--surface-raised)]">
                  <span className="table-cell select-none text-[var(--text-dim)] text-right pr-4 w-10 text-[11px]">
                    {idx + 1}
                  </span>
                  <span className="table-cell whitespace-pre text-[var(--text-main)]">{line || ' '}</span>
                </div>
              ))}
            </pre>
          </div>
        </div>
      </div>

      {/* APK Export & Build Instructions Modal */}
      <ApkExportModal
        isOpen={showApkModal}
        onClose={() => setShowApkModal(false)}
      />
    </div>
  );
};
