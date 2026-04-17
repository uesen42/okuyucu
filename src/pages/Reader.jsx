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
      <div className={`glass h-16 px-4 md:px-6 flex items-center justify-between sticky top-0 z-10 border-none rounded-none ${theme === 'dark' ? 'border-b border-white/5' : 'bg-white/50 border-b border-black/5 shadow-sm'}`}>
        <div className="flex items-center gap-2 md:gap-4">
          <button className="p-2 hover:bg-black/10 hover:dark:bg-white/5 rounded-full transition-colors" onClick={() => navigate('/')}>
            <X size={20} />
          </button>
          <h2 className="font-medium text-xs md:text-base max-w-[120px] md:max-w-xs truncate">{book?.title}</h2>
        </div>

          <div className="flex items-center gap-2 md:gap-4">
            
            <button className="p-2 hover:bg-black/10 hover:dark:bg-white/5 rounded-full transition-colors hidden md:block" onClick={toggleTheme}>
              {theme === 'dark' ? <Moon size={20} /> : theme === 'sepia' ? <Coffee size={20} /> : <Sun size={20} />}
            </button>

            <button className="p-2 hover:bg-black/10 hover:dark:bg-white/5 rounded-full transition-colors hidden md:block" onClick={toggleFullscreen}>
              <Maximize2 size={20} />
            </button>

            <button 
              className={`p-2 rounded-lg transition-all flex items-center gap-2 ${isNotesOpen ? 'bg-accent-primary text-white shadow-lg' : 'hover:bg-black/10 hover:dark:bg-white/5 opacity-80'}`}
              onClick={() => setIsNotesOpen(!isNotesOpen)}
            >
              <StickyNote size={20} />
              <span className="hidden md:inline text-sm font-medium">Notlar</span>
            </button>

            <div className={`flex items-center gap-1 md:gap-2 px-2 py-1 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
            <button className="p-1 hover:text-accent-primary" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}>
              <ZoomOut size={16} />
            </button>
            <span className="text-[10px] md:text-xs font-mono w-8 text-center">{Math.round(scale * 100)}%</span>
            <button className="p-1 hover:text-accent-primary" onClick={() => setScale(s => Math.min(2, s + 0.1))}>
              <ZoomIn size={16} />
            </button>
          </div>
          
          <form onSubmit={handleJump} className="hidden lg:flex items-center gap-2 text-sm opacity-80">
            <Search size={16} />
            <input 
              type="number" 
              placeholder={pageNumber.toString()}
              className={`w-14 px-2 py-1 rounded text-center outline-none ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'}`}
              value={jumpStr}
              onChange={e => setJumpStr(e.target.value)}
            />
            <span>/ {numPages}</span>
          </form>
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

      {/* Persistent Bottom Bar (iPad Friendly) */}
      <div className={`h-16 md:h-20 backdrop-blur-xl border-t flex items-center justify-between sticky bottom-0 z-10 px-4 md:px-6 ${theme === 'dark' ? 'bg-black/80 border-white/5' : 'bg-white/80 border-black/5'}`}>
        <button 
          className="btn-secondary px-3 py-2 md:px-4 flex items-center gap-2 disabled:opacity-30 border-none bg-transparent" 
          disabled={pageNumber <= 1}
          onClick={() => changePage(-1)}
        >
          <ChevronLeft size={24} />
          <span className="hidden md:inline font-semibold">Önceki</span>
        </button>

        <div className="flex flex-col items-center gap-1 w-1/2">
          <div className="text-xs md:text-sm font-medium opacity-80">Sayfa {pageNumber} / {numPages}</div>
          <div className={`w-full max-w-[200px] md:max-w-xs progress-bar-container h-1.5 md:h-2 rounded-full ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'}`}>
            <div 
              className="progress-bar-fill h-full rounded-full" 
              style={{ width: `${(pageNumber / (numPages || 1)) * 100}%` }}
            />
          </div>
        </div>

        <button 
          className="btn-secondary px-3 py-2 md:px-4 flex items-center gap-2 disabled:opacity-30 border-none bg-transparent" 
          disabled={pageNumber >= numPages}
          onClick={() => changePage(1)}
        >
          <span className="hidden md:inline font-semibold">Sonraki</span>
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Mobile Tools Overlay */}
      <div className="md:hidden fixed top-20 right-4 flex flex-col gap-2 pointer-events-auto z-20">
         <button className="p-2 rounded-full glass bg-black/40 text-white shadow" onClick={toggleTheme}>
            {theme === 'dark' ? <Moon size={16} /> : theme === 'sepia' ? <Coffee size={16} /> : <Sun size={16} />}
         </button>
         <button className="p-2 rounded-full glass bg-black/40 text-white shadow" onClick={toggleFullscreen}>
            <Maximize2 size={16} />
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
