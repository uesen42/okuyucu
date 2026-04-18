import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { supabase } from '../lib/supabase';
import { 
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, X, Sun, Moon, 
  Coffee, Search, StickyNote, Pencil, Eraser, Trash2, Palette, Grid, List 
} from 'lucide-react';
import NotesDrawer from '../components/NotesDrawer';
import DrawingLayer from '../components/DrawingLayer';

const ReaderSidebar = ({ isOpen, onClose, numPages, onJump, bookId, containerWidth, theme }) => {
  const [activeTab, setActiveTab] = useState('thumbnails'); // 'thumbnails' | 'all-notes'
  const [allNotes, setAllNotes] = useState([]);

  useEffect(() => {
    if (isOpen && activeTab === 'all-notes') {
      fetchBookNotes();
    }
  }, [isOpen, activeTab]);

  const fetchBookNotes = async () => {
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('book_id', bookId)
      .order('page_number', { ascending: true });
    setAllNotes(data || []);
  };

  if (!isOpen) return null;

  const styles = {
    overlay: { position: 'fixed', inset: 0, zIndex: 2000, display: 'flex' },
    backdrop: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' },
    sidebar: {
      width: '320px', height: '100%', background: theme === 'dark' ? '#0a0b1e' : '#f8fafc',
      borderRight: '1px solid rgba(255,255,255,0.1)', position: 'relative', zIndex: 10,
      display: 'flex', flexDirection: 'column', boxShadow: '10px 0 30px rgba(0,0,0,0.3)',
      animation: 'slideInLeft 0.3s ease'
    },
    header: { padding: '20px', borderBottom: '1px solid rgba(128,128,128,0.1)', display: 'flex', gap: '8px' },
    tabBtn: (active) => ({
      flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
      background: active ? '#6366f1' : 'transparent', color: active ? 'white' : '#64748b'
    }),
    scrollArea: { flex: 1, overflowY: 'auto', padding: '16px' }
  };

  return (
    <div style={styles.overlay}>
      <style>{`@keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }`}</style>
      <div style={styles.backdrop} onClick={onClose} />
      <div style={styles.sidebar}>
        <div style={styles.header}>
          <button style={styles.tabBtn(activeTab === 'thumbnails')} onClick={() => setActiveTab('thumbnails')}><Grid size={18} /> Önizleme</button>
          <button style={styles.tabBtn(activeTab === 'all-notes')} onClick={() => setActiveTab('all-notes')}><List size={18} /> Tüm Notlar</button>
        </div>

        <div style={styles.scrollArea}>
          {activeTab === 'thumbnails' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {Array.from({ length: numPages }).map((_, i) => (
                <div key={i} onClick={() => { onJump(i + 1); onClose(); }} style={{ cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ aspectRatio: '0.7', background: 'rgba(128,128,128,0.1)', borderRadius: '4px', overflow: 'hidden', border: '1px solid transparent' }} 
                       onMouseEnter={(e) => e.target.style.borderColor = '#6366f1'}>
                    <Page pageNumber={i + 1} width={130} renderTextLayer={false} renderAnnotationLayer={false} />
                  </div>
                  <span style={{ fontSize: '10px', opacity: 0.6 }}>{i + 1}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {allNotes.length === 0 ? <p style={{ textAlign: 'center', opacity: 0.5 }}>Henüz not yok.</p> :
               allNotes.map(n => (
                <div key={n.id} onClick={() => { onJump(n.page_number); onClose(); }} 
                     style={{ padding: '12px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', cursor: 'pointer' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#6366f1', marginBottom: '4px' }}>SAYFA {n.page_number}</div>
                  <div style={{ fontSize: '13px', opacity: 0.8, whiteSpace: 'pre-wrap' }}>{n.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const Reader = () => {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('readerTheme') || 'dark');
  const [jumpStr, setJumpStr] = useState('');
  const [containerWidth, setContainerWidth] = useState(600);
  const [pageDimensions, setPageDimensions] = useState({ width: 600, height: 848 });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sessionStartTime] = useState(Date.now());

  // Drawing States
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [brushColor, setBrushColor] = useState('#6366f1');
  const [brushSize, setBrushSize] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const [drawingData, setDrawingData] = useState(null);

  const colors = ['#6366f1', '#f43f5e', '#10b981', '#fbbf24', '#f8fafc', '#000000'];

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

  useEffect(() => {
    if (bookId && pageNumber) {
      fetchDrawingData();
    }
  }, [bookId, pageNumber]);

  const fetchBook = async () => {
    const { data, error } = await supabase
      .from('books').select('*').eq('id', bookId).single();
    if (error) { console.error(error); navigate('/'); }
    else { setBook(data); setPageNumber(data.current_page || 1); setLoading(false); }
  };

  const fetchDrawingData = async () => {
    const { data } = await supabase
      .from('notes')
      .select('drawing_data')
      .eq('book_id', bookId)
      .eq('page_number', pageNumber)
      .maybeSingle();
    setDrawingData(data?.drawing_data || null);
  };

  const syncProgress = async (newPage) => {
    await supabase.from('books').update({
      current_page: newPage,
      last_read: new Date().toISOString()
    }).eq('id', bookId);
  };

  const saveDrawing = async (newData) => {
    await supabase.from('notes').upsert({
      book_id: bookId,
      page_number: pageNumber,
      drawing_data: newData,
      updated_at: new Date().toISOString()
    }, { onConflict: 'book_id, page_number' });
  };

  useEffect(() => {
    if (!loading && book) {
      const t = setTimeout(() => syncProgress(pageNumber), 1000);
      return () => clearTimeout(t);
    }
  }, [pageNumber, book, loading]);

  useEffect(() => {
    // Record reading session duration on unmount or every 2 mins
    const recordSession = async () => {
      const duration = Math.round((Date.now() - sessionStartTime) / 60000);
      if (duration > 0) {
        await supabase.from('reading_sessions').insert({
          book_id: bookId,
          duration_minutes: duration
        });
      }
    };

    const interval = setInterval(recordSession, 120000); // Pulse every 2 mins
    return () => {
      clearInterval(interval);
      recordSession();
    };
  }, [bookId, sessionStartTime]);

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

  // Styles
  const bgColor = theme === 'dark' ? '#05060f' : theme === 'sepia' ? '#f4ecd8' : '#f1f5f9';
  const textColor = theme === 'dark' ? '#f8fafc' : theme === 'sepia' ? '#5b4636' : '#1e293b';
  const barBg = theme === 'dark' ? 'rgba(5,6,15,0.95)' : theme === 'sepia' ? 'rgba(244,236,216,0.95)' : 'rgba(241,245,249,0.95)';
  const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const controlBg = theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';

  const iconBtnStyle = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'inherit', padding: '8px', borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s',
  };

  const styles = {
    canvasWrapper: {
      position: 'relative',
      display: 'inline-block',
      margin: '0 auto',
      boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
      background: 'white'
    }
  };

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#05060f', color: '#94a3b8' }}>Kitap yükleniyor...</div>;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: bgColor, color: textColor, transition: 'background 0.4s' }}>

      {/* ── TOP BAR ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px',
        background: barBg, backdropFilter: 'blur(20px)', borderBottom: `1px solid ${borderColor}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <button onClick={() => navigate('/')} style={iconBtnStyle}><X size={24} /></button>
          <span style={{ fontWeight: 800, fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{book?.title}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Drawing Toggle */}
          <button 
            onClick={() => setIsDrawingMode(!isDrawingMode)} 
            style={{ 
              ...iconBtnStyle, 
              background: isDrawingMode ? '#6366f1' : controlBg, 
              color: isDrawingMode ? 'white' : 'inherit',
              boxShadow: isDrawingMode ? '0 0 15px rgba(99,102,241,0.4)' : 'none'
            }}
          >
            <Pencil size={20} />
          </button>

          <button onClick={toggleTheme} style={{ ...iconBtnStyle, background: controlBg }}>
            {theme === 'dark' ? <Moon size={20} /> : theme === 'sepia' ? <Coffee size={20} /> : <Sun size={20} />}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: controlBg, borderRadius: '12px', padding: '4px 10px' }}>
            <button onClick={() => setScale(s => Math.max(0.4, s - 0.1))} style={iconBtnStyle}><ZoomOut size={16} /></button>
            <span style={{ fontSize: '12px', fontWeight: 800, fontFamily: 'monospace', minWidth: '35px', textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(3, s + 0.1))} style={iconBtnStyle}><ZoomIn size={16} /></button>
          </div>

          <button 
            onClick={() => setIsNotesOpen(!isNotesOpen)} 
            style={{ 
              ...iconBtnStyle, 
              background: isNotesOpen ? '#a855f7' : controlBg, 
              color: isNotesOpen ? 'white' : 'inherit' 
            }}
          >
            <StickyNote size={20} />
          </button>

          <button 
            onClick={() => setIsSidebarOpen(true)}
            style={{ ...iconBtnStyle, background: controlBg }}
          >
            <Grid size={20} />
          </button>
        </div>
      </div>

      {/* ── DRAWING TOOLBAR (Floating) ── */}
      {isDrawingMode && (
        <div 
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', left: '50%', transform: 'translateX(-50%)', top: '75px', zIndex: 1000,
            background: 'rgba(5, 6, 15, 0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '24px', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '20px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)', animation: 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
           <style>{`@keyframes slideDown { from { transform: translate(-50%, -20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }`}</style>
          
           {/* Color Swatches */}
           <div style={{ display: 'flex', gap: '8px' }}>
             {colors.map(c => (
               <button 
                key={c}
                onClick={() => { setBrushColor(c); setIsEraser(false); }}
                style={{
                  width: '26px', height: '26px', borderRadius: '50%', background: c, 
                  border: brushColor === c && !isEraser ? '2px solid white' : '2px solid transparent',
                  cursor: 'pointer', boxSizing: 'border-box', boxShadow: brushColor === c && !isEraser ? `0 0 10px ${c}` : 'none',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.transform = 'scale(1.15)'}
                onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
               />
             ))}
           </div>

           <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />

           {/* Size Selection */}
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             {[3, 7, 14].map(size => (
               <button
                 key={size}
                 onClick={() => setBrushSize(size)}
                 style={{
                   background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                   display: 'flex', alignItems: 'center', justifyContent: 'center',
                   opacity: brushSize === size ? 1 : 0.4, transition: 'opacity 0.2s'
                 }}
               >
                 <div style={{ 
                   width: `${size + 4}px`, height: `${size + 4}px`, 
                   borderRadius: '50%', background: 'white' 
                 }} />
               </button>
             ))}
           </div>

           <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />

           <div style={{ display: 'flex', gap: '8px' }}>
             <button 
               onClick={() => setIsEraser(false)} 
               style={{ ...iconBtnStyle, color: !isEraser ? '#6366f1' : 'white', opacity: !isEraser ? 1 : 0.5, background: !isEraser ? 'rgba(99, 102, 241, 0.1)' : 'transparent' }}
             >
               <Pencil size={20} />
             </button>
             <button 
               onClick={() => setIsEraser(true)} 
               style={{ ...iconBtnStyle, color: isEraser ? '#6366f1' : 'white', opacity: isEraser ? 1 : 0.5, background: isEraser ? 'rgba(99, 102, 241, 0.1)' : 'transparent' }}
             >
               <Eraser size={20} />
             </button>
           </div>

           <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />

           <button 
             onClick={() => { if(window.confirm('Tüm çizimleri temizle?')) { setDrawingData('[]'); saveDrawing('[]'); }}}
             style={{ ...iconBtnStyle, color: '#f43f5e' }}
           >
             <Trash2 size={18} />
           </button>
        </div>
      )}

      {/* ── PDF AREA ── */}
      <div style={{ 
        flex: 1, overflow: 'auto', display: 'flex', 
        justifyContent: scale > 1 ? 'flex-start' : 'center', 
        alignItems: 'flex-start', padding: '40px 16px',
        WebkitOverflowScrolling: 'touch'
      }}>
        <div style={{ 
          position: 'relative',
          boxShadow: theme === 'dark' ? '0 20px 60px rgba(0,0,0,0.8)' : '0 10px 30px rgba(0,0,0,0.1)', 
          borderRadius: '4px', background: 'white', minWidth: 'fit-content'
        }}>
          <Document
            file={book?.file_url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div style={{ padding: '40px', textAlign: 'center' }}>Yükleniyor...</div>}
          >
            <div ref={containerRef} style={{ ...styles.canvasWrapper, cursor: isDrawingMode ? 'crosshair' : 'default' }}>
              <Page 
                pageNumber={pageNumber} 
                width={containerWidth * scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                onLoadSuccess={(page) => setPageDimensions({ width: page.width, height: page.height })}
              />
              
              {/* Handwriting Overlay */}
              {numPages > 0 && pageDimensions.width > 0 && (
                <DrawingLayer
                  width={containerWidth * scale}
                  height={(containerWidth * scale) * (pageDimensions.height / pageDimensions.width)}
                  isActive={isDrawingMode}
                  color={brushColor}
                  brushSize={isEraser ? brushSize * 4 : brushSize}
                  isEraser={isEraser}
                  initialData={drawingData}
                  onSave={saveDrawing}
                />
              )}
            </div>

            {/* Sidebar moved inside Document to provide PDF context */}
            <ReaderSidebar 
              isOpen={isSidebarOpen} 
              onClose={() => setIsSidebarOpen(false)} 
              numPages={numPages}
              onJump={(p) => setPageNumber(p)}
              bookId={bookId}
              containerWidth={containerWidth}
              theme={theme}
            />
          </Document>
        </div>
      </div>

      {/* ── BOTTOM BAR ── */}
      <div style={{
        position: 'sticky', bottom: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 24px',
        background: barBg, backdropFilter: 'blur(20px)', borderTop: `1px solid ${borderColor}`
      }}>
        <button
          onClick={() => changePage(-1)}
          disabled={pageNumber <= 1}
          style={{ ...navBtnStyle, opacity: pageNumber <= 1 ? 0.3 : 1, background: controlBg, color: textColor }}
        >
          <ChevronLeft size={20} /> <span>Geri</span>
        </button>

        <div style={{ flex: 1, maxWidth: '300px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, opacity: 0.6, marginBottom: '8px', letterSpacing: '0.1em' }}>
            SAYFA {pageNumber} / {numPages}
          </div>
          <div style={{ height: '6px', background: 'rgba(128,128,128,0.15)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${(pageNumber / (numPages || 1)) * 100}%`,
              background: 'linear-gradient(90deg, #6366f1, #a855f7)', borderRadius: '3px', transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        <button
          onClick={() => changePage(1)}
          disabled={pageNumber >= numPages}
          style={{ ...navBtnStyle, opacity: pageNumber >= numPages ? 0.3 : 1, background: controlBg, color: textColor }}
        >
          <span>İleri</span> <ChevronRight size={20} />
        </button>
      </div>

      <NotesDrawer isOpen={isNotesOpen} onClose={() => setIsNotesOpen(false)} bookId={bookId} pageNumber={pageNumber} />
    </div>
  );
};

const navBtnStyle = {
  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '14px', border: 'none', cursor: 'pointer', fontWeight: 700
};

export default Reader;
