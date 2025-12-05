import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Settings, 
  Download, 
  Trash2, 
  FileImage, 
  ArrowRight,
  Check,
  Edit2,
  AlertCircle,
  X
} from 'lucide-react';
import { FileQueueItem } from './types';
import { generateZipPackage, downloadBlob } from './utils/zipUtils';

// Helper to extract extension
const getExtension = (filename: string) => {
  return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
};

// Helper to validate image types
const isImageFile = (file: File) => {
  const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  // Check mime type or extension as backup
  return validTypes.includes(file.type) || /\.(jpg|jpeg|png|webp)$/i.test(file.name);
};

export default function App() {
  const [queue, setQueue] = useState<FileQueueItem[]>([]);
  
  // Config State
  const [prefix, setPrefix] = useState<string>("01-");
  const [startIndex, setStartIndex] = useState<number>(1);
  const [filterSuffix, setFilterSuffix] = useState<string>("-1");
  const [onlyFilter, setOnlyFilter] = useState<boolean>(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Helpers ---

  // Dynamically calculate preview names for Stage 1 items
  useEffect(() => {
    setQueue(prevQueue => {
      let currentSequence = startIndex;
      return prevQueue.map(item => {
        if (item.stage === 1) {
          const ext = getExtension(item.originalName);
          const sequenceStr = currentSequence.toString().padStart(3, '0');
          const preview = `${prefix}${sequenceStr}.${ext}`;
          currentSequence++;
          return { ...item, previewName: preview };
        }
        return item;
      });
    });
  }, [prefix, startIndex, queue.length]); // Re-calc when config or queue size changes

  // --- Handlers ---

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      processFiles(Array.from(event.target.files));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const processFiles = (files: File[]) => {
    // Filter for images only
    const imageFiles = files.filter(isImageFile);

    if (imageFiles.length === 0 && files.length > 0) {
      alert("No valid image files (JPG, PNG) found.");
      return;
    }

    const newItems: FileQueueItem[] = imageFiles.map((file) => {
      const pathParts = file.webkitRelativePath.split('/');
      const folderName = pathParts.length > 1 ? pathParts[pathParts.length - 2] : 'Root';
      
      return {
        id: Math.random().toString(36).substr(2, 9),
        file,
        originalName: file.name,
        folderName,
        stage: 1,
        status: 'idle'
      };
    });

    const filteredFiles = onlyFilter 
      ? newItems.filter(f => f.folderName.endsWith(filterSuffix))
      : newItems;

    if (filteredFiles.length === 0 && newItems.length > 0) {
      alert(`No files found in folders ending with "${filterSuffix}".`);
    }

    setQueue(prev => [...prev, ...filteredFiles]);
  };

  const moveToStage2 = () => {
    if (!window.confirm("Confirm renaming? This will lock the filenames.")) return;

    setQueue(prev => prev.map(item => {
      if (item.stage === 1) {
        return {
          ...item,
          stage: 2,
          newName: item.previewName, // Lock the name
          status: 'idle'
        };
      }
      return item;
    }));
    
    // Update start index for next batch to continue sequence
    const stage1Count = queue.filter(i => i.stage === 1).length;
    setStartIndex(prev => prev + stage1Count);
  };

  const moveToStage3 = () => {
    // Validate that all Stage 2 items have a temperature
    const incomplete = queue.some(i => i.stage === 2 && !i.temperature);
    if (incomplete) {
      if(!window.confirm("Some images don't have a temperature value yet. Proceed anyway?")) return;
    }

    setQueue(prev => prev.map(item => {
      if (item.stage === 2) {
        return { ...item, stage: 3 };
      }
      return item;
    }));
  };

  const updateTemperature = (id: string, value: string) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, temperature: value, status: value ? 'success' : 'idle' } : item));
  };

  const removeItem = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const handleDownload = async () => {
    const stage3Items = queue.filter(i => i.stage === 3);
    if (stage3Items.length === 0) return;
    
    try {
      const blob = await generateZipPackage(stage3Items);
      downloadBlob(blob, `thermal-batch-export-${new Date().toISOString().slice(0, 10)}.zip`);
    } catch (e) {
      console.error(e);
      alert("Failed to create zip");
    }
  };

  // --- Render Sections ---

  // 1. STAGE 1: IMPORT & RENAME
  const renderStage1 = () => {
    const items = queue.filter(i => i.stage === 1);
    return (
      <div 
        className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-slate-700 flex items-center gap-2">
              <span className="bg-slate-200 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
              Import & Rename
            </h2>
            <span className="text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-600">{items.length} files</span>
          </div>
          
          {/* Config Controls */}
          <div className="space-y-3 mt-3 text-sm">
             <div className="grid grid-cols-2 gap-2">
               <div>
                 <label className="block text-xs text-slate-500 mb-1">Prefix</label>
                 <input 
                   type="text" value={prefix} onChange={e => setPrefix(e.target.value)}
                   className="w-full px-2 py-1 border rounded"
                 />
               </div>
               <div>
                 <label className="block text-xs text-slate-500 mb-1">Start #</label>
                 <input 
                   type="number" value={startIndex} onChange={e => setStartIndex(parseInt(e.target.value))}
                   className="w-full px-2 py-1 border rounded"
                 />
               </div>
             </div>
             
             <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <input 
                  type="checkbox" checked={onlyFilter} onChange={e => setOnlyFilter(e.target.checked)}
                  id="folderFilter" className="rounded text-indigo-600"
                />
                <label htmlFor="folderFilter" className="text-xs text-slate-600">Only folders ending in:</label>
                <input 
                   type="text" value={filterSuffix} onChange={e => setFilterSuffix(e.target.value)}
                   className="w-12 px-1 py-0.5 border rounded text-xs" disabled={!onlyFilter}
                 />
             </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2 bg-slate-50/50">
          {items.length === 0 ? (
             <div 
              onClick={() => fileInputRef.current?.click()}
              className="h-48 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-50 hover:border-indigo-400 transition-colors"
             >
               <Upload size={24} className="mb-2" />
               <span className="text-sm">Drag files or Click</span>
               <span className="text-xs text-slate-400 mt-1">Supports JPG, PNG</span>
             </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="bg-white p-3 rounded shadow-sm border border-slate-100 flex items-center justify-between group">
                <div className="min-w-0 flex-1 mr-2">
                   <div className="text-xs text-slate-400 truncate">{item.originalName}</div>
                   <div className="text-sm font-mono text-indigo-600 font-medium truncate flex items-center gap-1">
                     <ArrowRight size={12} />
                     {item.previewName}
                   </div>
                </div>
                <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-white">
          <button 
            onClick={moveToStage2}
            disabled={items.length === 0}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
          >
            Confirm & Next <ArrowRight size={16} />
          </button>
          <input 
            type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" 
            multiple 
            accept="image/png, image/jpeg, image/jpg, image/webp"
            // @ts-ignore
            webkitdirectory="" 
          />
        </div>
      </div>
    );
  };

  // 2. STAGE 2: MANUAL ENTRY
  const renderStage2 = () => {
    const items = queue.filter(i => i.stage === 2);
    return (
      <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
           <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-slate-700 flex items-center gap-2">
              <span className="bg-slate-200 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
              Manual Input
            </h2>
            <span className="text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-600">{items.length} files</span>
          </div>
          <p className="text-xs text-slate-500">Enter temperature value for each image.</p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2 bg-slate-50/50">
           {items.length === 0 && (
             <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
               No files awaiting input.
             </div>
           )}
           {items.map(item => (
             <div key={item.id} className="bg-white p-3 rounded shadow-sm border border-slate-100">
               <div className="flex items-center justify-between mb-2">
                 <span className="text-sm font-mono font-medium text-slate-700">{item.newName}</span>
                 {item.temperature ? (
                   <Check size={14} className="text-emerald-500" />
                 ) : (
                   <AlertCircle size={14} className="text-orange-400" />
                 )}
               </div>
               
               <div className="flex items-center gap-2">
                 <div className="relative flex-1">
                   <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                     <Edit2 size={12} className="text-slate-400" />
                   </div>
                   <input 
                     type="text" 
                     value={item.temperature || ''} 
                     onChange={(e) => updateTemperature(item.id, e.target.value)}
                     placeholder="Enter Temp"
                     className={`w-full pl-7 pr-2 py-1 text-sm border rounded outline-none focus:ring-1 focus:ring-indigo-500 transition-colors
                        ${!item.temperature ? 'bg-orange-50 border-orange-200' : 'bg-white font-semibold text-slate-800'}`}
                   />
                 </div>
               </div>
             </div>
           ))}
        </div>

        <div className="p-4 border-t border-slate-200 bg-white space-y-2">
          <button 
             onClick={moveToStage3}
             disabled={items.length === 0}
             className="w-full py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
          >
            Confirm & Import <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  };

  // 3. STAGE 3: EXPORT
  const renderStage3 = () => {
    const items = queue.filter(i => i.stage === 3);
    return (
      <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
           <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-slate-700 flex items-center gap-2">
              <span className="bg-slate-200 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
              Final Export
            </h2>
            <span className="text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-600">{items.length} files</span>
          </div>
          <p className="text-xs text-slate-500">Review data and download package.</p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-medium text-xs uppercase sticky top-0">
              <tr>
                <th className="px-3 py-2">File</th>
                <th className="px-3 py-2">Temp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-slate-700">{item.newName}</td>
                  <td className="px-3 py-2 font-bold text-slate-800">{item.temperature}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
             <div className="h-40 flex items-center justify-center text-slate-400 text-sm italic p-4 text-center">
               Completed items will appear here.
             </div>
           )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-white">
          <button 
             onClick={handleDownload}
             disabled={items.length === 0}
             className="w-full py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Download size={16} />
            Download Package
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <FileImage className="text-white h-5 w-5" />
            </div>
            <h1 className="text-lg font-bold text-slate-800">ThermoBatch Renamer</h1>
          </div>
          <div className="text-xs text-slate-500 flex gap-4">
             <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> Original Quality Preserved</div>
             <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400"></span> Manual Temp Entry</div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-hidden h-[calc(100vh-3.5rem)]">
         <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {renderStage1()}
            {renderStage2()}
            {renderStage3()}
         </div>
      </main>
    </div>
  );
}