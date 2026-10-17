"use client";
import React, { useRef } from 'react';
import { Editor } from '@tinymce/tinymce-react';

interface RichTextEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
  error?: string;
}

export default function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = "Write your blog content here...",
  error 
}: RichTextEditorProps) {
  const editorRef = useRef<any>(null);

  const handleEditorChange = (content: string) => {
    onChange(content);
  };

  return (
    <div className="w-full">
      <Editor
        apiKey="8dy6r8nx2dm5i2x8zk168e6hal2a7rup10d1ygzmiphqci1v"
        onInit={(evt, editor) => editorRef.current = editor}
        value={value}
        onEditorChange={handleEditorChange}
        init={{
          height: 400,
          menubar: false,
          plugins: [
            'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
            'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
            'insertdatetime', 'media', 'table', 'help', 'wordcount'
          ],
          toolbar: 
            'undo redo | formatselect | bold italic backcolor | \
            alignleft aligncenter alignright alignjustify | \
            bullist numlist outdent indent | removeformat | help',
          content_style: `
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; 
              font-size: 14px;
              line-height: 1.6;
            }
            p { margin: 0 0 16px 0; }
            h1, h2, h3, h4, h5, h6 { margin: 24px 0 16px 0; font-weight: 600; }
            ul, ol { margin: 0 0 16px 0; padding-left: 24px; }
            blockquote { 
              margin: 16px 0; 
              padding: 16px; 
              border-left: 4px solid #e5e7eb; 
              background: #f9fafb; 
              font-style: italic; 
            }
          `,
          placeholder: placeholder,
          branding: false,
          promotion: false,
          resize: true,
          statusbar: true,
          elementpath: false,
          setup: (editor: any) => {
            // Custom styles for better UX
            editor.on('init', () => {
              const container = editor.getContainer();
              if (container) {
                container.style.border = '1px solid #d1d5db';
                container.style.borderRadius = '6px';
                container.style.overflow = 'hidden';
              }
            });

            // Handle focus/blur for styling
            editor.on('focus', () => {
              const container = editor.getContainer();
              if (container) {
                container.style.borderColor = '#6366f1';
                container.style.boxShadow = '0 0 0 1px #6366f1';
              }
            });

            editor.on('blur', () => {
              const container = editor.getContainer();
              if (container) {
                container.style.borderColor = error ? '#ef4444' : '#d1d5db';
                container.style.boxShadow = 'none';
              }
            });
          }
        }}
      />
      {error && (
        <p className="mt-1 text-xs sm:text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}