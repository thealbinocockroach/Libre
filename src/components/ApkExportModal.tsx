import React, { useState } from 'react';
import JSZip from 'jszip';
import { FLUTTER_FILES } from '../data/flutterFiles';
import {
  Download,
  Smartphone,
  Terminal,
  Github,
  Check,
  Copy,
  X,
  ExternalLink,
  Package,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface ApkExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApkExportModal: React.FC<ApkExportModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'zip' | 'cli' | 'github' | 'install'>('zip');
  const [isZipping, setIsZipping] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();

      // Add all generated Flutter & Android files to the zip archive
      FLUTTER_FILES.forEach((file) => {
        zip.file(file.path, file.content);
      });

      // Generate the binary zip
      const content = await zip.generateAsync({ type: 'blob' });

      // Create download trigger
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'libriaudio-flutter-android-project.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.warn('Failed to generate ZIP archive:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const copyCode = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div
      id="apk-export-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        id="apk-export-modal-dialog"
        className="w-full max-w-2xl bg-[#0c0c0c] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 bg-[#111111] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C5A059]/15 border border-[#C5A059]/30 flex items-center justify-center text-[#C5A059] shadow-inner">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-serif-display italic font-semibold text-white tracking-wide">
                  Export Android APK & Project
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-semibold bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30">
                  Ready to Build
                </span>
              </div>
              <p className="text-xs text-[#888888]">
                Download the complete Flutter source code and build your production APK in 1 command.
              </p>
            </div>
          </div>

          <button
            id="btn-close-apk-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-white/10 bg-[#080808] px-5 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('zip')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-all ${
              activeTab === 'zip'
                ? 'border-[#C5A059] text-[#C5A059] font-semibold'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download ZIP</span>
          </button>
          <button
            onClick={() => setActiveTab('cli')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-all ${
              activeTab === 'cli'
                ? 'border-[#C5A059] text-[#C5A059] font-semibold'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Build with CLI</span>
          </button>
          <button
            onClick={() => setActiveTab('github')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-all ${
              activeTab === 'github'
                ? 'border-[#C5A059] text-[#C5A059] font-semibold'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <Github className="w-3.5 h-3.5" />
            <span>Automated CI/CD</span>
          </button>
          <button
            onClick={() => setActiveTab('install')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-all ${
              activeTab === 'install'
                ? 'border-[#C5A059] text-[#C5A059] font-semibold'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Phone Install</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-[#EFEFEF]">
          {activeTab === 'zip' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/[0.03] border border-[#C5A059]/25 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[#C5A059]/10 text-[#C5A059] shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-serif-display italic font-semibold text-white text-sm">
                    Complete Android Flutter Codebase Package
                  </h4>
                  <p className="text-white/60 text-[11px] mt-1 leading-relaxed">
                    This archive contains all 17 Flutter & Android source files, Gradle configuration, AudioService background manifest permissions, Riverpod state managers, Dio REST integration, and GitHub Actions APK build workflows.
                  </p>
                </div>
              </div>

              {/* Main Download Button */}
              <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-[#111111] border border-white/10 text-center space-y-3">
                <button
                  id="btn-download-project-zip"
                  onClick={handleDownloadZip}
                  disabled={isZipping}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#C5A059] hover:bg-[#d4af65] text-black font-semibold text-xs transition-all shadow-[0_0_20px_rgba(197,160,89,0.35)] flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {isZipping ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Packaging Source Files...</span>
                    </>
                  ) : downloadSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-black font-bold" />
                      <span>ZIP Archive Downloaded!</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Download Flutter Android Project (.zip)</span>
                    </>
                  )}
                </button>
                <p className="text-[10px] text-white/40">
                  Includes all files: <code className="text-[#C5A059]">pubspec.yaml</code>, <code className="text-[#C5A059]">AndroidManifest.xml</code>, <code className="text-[#C5A059]">lib/</code>, and <code className="text-[#C5A059]">.github/workflows</code>
                </p>
              </div>

              {/* Quick 3-Step Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-[#111111] border border-white/10 space-y-1">
                  <div className="text-[#C5A059] font-mono text-[10px] font-bold">STEP 1</div>
                  <div className="text-white font-medium text-xs">Extract ZIP</div>
                  <p className="text-white/50 text-[10px]">Unzip on your computer or Android Studio workspace.</p>
                </div>
                <div className="p-3 rounded-xl bg-[#111111] border border-white/10 space-y-1">
                  <div className="text-[#C5A059] font-mono text-[10px] font-bold">STEP 2</div>
                  <div className="text-white font-medium text-xs">Run Build Command</div>
                  <p className="text-white/50 text-[10px]">Run <code className="text-[#C5A059]">flutter build apk --release</code>.</p>
                </div>
                <div className="p-3 rounded-xl bg-[#111111] border border-white/10 space-y-1">
                  <div className="text-[#C5A059] font-mono text-[10px] font-bold">STEP 3</div>
                  <div className="text-white font-medium text-xs">Install APK</div>
                  <p className="text-white/50 text-[10px]">Transfer <code className="text-[#C5A059]">app-release.apk</code> to your phone.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cli' && (
            <div className="space-y-4">
              <p className="text-white/70 leading-relaxed">
                If you have the <strong>Flutter SDK</strong> installed on your computer, open your terminal inside the extracted project folder and run the following commands:
              </p>

              {/* Code Snippet 1 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-white/60">
                  <span className="font-mono">1. Fetch packages</span>
                  <button
                    onClick={() => copyCode('flutter pub get', 1)}
                    className="flex items-center gap-1 text-[#C5A059] hover:underline"
                  >
                    {copiedIndex === 1 ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedIndex === 1 ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-[#080808] border border-white/10 font-mono text-xs text-white/90 overflow-x-auto">
                  flutter pub get
                </pre>
              </div>

              {/* Code Snippet 2 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-white/60">
                  <span className="font-mono">2. Build standalone Universal Release APK</span>
                  <button
                    onClick={() => copyCode('flutter build apk --release', 2)}
                    className="flex items-center gap-1 text-[#C5A059] hover:underline"
                  >
                    {copiedIndex === 2 ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedIndex === 2 ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-[#080808] border border-white/10 font-mono text-xs text-[#C5A059] overflow-x-auto">
                  flutter build apk --release
                </pre>
                <p className="text-[10px] text-white/40">
                  APK Output file location: <code className="text-white/80">build/app/outputs/flutter-apk/app-release.apk</code>
                </p>
              </div>

              {/* Code Snippet 3 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-white/60">
                  <span className="font-mono">3. (Optional) Run directly on plugged-in Android device</span>
                  <button
                    onClick={() => copyCode('flutter run -d android --release', 3)}
                    className="flex items-center gap-1 text-[#C5A059] hover:underline"
                  >
                    {copiedIndex === 3 ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedIndex === 3 ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-[#080808] border border-white/10 font-mono text-xs text-white/90 overflow-x-auto">
                  flutter run -d android --release
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'github' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-start gap-3">
                <Github className="w-5 h-5 text-white shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-white text-xs">Zero-Setup Cloud APK Generation</h4>
                  <p className="text-white/60 text-[11px] mt-0.5 leading-relaxed">
                    You do not even need Flutter installed locally! The included <code className="text-[#C5A059]">.github/workflows/build_apk.yml</code> file allows GitHub to build the Android APK in the cloud for free.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h5 className="font-semibold text-white text-xs">How it works:</h5>
                <ol className="list-decimal list-inside space-y-1.5 text-white/70 text-[11px]">
                  <li>Download the project ZIP and push it to a new GitHub repository.</li>
                  <li>Go to your GitHub repository &rarr; click the <strong>Actions</strong> tab.</li>
                  <li>GitHub automatically runs the <strong>Build Android APK</strong> workflow on Ubuntu runners.</li>
                  <li>When completed (under 2 minutes), download the compiled <code className="text-[#C5A059]">app-release.apk</code> directly from the Artifacts section!</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'install' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                <h4 className="font-semibold text-white text-xs flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-[#C5A059]" />
                  Installing the APK onto your Android phone
                </h4>
                <p className="text-white/70 text-[11px] leading-relaxed">
                  Once you have the <code className="text-[#C5A059]">app-release.apk</code> file:
                </p>
                <ul className="space-y-2 text-[11px] text-white/70">
                  <li className="flex items-start gap-2">
                    <span className="text-[#C5A059] font-bold">1.</span>
                    <span><strong>Direct Transfer:</strong> Send the <code className="text-white">app-release.apk</code> file to your phone via Google Drive, WhatsApp, Telegram, or USB cable.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#C5A059] font-bold">2.</span>
                    <span><strong>Allow Unknown Apps:</strong> Tap the APK on your phone. If prompted, toggle on &ldquo;Allow from this source&rdquo; to install the standalone application.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#C5A059] font-bold">3.</span>
                    <span><strong>Enjoy Background Audio:</strong> LibriAudio will run seamlessly with system lock-screen media notifications and headphone controls enabled.</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#111111] border-t border-white/10 flex items-center justify-between">
          <span className="text-[11px] text-white/40 font-mono">
            Package: <span className="text-white/70">com.libriaudio.app</span>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all"
            >
              Close
            </button>
            <button
              onClick={handleDownloadZip}
              className="px-4 py-1.5 rounded-lg bg-[#C5A059] hover:bg-[#d4af65] text-black font-semibold text-xs transition-all shadow-[0_0_12px_rgba(197,160,89,0.3)] flex items-center gap-1.5 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Project ZIP</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
