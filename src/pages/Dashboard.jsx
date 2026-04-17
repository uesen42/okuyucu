import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Book, Clock, Settings, Upload, Share2, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [libraryCode, setLibraryCode] = useState(localStorage.getItem('libraryCode') || '');
  const [tempCode, setTempCode] = useState('');
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (libraryCode) {
      fetchBooks();
    }
  }, [libraryCode]);

  const fetchBooks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('library_code', libraryCode)
      .order('last_read', { ascending: false });

    if (error) console.error('Error fetching books:', error);
    else setBooks(data || []);
    setLoading(false);
  };

  const handleJoinLibrary = () => {
    if (tempCode.trim()) {
      localStorage.setItem('libraryCode', tempCode.trim());
      setLibraryCode(tempCode.trim());
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !libraryCode) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${libraryCode}/${fileName}`;

    try {
      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('pdfs')
        .getPublicUrl(filePath);

      // 3. Save to Database
      const { error: dbError } = await supabase
        .from('books')
        .insert([{
          library_code: libraryCode,
          title: file.name.replace('.pdf', ''),
          file_url: publicUrl,
          storage_path: filePath,
          total_pages: 0 // Will be updated when opened
        }]);

      if (dbError) throw dbError;
      
      fetchBooks();
    } catch (error) {
      alert('Yükleme hatası: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  if (!libraryCode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-primary">
        <div className="glass p-8 w-full max-w-md animate-fade-in text-center">
          <Book className="w-16 h-16 text-accent-primary mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-2">PDF Takip</h1>
          <p className="text-text-secondary mb-8">Kütüphanenize erişmek için bir kod girin.</p>
          
          <div className="flex flex-col gap-4">
            <input 
              type="text" 
              placeholder="Kütüphane Kodu (örn: umut-okuma)"
              className="bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-accent-primary"
              value={tempCode}
              onChange={(e) => setTempCode(e.target.value)}
            />
            <button className="btn-primary w-full justify-center py-4" onClick={handleJoinLibrary}>
              Kütüphaneye Gir
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-bold mb-2">Kütüphanem</h1>
          <div className="flex items-center gap-2 text-text-secondary glass px-3 py-1 text-sm bg-white/5">
            <Share2 size={14} />
            <span>Kod: <strong>{libraryCode}</strong></span>
          </div>
        </div>
        
        <div className="flex gap-4">
          <label className="btn-primary cursor-pointer">
            <Upload size={20} />
            {uploading ? 'Yükleniyor...' : 'Yeni Kitap Ekle'}
            <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} disabled={uploading} />
          </label>
          <button className="btn-secondary" onClick={() => {
            localStorage.removeItem('libraryCode');
            setLibraryCode('');
          }}>
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-20 text-text-secondary">Yükleniyor...</div>
      ) : books.length === 0 ? (
        <div className="glass p-20 text-center border-dashed border-2 border-white/5">
          <p className="text-text-secondary">Henüz kitap yok. Başlamak için bir PDF yükleyin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {books.map((book) => (
            <div 
              key={book.id} 
              className="glass-card p-6 flex flex-col gap-4 cursor-pointer"
              onClick={() => navigate(`/reader/${book.id}`)}
            >
              <div className="aspect-[3/4] bg-white/5 rounded-lg flex items-center justify-center">
                <Book size={48} className="text-white/20" />
              </div>
              <div>
                <h3 className="font-semibold text-lg line-clamp-1">{book.title}</h3>
                <p className="text-text-secondary text-sm">Sayfa {book.current_page} / {book.total_pages || '?'}</p>
              </div>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${(book.current_page / (book.total_pages || 1)) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
