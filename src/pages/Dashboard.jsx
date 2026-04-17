import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Book, Clock, Settings, Upload, Share2, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || password !== masterPassword) return;

    setUploading(true);
    const libraryId = `lib_${masterPassword}`;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${libraryId}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('pdfs')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('books')
        .insert([{
          library_code: libraryId,
          title: file.name.replace('.pdf', ''),
          file_url: publicUrl,
          storage_path: filePath,
          total_pages: 0
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-bold mb-2">Kütüphanem</h1>
          <p className="text-text-secondary">Hoş geldin! Okumaya devam et.</p>
        </div>
        
        <div className="flex gap-4">
          <label className="btn-primary cursor-pointer">
            <Upload size={20} />
            {uploading ? 'Yükleniyor...' : 'Yeni Kitap Ekle'}
            <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} disabled={uploading} />
          </label>
          <button className="btn-secondary" onClick={() => {
            localStorage.removeItem('appPassword');
            setPassword('');
          }}>
            <LogOut size={20} />
          </button>
        </div>
      </div>

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
