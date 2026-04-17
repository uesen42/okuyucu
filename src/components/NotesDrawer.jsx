import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Save, StickyNote, MessageSquare, History } from 'lucide-react';

const NotesDrawer = ({ isOpen, onClose, bookId, pageNumber }) => {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

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

  // Debounce saving
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      saveNote(note);
    }, 1000);
    return () => clearTimeout(timer);
  }, [note]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[400px] z-50 animate-fade-in flex">
      {/* Backdrop for mobile */}
      <div className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="flex-1 glass border-l border-white/10 flex flex-col relative z-10 shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-primary/20 rounded-lg text-accent-primary">
              <StickyNote size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Notlarım</h3>
              <p className="text-xs text-text-secondary">Sayfa {pageNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 flex flex-col gap-4">
          {loading ? (
            <div className="text-center py-10 text-text-secondary text-sm">Notlar yükleniyor...</div>
          ) : (
            <>
              <textarea
                className="flex-1 bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-accent-primary resize-none placeholder:text-white/20 leading-relaxed"
                placeholder="Bu sayfa için bir şeyler yazın..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-text-secondary font-bold px-1">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${saving ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                  {saving ? 'Kaydediliyor...' : 'Senkronize Edildi'}
                </div>
                <div className="flex items-center gap-3">
                   <button className="hover:text-accent-primary transition-colors flex items-center gap-1">
                     <History size={12} /> Geçmiş
                   </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer info (Premium touch) */}
        <div className="p-6 bg-white/5 text-[11px] text-text-secondary text-center italic">
          Notlarınız iPad ve PC arasında anlık olarak senkronize edilir.
        </div>
      </div>
    </div>
  );
};

export default NotesDrawer;
