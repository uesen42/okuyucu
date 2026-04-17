import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { supabase } from '../lib/supabase';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, X, RotateCw, StickyNote } from 'lucide-react';
import NotesDrawer from '../components/NotesDrawer';

// Setup worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const Reader = () => {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [isNotesOpen, setIsNotesOpen] = useState(false);

  useEffect(() => {
    fetchBook();
  }, [bookId]);

  const fetchBook = async () => {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('id', bookId)
      .single();

    if (error) {
      console.error('Error fetching book:', error);
      navigate('/');
    } else {
      setBook(data);
      setPageNumber(data.current_page || 1);
      setLoading(false);
    }
  };

  const syncProgress = async (newPage) => {
    const { error } = await supabase
      .from('books')
      .update({ 
        current_page: newPage ,
        last_read: new Date().toISOString()
      })
      .eq('id', bookId);

    if (error) console.error('Error syncing progress:', error);
  };

  // Debounced sync
  useEffect(() => {
    if (!loading && book) {
      const timer = setTimeout(() => {
        syncProgress(pageNumber);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [pageNumber, book, loading]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    // Update total pages in DB if not set
    if (book && book.total_pages === 0) {
      supabase.from('books').update({ total_pages: numPages }).eq('id', bookId).then();
    }
  };

  const changePage = (offset) => {
    setPageNumber(prevPageNumber => {
      const next = prevPageNumber + offset;
      return Math.min(Math.max(1, next), numPages);
    });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-text-secondary">Kitap yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-[#05060f] flex flex-col">
      {/* Top Bar */}
      <div className="glass h-16 px-6 flex items-center justify-between sticky top-0 z-10 border-none rounded-none border-b border-white/5">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-white/5 rounded-full transition-colors" onClick={() => navigate('/')}>
            <X size={20} />
          </button>
          <h2 className="font-medium text-sm md:text-base max-w-[200px] md:max-w-md truncate">{book?.title}</h2>
        </div>

          <div className="flex items-center gap-2 md:gap-6">
            <button 
              className={`p-2 rounded-lg transition-all flex items-center gap-2 ${isNotesOpen ? 'bg-accent-primary text-white shadow-lg' : 'hover:bg-white/5 text-text-secondary'}`}
              onClick={() => setIsNotesOpen(!isNotesOpen)}
            >
              <StickyNote size={20} />
              <span className="hidden md:inline text-sm font-medium">Notlar</span>
            </button>

            <div className="flex items-center gap-2 glass px-3 py-1 bg-white/5">
            <button className="p-1 hover:text-accent-primary" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}>
              <ZoomOut size={18} />
            </button>
            <span className="text-xs font-mono w-10 text-center">{Math.round(scale * 100)}%</span>
            <button className="p-1 hover:text-accent-primary" onClick={() => setScale(s => Math.min(2, s + 0.1))}>
              <ZoomIn size={18} />
            </button>
          </div>
          
          <div className="hidden md:flex items-center gap-2 text-text-secondary text-sm">
            <span>Sayfa {pageNumber} / {numPages}</span>
          </div>
        </div>
      </div>

      {/* Reader Area */}
      <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center items-start">
        <div className="shadow-2xl shadow-black/50">
          <Document
            file={book?.file_url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div className="text-text-secondary py-20">Sayfalar oluşturuluyor...</div>}
            error={<div className="text-red-400 py-20">PDF yüklenemedi.</div>}
          >
            <Page 
              pageNumber={pageNumber} 
              scale={scale} 
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="animate-fade-in"
            />
          </Document>
        </div>
      </div>

      {/* Persistent Bottom Bar (iPad Friendly) */}
      <div className="h-20 bg-black/80 backdrop-blur-xl border-t border-white/5 px-6 flex items-center justify-between sticky bottom-0 z-10">
        <button 
          className="btn-secondary px-4 py-2 flex items-center gap-2 disabled:opacity-30" 
          disabled={pageNumber <= 1}
          onClick={() => changePage(-1)}
        >
          <ChevronLeft size={24} />
          <span className="hidden md:inline">Önceki</span>
        </button>

        <div className="flex flex-col items-center gap-1">
          <div className="text-sm font-medium">Sayfa {pageNumber} / {numPages}</div>
          <div className="w-32 md:w-64 progress-bar-container bg-white/10 h-1">
            <div 
              className="progress-bar-fill h-full" 
              style={{ width: `${(pageNumber / (numPages || 1)) * 100}%` }}
            />
          </div>
        </div>

        <button 
          className="btn-secondary px-4 py-2 flex items-center gap-2 disabled:opacity-30" 
          disabled={pageNumber >= numPages}
          onClick={() => changePage(1)}
        >
          <span className="hidden md:inline">Sonraki</span>
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Mobile Page Indicator (Overlay) */}
      <div className="md:hidden fixed top-20 right-6 glass px-3 py-1 text-xs text-text-secondary pointer-events-none">
        {pageNumber} / {numPages}
      </div>

      {/* Notes Drawer */}
      <NotesDrawer 
        isOpen={isNotesOpen} 
        onClose={() => setIsNotesOpen(false)} 
        bookId={bookId} 
        pageNumber={pageNumber} 
      />
    </div>
  );
};

export default Reader;
