import { registerPlugin } from '@capacitor/core';

export interface FileBackupPlugin {
  saveToDownloads(options: {
    filename: string;
    content: string;
    mimeType?: string;
  }): Promise<{ uri?: string; path?: string; success: boolean }>;
}

const FileBackup = registerPlugin<FileBackupPlugin>('FileBackup');

export default FileBackup;
