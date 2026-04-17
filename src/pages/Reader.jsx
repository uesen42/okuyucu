import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { supabase } from '../lib/supabase';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, X, Sun, Moon, Coffee, Search, StickyNote } from 'lucide-react';
import NotesDrawer from '../components/NotesDrawer';
import { useWindowSize } from '../hooks/useWindowSize';

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
  const [theme, setTheme] = useState(localStorage.getItem('readerTheme') || 'dark');
  const [jumpStr, setJumpStr] = useState('');
  const windowSize = useWindowSize();
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    setJumpStr('');
  };

  const handleJump = (e) => {
    e.preventDefault();
    const target = parseInt(jumpStr);
    if (!isNaN(target) && target >= 1 && target <= numPages) {
      setPageNumber(target);
    }
    setJumpStr('');
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'sepia' : theme === 'sepia' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('readerTheme', nextTheme);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Theme styles map
  const themeStyles = {
    dark: 'bg-[#05060f] text-white',
    light: 'bg-gray-100 text-gray-900',
    sepia: 'bg-[#f4ecd8] text-[#5b4636]'
  };

  const getContainerWidth = () => {
    // Leave some padding based on screen size
    const padding = windowSize.width < 768 ? 32 : 64; 
    return Math.min(Math.max(windowSize.width - padding, 300), 1000); 
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-text-secondary">Kitap yükleniyor...</div>;

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-500 ${themeStyles[theme]}`}>
      {/* Top Bar */}
      <div className={`glass h-auto min-h-[64px] py-3 px-4 md:px-6 flex flex-wrap gap-4 items-center justify-between sticky top-0 z-10 border-none rounded-none shadow-sm ${theme === 'dark' ? 'bg-black/60 border-b border-white/10' : 'bg-white/80 border-b border-black/5'}`}>
        <div className="flex items-center gap-3">
          <button className="p-2 hover:bg-black/10 hover:dark:bg-white/10 rounded-full transition-colors shrink-0" onClick={() => navigate('/')}>
            <X size={24} />
          </button>
          <h2 className="font-semibold text-sm md:text-lg max-w-[150px] md:max-w-md truncate drop-shadow-sm">{book?.title}</h2>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-end">
          <button className="p-2 hover:bg-black/10 hover:dark:bg-white/10 rounded-full transition-colors hidden sm:block" onClick={toggleTheme}>
            {theme === 'dark' ? <Moon size={22} /> : theme === 'sepia' ? <Coffee size={22} /> : <Sun size={22} />}
          </button>

          <button className="p-2 hover:bg-black/10 hover:dark:bg-white/10 rounded-full transition-colors hidden sm:block" onClick={toggleFullscreen}>
            <Maximize2 size={22} />
          </button>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/5'}`}>
            <button className="p-1 hover:text-accent-primary transition-colors" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}>
              <ZoomOut size={18} />
            </button>
            <span className="text-xs font-mono w-9 text-center font-semibold">{Math.round(scale * 100)}%</span>
            <button className="p-1 hover:text-accent-primary transition-colors" onClick={() => setScale(s => Math.min(2, s + 0.1))}>
              <ZoomIn size={18} />
            </button>
          </div>
          
          <form onSubmit={handleJump} className="hidden lg:flex items-center gap-2 text-sm opacity-90 glass px-3 py-1.5 rounded-xl">
            <Search size={18} />
            <input 
              type="number" 
              placeholder={pageNumber.toString()}
              className={`w-16 px-2 py-1 rounded text-center outline-none font-bold ${theme === 'dark' ? 'bg-black/50 text-white placeholder-white/50' : 'bg-white/50 text-black placeholder-black/50'}`}
              value={jumpStr}
              onChange={e => setJumpStr(e.target.value)}
            />
            <span className="font-medium">/ {numPages}</span>
          </form>

          <button 
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 font-semibold shadow-sm border ${isNotesOpen ? 'bg-accent-primary text-white border-accent-primary shadow-accent-primary/20' : theme === 'dark' ? 'bg-white/10 border-white/10 hover:bg-white/20' : 'bg-black/5 border-black/10 hover:bg-black/10'}`}
            onClick={() => setIsNotesOpen(!isNotesOpen)}
          >
            <StickyNote size={18} />
            <span className="hidden sm:inline">Notlar</span>
          </button>
        </div>
      </div>

      {/* Reader Area */}
      <div className="flex-1 overflow-auto p-2 md:p-6 flex justify-center items-start">
        <div className={`transition-all duration-300 ${theme === 'dark' ? 'shadow-2xl shadow-black/80' : 'shadow-xl shadow-black/20'}`}>
          <Document
            file={book?.file_url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div className="opacity-50 py-20 text-center">Sayfalar oluşturuluyor...</div>}
            error={<div className="text-red-500 py-20 text-center font-bold">PDF yüklenemedi. Lütfen dosyayı kontrol edin.</div>}
          >
            <Page 
              pageNumber={pageNumber} 
              scale={scale} 
              width={windowSize.width ? getContainerWidth() : undefined}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="animate-fade-in"
            />
          </Document>
        </div>
      </div>

      {/* Persistent Bottom Bar */}
      <div className={`transition-colors duration-500 min-h-[80px] py-4 backdrop-blur-2xl border-t flex flex-col sm:flex-row items-center justify-between sticky bottom-0 z-10 px-4 md:px-8 gap-4 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] ${theme === 'dark' ? 'bg-black/70 border-white/10' : 'bg-white/90 border-black/10'}`}>
        
        <button 
          className={`flex-1 sm:flex-none btn-secondary px-6 py-3 flex justify-center items-center gap-2 rounded-xl transition-all border ${theme === 'dark' ? 'hover:bg-white/10 border-white/10 text-white' : 'hover:bg-black/5 border-black/10 text-black'} disabled:opacity-30`} 
          disabled={pageNumber <= 1}
          onClick={() => changePage(-1)}
        >
          <ChevronLeft size={22} className={theme === 'dark' ? 'text-accent-secondary' : 'text-accent-primary'} />
          <span className="font-semibold tracking-wide">Önceki</span>
        </button>

        <div className="flex flex-col items-center gap-2 w-full sm:w-1/3">
          <div className="text-xs md:text-sm font-bold tracking-widest uppercase opacity-70">Sayfa {pageNumber} / {numPages}</div>
          <div className={`w-full progress-bar-container h-2 rounded-full overflow-hidden shadow-inner ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'}`}>
            <div 
              className="progress-bar-fill h-full rounded-full transition-all duration-300 ease-out bg-gradient-to-r from-accent-primary to-accent-secondary" 
              style={{ width: `${(pageNumber / (numPages || 1)) * 100}%` }}
            />
          </div>
        </div>

        <button 
          className={`flex-1 sm:flex-none btn-secondary px-6 py-3 flex justify-center items-center gap-2 rounded-xl transition-all border ${theme === 'dark' ? 'hover:bg-white/10 border-white/10 text-white' : 'hover:bg-black/5 border-black/10 text-black'} disabled:opacity-30`} 
          disabled={pageNumber >= numPages}
          onClick={() => changePage(1)}
        >
          <span className="font-semibold tracking-wide">Sonraki</span>
          <ChevronRight size={22} className={theme === 'dark' ? 'text-accent-secondary' : 'text-accent-primary'} />
        </button>
      </div>

      {/* Mobile Tools Overlay */}
      <div className="sm:hidden fixed top-24 right-4 flex flex-col gap-3 pointer-events-auto z-20">
         <button className="p-3 rounded-2xl glass bg-black/60 backdrop-blur-xl border border-white/20 text-white shadow-xl hover:scale-105 transition-transform" onClick={toggleTheme}>
            {theme === 'dark' ? <Moon size={20} /> : theme === 'sepia' ? <Coffee size={20} /> : <Sun size={20} />}
         </button>
         <button className="p-3 rounded-2xl glass bg-black/60 backdrop-blur-xl border border-white/20 text-white shadow-xl hover:scale-105 transition-transform" onClick={toggleFullscreen}>
            <Maximize2 size={20} />
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
