'use client';

// Chips input for short words (category tags): type and press Enter or a comma
// to add, paste "a, b, c" to add many, Backspace on an empty box removes the last.
import { useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { normalizeTags } from '@/app/(routes)/admin/products/services/categoryService';

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  id?: string;
}

export default function TagChipsInput({ value, onChange, placeholder = 'Type a name, press Enter', id }: Props) {
  const [text, setText] = useState('');

  const add = (raw: string) => {
    const next = normalizeTags([...value, ...raw.split(',')]);
    if (next.length !== value.length) onChange(next);
    setText('');
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault(); // never submit the form from here
      if (text.trim()) add(text);
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted.includes(',')) return;
    e.preventDefault();
    add(text + pasted);
  };

  return (
    <div className="mt-1 flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2 py-1.5 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
      {value.map((t) => (
        <span key={t.toLowerCase()} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
          {t}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== t))}
            className="rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
            aria-label={`Remove ${t}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        onPaste={onPaste}
        onBlur={() => text.trim() && add(text)}
        placeholder={value.length ? '' : placeholder}
        className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-1 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-0"
      />
    </div>
  );
}
