import JSZip from 'jszip';
import { FileQueueItem } from '../types';

export const generateZipPackage = async (processedFiles: FileQueueItem[]) => {
  const zip = new JSZip();
  let csvContent = "Original Name,New Name,Folder,Temperature\n";

  processedFiles.forEach((item) => {
    if (item.newName) {
      // Add file to zip with new name
      zip.file(item.newName, item.file);
      
      // Append to CSV
      const safeTemp = item.temperature || "N/A";
      csvContent += `"${item.originalName}","${item.newName}","${item.folderName}","${safeTemp}"\n`;
    }
  });

  // Add the summary CSV
  zip.file("data_summary.csv", csvContent);

  const content = await zip.generateAsync({ type: "blob" });
  return content;
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};