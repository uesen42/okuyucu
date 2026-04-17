import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { supabase } from '../lib/supabase';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, X, Sun, Moon, Coffee, Search, StickyNote } from 'lucide-react';
import NotesDrawer from '../components/NotesDrawer';

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
  const [containerWidth, setContainerWidth] = useState(600);

  useEffect(() => {
    fetchBook();
    const updateWidth = () => {
      const padding = window.innerWidth < 768 ? 32 : 80;
      setContainerWidth(Math.min(Math.max(window.innerWidth - padding, 280), 960));
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [bookId]);

  const fetchBook = async () => {
    const { data, error } = await supabase
      .from('books').select('*').eq('id', bookId).single();
    if (error) { console.error(error); navigate('/'); }
    else { setBook(data); setPageNumber(data.current_page || 1); setLoading(false); }
  };

  const syncProgress = async (newPage) => {
    await supabase.from('books').update({
      current_page: newPage,
      last_read: new Date().toISOString()
    }).eq('id', bookId);
  };

  useEffect(() => {
    if (!loading && book) {
      const t = setTimeout(() => syncProgress(pageNumber), 1000);
      return () => clearTimeout(t);
    }
  }, [pageNumber, book, loading]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    if (book && book.total_pages === 0)
      supabase.from('books').update({ total_pages: numPages }).eq('id', bookId).then();
  };

  const changePage = (offset) => {
    setPageNumber(p => Math.min(Math.max(1, p + offset), numPages));
    setJumpStr('');
  };

  const handleJump = (e) => {
    e.preventDefault();
    const t = parseInt(jumpStr);
    if (!isNaN(t) && t >= 1 && t <= numPages) setPageNumber(t);
    setJumpStr('');
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'sepia' : theme === 'sepia' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('readerTheme', next);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  const bgColor = theme === 'dark' ? '#05060f' : theme === 'sepia' ? '#f4ecd8' : '#f1f5f9';
  const textColor = theme === 'dark' ? '#f8fafc' : theme === 'sepia' ? '#5b4636' : '#1e293b';
  const barBg = theme === 'dark' ? 'rgba(5,6,15,0.92)' : theme === 'sepia' ? 'rgba(244,236,216,0.92)' : 'rgba(241,245,249,0.92)';
  const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const controlBg = theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#05060f', color: '#94a3b8' }}>
      Kitap yükleniyor...
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: bgColor, color: textColor, transition: 'background 0.4s, color 0.4s' }}>

      {/* ── TOP BAR ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px',
        padding: '10px 16px',
        background: barBg, backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${borderColor}`,
      }}>
        {/* Left: Back + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: '1 1 150px' }}>
          <button onClick={() => navigate('/')} style={iconBtnStyle}>
            <X size={20} />
          </button>
          <span style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
            {book?.title}
          </span>
        </div>

        {/* Right: Tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', flex: '0 0 auto' }}>
          {/* Zoom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: controlBg, borderRadius: '10px', padding: '4px 8px' }}>
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} style={iconBtnStyle}><ZoomOut size={16} /></button>
            <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', minWidth: '36px', textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(2.5, s + 0.1))} style={iconBtnStyle}><ZoomIn size={16} /></button>
          </div>

          {/* Jump to page */}
          <form onSubmit={handleJump} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: controlBg, borderRadius: '10px', padding: '4px 8px' }}>
            <Search size={14} style={{ opacity: 0.6 }} />
            <input
              type="number"
              value={jumpStr}
              onChange={e => setJumpStr(e.target.value)}
              placeholder={String(pageNumber)}
              style={{
                width: '44px', background: 'transparent', border: 'none', outline: 'none',
                color: textColor, fontSize: '13px', fontWeight: 700, textAlign: 'center'
              }}
            />
            <span style={{ fontSize: '12px', opacity: 0.5 }}>/ {numPages}</span>
          </form>

          {/* Theme */}
          <button onClick={toggleTheme} style={iconBtnStyle} title="Tema Değiştir">
            {theme === 'dark' ? <Moon size={18} /> : theme === 'sepia' ? <Coffee size={18} /> : <Sun size={18} />}
          </button>

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} style={iconBtnStyle} title="Tam Ekran">
            <Maximize2 size={18} />
          </button>

          {/* Notes */}
          <button
            onClick={() => setIsNotesOpen(!isNotesOpen)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '13px',
              background: isNotesOpen ? 'linear-gradient(135deg, #6366f1, #a855f7)' : controlBg,
              color: isNotesOpen ? 'white' : textColor,
              transition: 'all 0.2s',
            }}
          >
            <StickyNote size={16} />
            <span>Notlar</span>
          </button>
        </div>
      </div>

      {/* ── PDF AREA ── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '20px 16px' }}>
        <div style={{ boxShadow: theme === 'dark' ? '0 8px 48px rgba(0,0,0,0.7)' : '0 4px 24px rgba(0,0,0,0.15)', borderRadius: '4px', overflow: 'hidden' }}>
          <Document
            file={book?.file_url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div style={{ padding: '40px 20px', color: '#94a3b8', textAlign: 'center' }}>PDF yükleniyor...</div>}
            error={<div style={{ padding: '40px 20px', color: '#ef4444', textAlign: 'center', fontWeight: 600 }}>PDF yüklenemedi.</div>}
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              width={containerWidth}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>
        </div>
      </div>

      {/* ── BOTTOM BAR ── */}
      <div style={{
        position: 'sticky', bottom: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        padding: '12px 20px',
        background: barBg, backdropFilter: 'blur(16px)',
        borderTop: `1px solid ${borderColor}`,
      }}>
        <button
          onClick={() => changePage(-1)}
          disabled={pageNumber <= 1}
          style={{ ...navBtnStyle, opacity: pageNumber <= 1 ? 0.3 : 1, background: controlBg, color: textColor }}
        >
          <ChevronLeft size={20} />
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Önceki</span>
        </button>

        <div style={{ flex: 1, maxWidth: '280px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, opacity: 0.6, marginBottom: '6px', letterSpacing: '0.05em' }}>
            SAYFA {pageNumber} / {numPages}
          </div>
          <div style={{ height: '6px', background: 'rgba(128,128,128,0.2)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(pageNumber / (numPages || 1)) * 100}%`,
              background: 'linear-gradient(90deg, #6366f1, #a855f7)',
              borderRadius: '3px',
              transition: 'width 0.4s ease'
            }} />
          </div>
        </div>

        <button
          onClick={() => changePage(1)}
          disabled={pageNumber >= numPages}
          style={{ ...navBtnStyle, opacity: pageNumber >= numPages ? 0.3 : 1, background: controlBg, color: textColor }}
        >
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Sonraki</span>
          <ChevronRight size={20} />
        </button>
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

const iconBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'inherit', padding: '6px', borderRadius: '8px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  opacity: 0.8, transition: 'opacity 0.2s',
};

const navBtnStyle = {
  display: 'flex', alignItems: 'center', gap: '6px',
  padding: '10px 18px', borderRadius: '12px', border: 'none', cursor: 'pointer',
  transition: 'all 0.2s', fontFamily: 'inherit',
};

export default Reader;
