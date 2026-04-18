import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Book, Clock, Settings, Upload, Share2, LogOut, FileText, ChevronRight, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const Dashboard = () => {
  const [password, setPassword] = useState(localStorage.getItem('appPassword') || '');
  const [tempPass, setTempPass] = useState('');
  const [books, setBooks] = useState([]);
  const [stats, setStats] = useState({ total_minutes: 0, total_books: 0 });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTag, setSelectedTag] = useState('Hepsi');
  const [newTags, setNewTags] = useState('');
  const navigate = useNavigate();

  const masterPassword = import.meta.env.VITE_APP_PASSWORD;

  useEffect(() => {
    if (password === masterPassword) {
      fetchBooks();
      fetchGlobalStats();
    }
  }, [password]);

  const fetchBooks = async () => {
    setLoading(true);
    const libraryId = `lib_${masterPassword}`; 
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('library_code', libraryId)
      .order('last_read', { ascending: false });

    if (error) console.error('Error fetching books:', error);
    else setBooks(data || []);
    setLoading(false);
  };

  const fetchGlobalStats = async () => {
    const { data } = await supabase
      .from('reading_sessions')
      .select('duration_minutes');
    
    const total = data?.reduce((acc, s) => acc + (s.duration_minutes || 0), 0) || 0;
    setStats(prev => ({ ...prev, total_minutes: total }));
  };

  const handleLogin = () => {
    if (tempPass === masterPassword) {
      localStorage.setItem('appPassword', tempPass);
      setPassword(tempPass);
      setError('');
    } else {
      setError('Hatalı şifre! Lütfen tekrar deneyin.');
    }
  };

  const generateCover = async (file) => {
    try {
      const fileUrl = URL.createObjectURL(file);
      const loadingTask = pdfjs.getDocument(fileUrl);
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.0 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      URL.revokeObjectURL(fileUrl);
      return blob;
    } catch (e) {
      console.warn("Cover generation failed:", e);
      return null;
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || password !== masterPassword) return;

    setUploading(true);
    const libraryId = `lib_${masterPassword}`;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${libraryId}/${fileName}`;
    const coverPath = `${libraryId}/cover_${fileName}.jpg`;

    try {
      const [uploadResult, coverBlob] = await Promise.all([
         supabase.storage.from('pdfs').upload(filePath, file),
         generateCover(file)
      ]);

      if (uploadResult.error) throw uploadResult.error;

      const { data: { publicUrl } } = supabase.storage
        .from('pdfs')
        .getPublicUrl(filePath);

      let coverUrl = null;
      if (coverBlob) {
         const { error: coverUploadError } = await supabase.storage.from('pdfs').upload(coverPath, coverBlob);
         if (!coverUploadError) {
             const { data: { publicUrl: cUrl } } = supabase.storage.from('pdfs').getPublicUrl(coverPath);
             coverUrl = cUrl;
         }
      }

      const { error: dbError } = await supabase
        .from('books')
        .insert([{
          library_code: libraryId,
          title: file.name.replace('.pdf', ''),
          file_url: publicUrl,
          storage_path: filePath,
          total_pages: 0,
          cover_url: coverUrl,
          tags: newTags.split(',').map(tag => tag.trim()).filter(Boolean)
        }]);

      if (dbError) throw dbError;
      
      setNewTags('');
      fetchBooks();
    } catch (error) {
      alert('Yükleme hatası: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // Styles
  const styles = {
    container: {
      minHeight: '100vh',
      background: '#05060f',
      color: '#f8fafc',
      paddingBottom: '80px',
      fontFamily: 'Inter, system-ui, sans-serif'
    },
    loginBg: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top right, #1e1b4b, #05060f)',
      padding: '24px'
    },
    glassCard: {
      background: 'rgba(255, 255, 255, 0.03)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '24px',
      padding: '32px',
      width: '100%',
      maxWidth: '400px',
      textAlign: 'center',
      boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
    },
    input: {
      width: '100%',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '14px',
      padding: '16px',
      color: 'white',
      outline: 'none',
      textAlign: 'center',
      fontSize: '18px',
      letterSpacing: '4px',
      marginBottom: '16px',
      transition: 'border-color 0.2s'
    },
    btnPrimary: {
      background: 'linear-gradient(135deg, #6366f1, #a855f7)',
      color: 'white',
      border: 'none',
      borderRadius: '14px',
      padding: '16px 24px',
      fontSize: '16px',
      fontWeight: '700',
      cursor: 'pointer',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      boxShadow: '0 8px 16px rgba(99, 102, 241, 0.3)',
      transition: 'transform 0.2s'
    },
    header: {
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(5, 6, 15, 0.8)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      padding: '16px 24px'
    },
    headerContent: {
      maxWidth: '1200px',
      margin: '0 auto',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '16px'
    },
    section: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '40px 24px'
    },
    featuredCard: {
      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.05))',
      borderRadius: '28px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      padding: '32px',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '32px',
      cursor: 'pointer',
      marginBottom: '48px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
      transition: 'transform 0.3s ease, background 0.3s ease'
    },
    coverArt: {
      width: '120px',
      height: '160px',
      background: 'rgba(255,255,255,0.05)',
      borderRadius: '12px',
      overflow: 'hidden',
      flexShrink: 0,
      boxShadow: '0 12px 24px rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    bookGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: '24px'
    },
    bookCard: {
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: '20px',
      padding: '16px',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    },
    tag: {
      background: 'rgba(255,255,255,0.05)',
      padding: '4px 10px',
      borderRadius: '100px',
      fontSize: '11px',
      fontWeight: '600',
      color: '#94a3b8',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      width: 'fit-content'
    }
  };

  if (password !== masterPassword) {
    return (
      <div style={styles.loginBg}>
        <div style={styles.glassCard}>
          <div style={{ width: '64px', height: '64px', background: 'rgba(99, 102, 241, 0.2)', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <Book style={{ color: '#6366f1' }} size={32} />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px' }}>Umut Kütüphanesi</h1>
          <p style={{ color: '#94a3b8', fontSize: '15px', marginBottom: '32px' }}>Hoş geldiniz, devam etmek için şifrenizi girin.</p>
          
          <input 
            type="password" 
            placeholder="····"
            style={styles.input}
            value={tempPass}
            onChange={(e) => setTempPass(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          {error && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>{error}</p>}
          <button style={styles.btnPrimary} onClick={handleLogin}>
            Kütüphaneye Gir
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', padding: '8px', borderRadius: '10px' }}>
              <Book size={20} color="white" />
            </div>
            <span style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '-0.5px' }}>Library</span>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {uploading && (
              <input 
                type="text" 
                placeholder="Etiketler (virgülle ayırın)" 
                style={{ ...styles.input, marginBottom: 0, width: '200px', fontSize: '13px', padding: '8px 12px' }}
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
              />
            )}
            <label style={{ 
              ...styles.btnPrimary, 
              width: 'auto', 
              padding: '10px 20px', 
              fontSize: '14px',
              opacity: uploading ? 0.9 : 1,
              pointerEvents: uploading && !newTags ? 'none' : 'auto'
            }}>
              <Upload size={18} />
              <span>{uploading ? 'Şimdi Yükle' : 'Kitap Ekle'}</span>
              {!uploading ? (
                <button 
                   onClick={(e) => { e.preventDefault(); setUploading(true); }} 
                   style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} 
                />
              ) : (
                <input type="file" style={{ display: 'none' }} accept=".pdf" onChange={handleFileUpload} />
              )}
            </label>
            <button 
              onClick={() => { localStorage.removeItem('appPassword'); setPassword(''); }}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '10px' }}
            >
              <LogOut size={22} />
            </button>
          </div>
        </div>
      </header>

      <main style={styles.section}>
        {/* WELCOME AREA & STATS */}
        <div style={{ marginBottom: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '24px' }}>
          <div>
            <h2 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px' }}>Merhaba,</h2>
            <p style={{ color: '#94a3b8', fontSize: '16px' }}>Okuma listenizde toplam {books.length} eser bulunuyor.</p>
          </div>
          
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '16px 24px', borderRadius: '20px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              <div style={{ fontSize: '12px', color: '#6366f1', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px' }}>Toplam Okuma</div>
              <div style={{ fontSize: '24px', fontWeight: '800' }}>{Math.floor(stats.total_minutes / 60)}s {stats.total_minutes % 60}dk</div>
            </div>
          </div>
        </div>

        {/* TAG FILTER */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', overflowX: 'auto', paddingBottom: '8px' }}>
          {['Hepsi', ...Array.from(new Set(books.flatMap(b => b.tags || [])))].map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              style={{
                padding: '8px 16px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                background: selectedTag === tag ? '#6366f1' : 'rgba(255,255,255,0.05)',
                color: selectedTag === tag ? 'white' : '#94a3b8',
                fontSize: '13px', fontWeight: '700', transition: 'all 0.2s', whiteSpace: 'nowrap'
              }}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* FEATURED: CONTINUE READING */}
        {!loading && books.length > 0 && books[0].current_page > 1 && (
          <div 
            style={styles.featuredCard}
            onClick={() => navigate(`/reader/${books[0].id}`)}
          >
            <div style={styles.coverArt}>
              {books[0].cover_url ? (
                <img src={books[0].cover_url} style={{ width: '100%', height: '100%', objectCover: 'cover' }} />
              ) : (
                <Book size={40} color="white" style={{ opacity: 0.2 }} />
              )}
            </div>
            
            <div style={{ flex: 1 }}>
              <div style={styles.tag}><Clock size={12} /> OKUMAYA DEVAM ET</div>
              <h3 style={{ fontSize: '24px', fontWeight: '700', margin: '12px 0 8px', lineHeight: '1.2' }}>{books[0].title}</h3>
              <p style={{ color: '#94a3b8', fontSize: '15px', marginBottom: '24px' }}>Sayfa {books[0].current_page} / {books[0].total_pages || '?'}</p>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button style={{ ...styles.btnPrimary, width: 'auto', padding: '10px 24px', borderRadius: '100px' }}>
                   <Play size={16} fill="white" /> Oku
                </button>
                <div style={{ flex: 1, maxWidth: '240px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${(books[0].current_page / (books[0].total_pages || 1)) * 100}%`,
                    background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                    borderRadius: '3px'
                  }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LIBRARY GRID */}
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
           <h4 style={{ fontSize: '20px', fontWeight: '700' }}>Kitaplığım</h4>
           <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
        </div>

        {loading ? (
          <div style={{ padding: '80px', textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>
        ) : books.length === 0 ? (
          <div style={{ padding: '80px 40px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', border: '2px dashed rgba(255,255,255,0.05)', borderRadius: '24px' }}>
            <Book size={48} color="rgba(255,255,255,0.1)" style={{ marginBottom: '16px' }} />
            <p style={{ color: '#64748b' }}>Henüz kitap eklenmemiş. Sağ üstten yeni bir PDF yükleyin.</p>
          </div>
        ) : (
          <div style={styles.bookGrid}>
            {books.filter(b => selectedTag === 'Hepsi' || (b.tags && b.tags.includes(selectedTag))).map(book => (
              <div 
                key={book.id} 
                style={styles.bookCard}
                onClick={() => navigate(`/reader/${book.id}`)}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
              >
                <div style={{ ...styles.coverArt, width: '100%', height: '220px', borderRadius: '14px', position: 'relative' }}>
                  {book.cover_url ? (
                    <img src={book.cover_url} style={{ width: '100%', height: '100%', objectCover: 'cover' }} />
                  ) : (
                    <Book size={32} color="white" style={{ opacity: 0.15 }} />
                  )}
                  {/* Play Overlay */}
                  <div style={{ position: 'absolute', bottom: '12px', right: '12px', background: '#6366f1', padding: '8px', borderRadius: '50%', display: 'flex', boxShadow: '0 4px 12px rgba(99,102,241,0.5)' }}>
                     <Play size={14} fill="white" />
                  </div>
                </div>
                
                <div style={{ padding: '4px' }}>
                  <h5 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px', lineHeight: '1.4', lineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {book.title}
                  </h5>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {book.tags?.map(t => (
                      <span key={t} style={{ fontSize: '9px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>#{t}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                     <span style={{ fontSize: '12px', fontWeight: '700', color: '#6366f1' }}>% {Math.round((book.current_page / (book.total_pages || 1)) * 100)}</span>
                     <span style={{ fontSize: '11px', color: '#64748b' }}>{book.total_pages || '?'} Sayfa</span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${(book.current_page / (book.total_pages || 1)) * 100}%`,
                      background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                      borderRadius: '2px'
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
