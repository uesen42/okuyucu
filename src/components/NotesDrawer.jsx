import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { X, StickyNote, History } from 'lucide-react';

const NotesDrawer = ({ isOpen, onClose, bookId, pageNumber }) => {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isOpen && bookId && pageNumber) {
      fetchNote();
    }
  }, [isOpen, bookId, pageNumber]);

  const fetchNote = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('notes')
      .select('content')
      .eq('book_id', bookId)
      .eq('page_number', pageNumber)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching note:', error);
    } else {
      setNote(data?.content || '');
    }
    setLoading(false);
  };

  const saveNote = async (content) => {
    if (!bookId) return;
    setSaving(true);
    const { error } = await supabase
      .from('notes')
      .upsert({
        book_id: bookId,
        page_number: pageNumber,
        content: content,
        updated_at: new Date().toISOString()
      }, { onConflict: 'book_id, page_number' });

    if (error) console.error('Error saving note:', error);
    setSaving(false);
  };

  useEffect(() => {
    if (loading || !isOpen) return;
    const timer = setTimeout(() => {
      saveNote(note);
    }, 1000);
    return () => clearTimeout(timer);
  }, [note]);

  if (!isOpen) return null;

  const isMobile = windowWidth < 768;

  const styles = {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'flex-end',
      pointerEvents: 'none'
    },
    backdrop: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
      pointerEvents: 'auto',
    },
    drawer: {
      width: isMobile ? '100%' : '400px',
      height: '100%',
      background: 'rgba(5, 6, 15, 0.98)',
      backdropFilter: 'blur(30px)',
      borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      zIndex: 10000,
      pointerEvents: 'auto',
      boxShadow: '-20px 0 50px rgba(0,0,0,0.6)',
      animation: 'slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
    },
    header: {
      padding: '24px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    iconBox: {
      padding: '10px',
      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
      color: '#a855f7',
      borderRadius: '12px',
      display: 'flex'
    },
    contentArea: {
      padding: '24px',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    },
    textarea: {
      flex: 1,
      background: 'rgba(255, 255, 255, 0.04)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '20px',
      padding: '20px',
      color: '#f8fafc',
      fontSize: '16px',
      lineHeight: '1.7',
      resize: 'none',
      outline: 'none',
      fontFamily: 'Inter, system-ui, sans-serif',
      transition: 'all 0.3s ease',
      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
    },
    status: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 8px'
    },
    saveBadge: {
       display: 'flex', 
       alignItems: 'center', 
       gap: '8px', 
       fontSize: '11px', 
       fontWeight: 800, 
       color: saving ? '#fbbf24' : '#10b981',
       textTransform: 'uppercase', 
       letterSpacing: '0.1em'
    },
    footer: {
      padding: '24px',
      background: 'rgba(255, 255, 255, 0.03)',
      fontSize: '12px',
      color: '#64748b',
      textAlign: 'center',
      lineHeight: '1.5',
      borderTop: '1px solid rgba(255, 255, 255, 0.05)'
    }
  };

  const drawerContent = (
    <div style={styles.overlay}>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
      <div style={styles.backdrop} onClick={onClose} />
      <div style={styles.drawer}>
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={styles.iconBox}><StickyNote size={24} /></div>
            <div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'white' }}>Notlarım</h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>Sayfa {pageNumber}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{ 
              padding: '10px', background: 'rgba(255,255,255,0.05)', border: 'none', 
              color: 'white', cursor: 'pointer', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={styles.contentArea}>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              Notlar yükleniyor...
            </div>
          ) : (
            <>
              <textarea
                style={styles.textarea}
                placeholder="Bu sayfa için önemli notlarını buraya bırak..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onFocus={(e) => {
                  e.target.style.borderColor = '#6366f1';
                  e.target.style.background = 'rgba(255,255,255,0.06)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.15)';
                  e.target.style.background = 'rgba(255,255,255,0.04)';
                }}
              />
              <div style={styles.status}>
                <div style={styles.saveBadge}>
                  <div style={{ 
                    width: '8px', height: '8px', borderRadius: '50%', 
                    background: saving ? '#fbbf24' : '#10b981',
                    boxShadow: saving ? '0 0 10px #fbbf24' : '0 0 10px #10b981'
                  }} />
                  {saving ? 'Kaydediliyor...' : 'Bulutla Senkronize'}
                </div>
                <button style={{ 
                  background: 'transparent', border: 'none', color: '#64748b', 
                  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', 
                  fontWeight: 600, cursor: 'pointer', hover: { color: 'white' }
                }}>
                  <History size={14} /> Geçmiş
                </button>
              </div>
            </>
          )}
        </div>

        <div style={styles.footer}>
          Notlarınız iPad ve PC'niz arasında <br/> 
          <span style={{ color: '#94a3b8' }}>otomatik olarak senkronize edilir.</span>
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
};

export default NotesDrawer;
