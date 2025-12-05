export interface FileQueueItem {
  id: string;
  file: File;
  originalName: string;
  folderName: string;
  stage: 1 | 2 | 3; // 1: Import/Rename, 2: Analyze/Edit, 3: Export
  status: 'idle' | 'processing' | 'success' | 'error';
  temperature?: string;
  newName?: string;     // The final assigned name
  previewName?: string; // The calculated name based on current settings (for Step 1)
}

export interface ProcessingConfig {
  prefix: string;
  startIndex: number;
  filterFolderPattern: string;
}
