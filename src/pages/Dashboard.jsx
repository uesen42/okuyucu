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
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const masterPassword = import.meta.env.VITE_APP_PASSWORD;

  useEffect(() => {
    if (password === masterPassword) {
      fetchBooks();
    }
  }, [password]);

  const fetchBooks = async () => {
    setLoading(true);
    // Use the password (or a derivative) as the library_code to keep data segmented but private
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
      const viewport = page.getViewport({ scale: 1.0 }); // Adjust resolution if needed
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
          cover_url: coverUrl
        }]);

      if (dbError) throw dbError;
      
      fetchBooks();
    } catch (error) {
      alert('Yükleme hatası: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  if (password !== masterPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-primary">
        <div className="glass p-8 w-full max-w-md animate-fade-in text-center">
          <div className="w-16 h-16 bg-accent-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Book className="w-8 h-8 text-accent-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Umut PDF</h1>
          <p className="text-text-secondary mb-8">Devam etmek için ana şifrenizi girin.</p>
          
          <div className="flex flex-col gap-4">
            <input 
              type="password" 
              placeholder="Şifreyi Girin"
              className="bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-accent-primary text-center tracking-widest"
              value={tempPass}
              onChange={(e) => setTempPass(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button className="btn-primary w-full justify-center py-4" onClick={handleLogin}>
              Giriş Yap
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-12 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2 tracking-tight">Kütüphanem</h1>
          <p className="text-text-secondary">Hoş geldin! Toplam {books.length} kitabın var.</p>
        </div>
        
        <div className="flex gap-4">
          <label className={`btn-primary cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload size={20} />
            {uploading ? 'Yükleniyor...' : 'Yeni Kitap Ekle'}
            <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} disabled={uploading} />
          </label>
          <button className="btn-secondary px-4 glass border-white/10" onClick={() => {
            localStorage.removeItem('appPassword');
            setPassword('');
          }}>
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Featured Book (Continue Reading) */}
      {!loading && books.length > 0 && books[0].current_page > 1 && (
        <div className="mb-12">
           <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Clock size={20} className="text-accent-primary" /> Okumaya Devam Et</h2>
           <div 
             className="glass-card flex flex-col md:flex-row items-center gap-6 p-6 md:p-8 cursor-pointer relative overflow-hidden group"
             onClick={() => navigate(`/reader/${books[0].id}`)}
           >
              {/* Animated Background glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-accent-primary/10 to-accent-secondary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"/>
              
              <div className="w-24 md:w-32 aspect-[3/4] bg-white/5 rounded-lg flex-shrink-0 shadow-xl overflow-hidden flex items-center justify-center relative z-10">
                {books[0].cover_url ? (
                   <img src={books[0].cover_url} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                   <Book size={48} className="text-white/20" />
                )}
              </div>
              
              <div className="flex-1 text-center md:text-left z-10 w-full relative">
                 <div className="inline-flex items-center gap-1 px-3 py-1 bg-white/5 rounded-full text-xs text-text-secondary mb-3">
                   <FileText size={12}/>
                   <span>PDF Belgesi</span>
                 </div>
                 <h3 className="text-2xl font-bold mb-2 line-clamp-2 leading-tight">{books[0].title}</h3>
                 <p className="text-text-secondary mb-6">Kaldığın sayfa: <span className="text-white font-medium">{books[0].current_page}</span> / {books[0].total_pages || '?'}</p>
                 
                 <div className="flex items-center gap-4">
                    <button className="btn-primary py-2 px-6 rounded-full inline-flex"><Play size={16} fill="white" className="mr-2"/> Devam Et</button>
                    <div className="flex-1 max-w-sm progress-bar-container bg-white/5 h-2">
                      <div 
                        className="progress-bar-fill rounded-full" 
                        style={{ width: `${(books[0].current_page / (books[0].total_pages || 1)) * 100}%` }}
                      />
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Grid */}
      <div>
         <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Book size={20} className="text-text-secondary" /> Tüm Kitaplar</h2>

      {loading ? (
        <div className="text-center py-20 text-text-secondary w-full h-40 glass flex items-center justify-center">Kütüphane yükleniyor...</div>
      ) : books.length === 0 ? (
        <div className="glass p-20 text-center border-dashed border-2 border-white/5 flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center"><Book className="text-white/20"/></div>
          <p className="text-text-secondary">Kütüphaneniz şu an boş. Eklemek için yükleyin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {books.map((book) => (
            <div 
              key={book.id} 
              className="glass-card p-4 md:p-5 flex flex-col gap-4 cursor-pointer group"
              onClick={() => navigate(`/reader/${book.id}`)}
            >
              <div className="aspect-[3/4] bg-white/5 rounded-lg flex items-center justify-center overflow-hidden shadow-inner relative">
                {book.cover_url ? (
                   <img src={book.cover_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                   <Book size={32} className="text-white/20" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <div className="bg-white/20 backdrop-blur-md p-3 rounded-full text-white"><Play size={20} fill="white"/></div>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-between">
                <h3 className="font-semibold text-sm md:text-base line-clamp-2 leading-snug mb-2">{book.title}</h3>
                <div className="mt-auto">
                   <div className="flex justify-between text-xs text-text-secondary mb-1">
                     <span>% {Math.round((book.current_page / (book.total_pages || 1)) * 100)}</span>
                     <span>{book.total_pages ? book.total_pages + ' syf' : ''}</span>
                   </div>
                   <div className="progress-bar-container bg-white/5 h-1.5 rounded-full">
                     <div 
                       className="progress-bar-fill rounded-full" 
                       style={{ width: `${(book.current_page / (book.total_pages || 1)) * 100}%` }}
                     />
                   </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
};

export default Dashboard;
