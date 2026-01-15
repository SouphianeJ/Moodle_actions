'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui';

interface StudentFileInfo {
  filename: string;
  filepath: string;
  filesize: number;
  fileurl: string;
  mimetype: string;
  assignmentName: string;
  assignid: number;
  cmid: number;
}

interface StudentSubmissionData {
  userId: number;
  firstName: string;
  lastName: string;
  email?: string;
  files: StudentFileInfo[];
  status: 'submitted' | 'draft' | 'nosubmission';
}

interface FilePreviewModalProps {
  studentData: StudentSubmissionData;
  onClose: () => void;
  onNextStudent: () => void;
}

export function FilePreviewModal({ studentData, onClose, onNextStudent }: FilePreviewModalProps) {
  // Use studentData.userId as key for resetting state
  const [internalState, setInternalState] = useState({
    fileIndex: 0,
    loading: true,
    error: null as string | null,
    studentId: studentData.userId,
  });

  // When student changes, reset state
  const currentFileIndex = internalState.studentId === studentData.userId 
    ? internalState.fileIndex 
    : 0;
  const loading = internalState.studentId === studentData.userId
    ? internalState.loading 
    : true;
  const error = internalState.studentId === studentData.userId
    ? internalState.error 
    : null;

  // Sync state when student changes
  if (internalState.studentId !== studentData.userId) {
    setInternalState({
      fileIndex: 0,
      loading: true,
      error: null,
      studentId: studentData.userId,
    });
  }

  const setCurrentFileIndex = (idx: number | ((prev: number) => number)) => {
    setInternalState(prev => ({
      ...prev,
      fileIndex: typeof idx === 'function' ? idx(prev.fileIndex) : idx,
    }));
  };

  const setLoading = (val: boolean) => {
    setInternalState(prev => ({ ...prev, loading: val }));
  };

  const setError = (val: string | null) => {
    setInternalState(prev => ({ ...prev, error: val }));
  };

  const currentFile = studentData.files[currentFileIndex];
  const totalFiles = studentData.files.length;

  const handlePrevFile = useCallback(() => {
    if (currentFileIndex > 0) {
      setCurrentFileIndex(prev => prev - 1);
      setLoading(true);
      setError(null);
    }
  }, [currentFileIndex]);

  const handleNextFile = useCallback(() => {
    if (currentFileIndex < totalFiles - 1) {
      setCurrentFileIndex(prev => prev + 1);
      setLoading(true);
      setError(null);
    }
  }, [currentFileIndex, totalFiles]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowLeft') {
      handlePrevFile();
    } else if (e.key === 'ArrowRight') {
      handleNextFile();
    } else if (e.key === 'ArrowDown') {
      onNextStudent();
    }
  }, [onClose, handlePrevFile, handleNextFile, onNextStudent]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const proxyUrl = `/api/actions/student-submissions/proxy-file?url=${encodeURIComponent(currentFile.fileurl)}`;

  const renderPreview = () => {
    const mimetype = currentFile.mimetype.toLowerCase();
    
    if (mimetype.startsWith('image/')) {
      return (
        <div className="flex items-center justify-center w-full h-full p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proxyUrl}
            alt={currentFile.filename}
            className="max-w-full max-h-full object-contain"
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError('Impossible de charger l\'image.');
            }}
          />
        </div>
      );
    }
    
    if (mimetype === 'application/pdf') {
      return (
        <iframe
          src={proxyUrl}
          className="w-full h-full border-0"
          title={currentFile.filename}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError('Impossible de charger le PDF.');
          }}
        />
      );
    }
    
    // For Office documents (docx, xlsx, pptx), we can use a download link
    // since browsers can't preview them directly
    if (
      mimetype.includes('wordprocessingml') ||
      mimetype.includes('spreadsheetml') ||
      mimetype.includes('presentationml') ||
      mimetype === 'application/msword' ||
      mimetype === 'application/vnd.ms-excel' ||
      mimetype === 'application/vnd.ms-powerpoint'
    ) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full p-8 text-center">
          <div className="text-6xl mb-4">📄</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {currentFile.filename}
          </h3>
          <p className="text-gray-500 mb-6">
            Les documents Office ne peuvent pas être prévisualisés directement.
          </p>
          <a
            href={proxyUrl}
            download={currentFile.filename}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            onClick={() => setLoading(false)}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Télécharger
          </a>
        </div>
      );
    }
    
    // For text files
    if (mimetype.startsWith('text/') || mimetype === 'application/json') {
      return (
        <iframe
          src={proxyUrl}
          className="w-full h-full border-0 bg-white"
          title={currentFile.filename}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError('Impossible de charger le fichier.');
          }}
        />
      );
    }
    
    // Generic fallback - offer download
    return (
      <div className="flex flex-col items-center justify-center w-full h-full p-8 text-center">
        <div className="text-6xl mb-4">📁</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {currentFile.filename}
        </h3>
        <p className="text-gray-500 mb-2">
          Type: {currentFile.mimetype}
        </p>
        <p className="text-gray-500 mb-6">
          Ce type de fichier ne peut pas être prévisualisé.
        </p>
        <a
          href={proxyUrl}
          download={currentFile.filename}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          onClick={() => setLoading(false)}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Télécharger
        </a>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      {/* Header */}
      <div className="flex-shrink-0 bg-gray-900 text-white px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              title="Fermer (Échap)"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div>
              <h2 className="font-semibold">
                {studentData.firstName} {studentData.lastName}
              </h2>
              <p className="text-sm text-gray-400">
                Fichier {currentFileIndex + 1} sur {totalFiles}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400 mr-2">
              {currentFile.assignmentName}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={onNextStudent}
              title="Étudiant suivant (↓)"
            >
              Étudiant suivant
            </Button>
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Loading indicator */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-white mt-4">Chargement...</p>
            </div>
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
            <div className="bg-red-100 text-red-800 px-6 py-4 rounded-lg">
              {error}
            </div>
          </div>
        )}
        
        {/* Preview area */}
        <div className="w-full h-full bg-gray-800">
          {renderPreview()}
        </div>
        
        {/* Navigation arrows */}
        {totalFiles > 1 && (
          <>
            <button
              onClick={handlePrevFile}
              disabled={currentFileIndex === 0}
              className={`
                absolute left-4 top-1/2 -translate-y-1/2
                p-3 rounded-full bg-gray-900/80 text-white
                transition-opacity
                ${currentFileIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-900 opacity-70 hover:opacity-100'}
              `}
              title="Fichier précédent (←)"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleNextFile}
              disabled={currentFileIndex === totalFiles - 1}
              className={`
                absolute right-4 top-1/2 -translate-y-1/2
                p-3 rounded-full bg-gray-900/80 text-white
                transition-opacity
                ${currentFileIndex === totalFiles - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-900 opacity-70 hover:opacity-100'}
              `}
              title="Fichier suivant (→)"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>
      
      {/* Footer - file info and thumbnails */}
      <div className="flex-shrink-0 bg-gray-900 text-white px-4 py-3 border-t border-gray-700">
        <div className="max-w-7xl mx-auto">
          {/* Current file info */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium truncate flex-1 mr-4">
              {currentFile.filename}
            </p>
            <p className="text-sm text-gray-400 flex-shrink-0">
              {formatFileSize(currentFile.filesize)} • {currentFile.mimetype.split('/')[1]?.toUpperCase()}
            </p>
          </div>
          
          {/* File thumbnails */}
          {totalFiles > 1 && (
            <div className="flex gap-2 overflow-x-auto py-2">
              {studentData.files.map((file, idx) => (
                <button
                  key={`${file.assignid}-${file.filename}-${idx}`}
                  onClick={() => {
                    setCurrentFileIndex(idx);
                    setLoading(true);
                    setError(null);
                  }}
                  className={`
                    flex-shrink-0 px-3 py-1.5 rounded text-sm
                    transition-colors
                    ${idx === currentFileIndex
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }
                  `}
                  title={file.filename}
                >
                  {idx + 1}. {file.filename.length > 20 
                    ? file.filename.substring(0, 17) + '...' 
                    : file.filename}
                </button>
              ))}
            </div>
          )}
          
          {/* Keyboard shortcuts hint */}
          <p className="text-xs text-gray-500 mt-2">
            ← → pour naviguer entre fichiers • ↓ pour l&apos;étudiant suivant • Échap pour fermer
          </p>
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
