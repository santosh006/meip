'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '@/lib/supabase';

type Item = {
  id: string;
  kind: string;
  title: string;
  content: string | null;
  pinned: boolean | null;
  updated_at: string | null;
};

type Table = string[][];

const KINDS = [
  'markdown',
  'docs',
  'excel',
  'presentation',
];

const STARTER_CONTENT: Record<string, string> = {
  presentation: '## Slide 1: Title\n\nAdd slide content here.\n\n---\n\n## Slide 2: Key point\n\nAdd the next slide here.',
};

export default function DevPortalClient({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [kind, setKind] = useState('markdown');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedItem(null);
        setEditingId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function addItem() {
    const { data, error } = await supabase
      .from('workspace_items')
      .insert({ kind, title: 'Untitled', content: STARTER_CONTENT[kind] ?? '' })
      .select()
      .single();
    if (error) {
      alert(`Could not create item: ${error.message}`);
      return;
    }
    if (data) {
      setItems((current) => [data, ...current]);
      setSelectedItem(data);
      setEditingId(data.id);
    }
  }

  async function saveItem(id: string, title: string, content: string) {
    const { error } = await supabase
      .from('workspace_items')
      .update({ title, content, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      alert(`Could not save: ${error.message}`);
      return;
    }
    setItems((current) => current.map((item) => (
      item.id === id ? { ...item, title, content } : item
    )));
    setSelectedItem((current) => current?.id === id ? { ...current, title, content } : current);
    setEditingId(null);
  }

  async function deleteItem(id: string) {
    const { error } = await supabase.from('workspace_items').delete().eq('id', id);
    if (error) {
      alert(`Could not delete: ${error.message}`);
      return;
    }
    setItems((current) => current.filter((item) => item.id !== id));
    setSelectedItem(null);
    setEditingId(null);
  }

  const badge = (value: string) => {
    const colors: Record<string, string> = {
      markdown: '#4ea1ff',
      docs: '#3fb950',
      excel: '#e3b341',
      presentation: '#e3b341',
    };
    const color = colors[value] ?? '#9aa7b4';
    return (
      <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase" style={{ color, borderColor: `${color}66` }}>
        {value}
      </span>
    );
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dev Portal</h1>
        <div className="flex gap-2">
          <select value={kind} onChange={(event) => setKind(event.target.value)} className="rounded border border-[#2b333d] bg-[#161b22] px-2 py-2 text-sm">
            {KINDS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <button onClick={addItem} className="rounded bg-[#4ea1ff] px-4 py-2 text-sm font-semibold text-black">+ New</button>
        </div>
      </div>
      <p className="mb-6 text-[#9aa7b4]">Create Markdown, documents, spreadsheets, and presentations. Saved live.</p>

      <div className="grid gap-3">
        {items.length === 0 && <p className="text-sm text-[#9aa7b4]">Nothing yet. Click “+ New” to create your first entry.</p>}
        {items.map((item) => (
          <button key={item.id} type="button" onClick={() => { setSelectedItem(item); setEditingId(null); }} className="w-full rounded-xl border border-[#2b333d] bg-[#161b22] p-5 text-left transition-colors hover:border-[#4ea1ff] focus:outline-none focus:ring-2 focus:ring-[#4ea1ff]">
            <div className="flex items-center gap-3">{badge(item.kind)}<span className="font-semibold">{item.title}</span></div>
            <p className="mt-2 text-xs text-[#9aa7b4]">Updated {item.updated_at ? item.updated_at.slice(0, 10) : 'recently'}</p>
          </button>
        ))}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="workspace-item-title" onMouseDown={(event) => {
          if (event.target === event.currentTarget) { setSelectedItem(null); setEditingId(null); }
        }}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-[#2b333d] bg-[#161b22] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><div className="mb-2">{badge(selectedItem.kind)}</div><h2 id="workspace-item-title" className="text-xl font-bold">{selectedItem.title}</h2></div>
              <button type="button" onClick={() => { setSelectedItem(null); setEditingId(null); }} className="text-xl text-[#9aa7b4] hover:text-white" aria-label="Close">×</button>
            </div>
            {editingId === selectedItem.id ? (
              <EditCard item={selectedItem} onSave={saveItem} onCancel={() => setEditingId(null)} />
            ) : (
              <>
                <ItemPreview item={selectedItem} />
                <div className="mt-6 flex justify-end gap-2 border-t border-[#2b333d] pt-4">
                  <button type="button" onClick={() => setEditingId(selectedItem.id)} className="rounded bg-[#4ea1ff] px-4 py-2 text-sm font-semibold text-black">Edit</button>
                  <button type="button" onClick={() => deleteItem(selectedItem.id)} className="rounded border border-[#f85149] px-4 py-2 text-sm text-[#f85149]">Delete</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EditCard({ item, onSave, onCancel }: { item: Item; onSave: (id: string, title: string, content: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content ?? '');
  return (
    <div className="mt-6 border-t border-[#2b333d] pt-5">
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" className="mb-3 w-full rounded border border-[#2b333d] bg-[#0d1117] px-3 py-2 outline-none focus:border-[#4ea1ff]" />
      {item.kind === 'excel' ? (
        <SpreadsheetEditor value={content} onChange={setContent} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder={item.kind === 'markdown' || item.kind === 'presentation' ? 'Write Markdown here…' : 'Write content here…'} rows={10} className="w-full resize-none rounded border border-[#2b333d] bg-[#0d1117] px-3 py-2 font-mono text-sm outline-none focus:border-[#4ea1ff]" />
          <div className="overflow-auto rounded border border-[#2b333d] bg-[#0d1117] px-3 py-2"><ItemPreview item={{ ...item, title, content }} /></div>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => onSave(item.id, title, content)} className="rounded bg-[#4ea1ff] px-4 py-2 text-sm font-semibold text-black">Save</button>
        <button type="button" onClick={onCancel} className="rounded border border-[#2b333d] px-4 py-2 text-sm">Cancel</button>
      </div>
    </div>
  );
}

function ItemPreview({ item }: { item: Item }) {
  if (item.kind === 'docs') return <article className="mt-6 whitespace-pre-wrap text-sm text-[#c9d1d9]">{item.content || 'Nothing written yet.'}</article>;
  if (item.kind === 'excel') return <div className="mt-6 overflow-auto rounded border border-[#2b333d] bg-[#0d1117]"><SpreadsheetTable content={item.content ?? ''} /></div>;
  if (item.kind === 'presentation') return <PresentationPreview content={item.content ?? ''} />;
  return <article className="prose prose-invert prose-sm mt-6 max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content || '*Nothing written yet.*'}</ReactMarkdown></article>;
}

function PresentationPreview({ content }: { content: string }) {
  const slides = content.split(/\n---\n/g).filter((slide) => slide.trim());
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      {(slides.length ? slides : ['Nothing written yet.']).map((slide, index) => (
        <article key={index} className="aspect-video overflow-auto rounded border border-[#e3b34166] bg-[#0d1117] p-5">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{slide}</ReactMarkdown>
        </article>
      ))}
    </div>
  );
}

function parseTable(content: string): Table {
  const rows = content.split(/\r?\n/).filter((row) => row.length > 0).map((row) => row.split('\t'));
  return rows.length > 0 ? rows : [['']];
}

function serializeTable(table: Table): string {
  return table.map((row) => row.join('\t')).join('\n');
}

function SpreadsheetEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [table, setTable] = useState<Table>(() => parseTable(value));
  const columnCount = Math.max(1, ...table.map((row) => row.length));

  function updateCell(rowIndex: number, columnIndex: number, cellValue: string) {
    const next = table.map((row) => [...row]);
    while (next[rowIndex].length < columnCount) next[rowIndex].push('');
    next[rowIndex][columnIndex] = cellValue;
    setTable(next);
    onChange(serializeTable(next));
  }

  function addRow() {
    const next = [...table, Array(columnCount).fill('')];
    setTable(next);
    onChange(serializeTable(next));
  }

  function addColumn() {
    const next = table.map((row) => [...row, '']);
    setTable(next);
    onChange(serializeTable(next));
  }

  return (
    <div>
      <div className="mb-2 overflow-auto rounded border border-[#2b333d]">
        <table className="min-w-full border-collapse text-sm"><tbody>{table.map((row, rowIndex) => (
          <tr key={rowIndex}>{Array.from({ length: columnCount }, (_, columnIndex) => (
            <td key={columnIndex} className="border border-[#2b333d] p-0"><input value={row[columnIndex] ?? ''} onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)} className="min-w-32 bg-[#0d1117] px-3 py-2 outline-none focus:bg-[#161b22]" aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`} /></td>
          ))}</tr>
        ))}</tbody></table>
      </div>
      <div className="flex gap-2 text-xs"><button type="button" onClick={addRow} className="rounded border border-[#2b333d] px-3 py-1.5 hover:border-[#4ea1ff]">+ Row</button><button type="button" onClick={addColumn} className="rounded border border-[#2b333d] px-3 py-1.5 hover:border-[#4ea1ff]">+ Column</button></div>
    </div>
  );
}

function SpreadsheetTable({ content }: { content: string }) {
  if (!content.trim()) return <p className="p-4 text-sm text-[#9aa7b4]">No spreadsheet data yet.</p>;
  const table = parseTable(content);
  return <table className="min-w-full border-collapse text-sm"><tbody>{table.map((row, rowIndex) => (
    <tr key={rowIndex} className={rowIndex === 0 ? 'bg-[#161b22] font-semibold' : ''}>{row.map((cell, columnIndex) => <td key={columnIndex} className="border border-[#2b333d] px-3 py-2">{cell}</td>)}</tr>
  ))}</tbody></table>;
}
