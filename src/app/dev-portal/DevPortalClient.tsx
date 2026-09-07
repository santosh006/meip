'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

type Item = {
  id: string;
  kind: string;
  title: string;
  content: string;
  pinned: boolean;
  updated_at: string;
};

const KINDS = ['note', 'doc', 'strategy', 'decision', 'idea'];

export default function DevPortalClient({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [kind, setKind] = useState('note');
  const [editingId, setEditingId] = useState<string | null>(null);

  async function addItem() {
    const { data } = await supabase
      .from('workspace_items')
      .insert({ kind, title: 'Untitled', content: '' })
      .select()
      .single();
    if (data) {
      setItems([data, ...items]);
      setEditingId(data.id);
    }
  }

  async function saveItem(id: string, title: string, content: string) {
    await supabase
      .from('workspace_items')
      .update({ title, content, updated_at: new Date().toISOString() })
      .eq('id', id);
    setItems(items.map((i) => (i.id === id ? { ...i, title, content } : i)));
    setEditingId(null);
  }

  async function deleteItem(id: string) {
    await supabase.from('workspace_items').delete().eq('id', id);
    setItems(items.filter((i) => i.id !== id));
  }

  const badge = (k: string) => {
    const colors: Record<string, string> = {
      note: '#4ea1ff', doc: '#3fb950', strategy: '#e3b341',
      decision: '#f85149', idea: '#bc8cff',
    };
    return (
      <span
        className="text-[10px] uppercase px-2 py-0.5 rounded-full border"
        style={{ color: colors[k], borderColor: colors[k] + '66' }}
      >
        {k}
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">Dev Portal</h1>
        <div className="flex gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="bg-[#161b22] border border-[#2b333d] rounded px-2 py-2 text-sm"
          >
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <button
            onClick={addItem}
            className="px-4 py-2 rounded bg-[#4ea1ff] text-black font-semibold text-sm"
          >
            + New
          </button>
        </div>
      </div>
      <p className="text-[#9aa7b4] mb-6">
        Your flexible workspace — notes, docs, strategy, decisions & ideas. Saved live.
      </p>

      <div className="grid gap-3">
        {items.length === 0 && (
          <p className="text-[#9aa7b4] text-sm">Nothing yet. Click “+ New” to create your first entry.</p>
        )}
        {items.map((item) =>
          editingId === item.id ? (
            <EditCard key={item.id} item={item} onSave={saveItem} onCancel={() => setEditingId(null)} badge={badge} />
          ) : (
            <div key={item.id} className="bg-[#161b22] border border-[#2b333d] rounded-xl p-5">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  {badge(item.kind)}
                  <span className="font-semibold">{item.title}</span>
                </div>
                <div className="flex gap-3 text-sm text-[#9aa7b4]">
                  <button onClick={() => setEditingId(item.id)} className="hover:text-white">Edit</button>
                  <button onClick={() => deleteItem(item.id)} className="hover:text-[#f85149]">Delete</button>
                </div>
              </div>
              {item.content && (
                <p className="text-sm text-[#9aa7b4] mt-2 whitespace-pre-wrap">{item.content}</p>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function EditCard({
  item, onSave, onCancel, badge,
}: {
  item: Item;
  onSave: (id: string, title: string, content: string) => void;
  onCancel: () => void;
  badge: (k: string) => React.ReactNode;
}) {
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);
  return (
    <div className="bg-[#161b22] border border-[#4ea1ff66] rounded-xl p-5">
      <div className="mb-3">{badge(item.kind)}</div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="w-full mb-3 px-3 py-2 rounded bg-[#0d1117] border border-[#2b333d] outline-none focus:border-[#4ea1ff]"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write anything… (markdown-friendly)"
        rows={5}
        className="w-full mb-3 px-3 py-2 rounded bg-[#0d1117] border border-[#2b333d] outline-none focus:border-[#4ea1ff]"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSave(item.id, title, content)}
          className="px-4 py-2 rounded bg-[#4ea1ff] text-black font-semibold text-sm"
        >
          Save
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded border border-[#2b333d] text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}
