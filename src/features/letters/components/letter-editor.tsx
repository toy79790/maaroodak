'use client';

import * as React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  AlignRight,
  AlignCenter,
  AlignJustify,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * محرر المعروض — docs/DECISIONS.md #D-010
 *
 * TipTap على ProseMirror: تراجع/إعادة، وتحديد نص برمجي (لازم لتطبيق أدوات
 * الذكاء الاصطناعي على التحديد)، ومخرَج HTML نظيف. الاتجاه RTL على مستوى
 * محتوى المحرر لا على الصفحة فقط.
 */

export interface LetterEditorHandle {
  getHtml: () => string;
  getSelectionText: () => string;
  setHtml: (html: string) => void;
  focus: () => void;
}

interface LetterEditorProps {
  initialHtml: string;
  onChange?: (html: string) => void;
  onSelectionChange?: (text: string) => void;
  className?: string;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-lg transition-colors',
        active
          ? 'bg-primary-subtle text-primary'
          : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
        'disabled:pointer-events-none disabled:opacity-40',
      )}
    >
      {children}
    </button>
  );
}

export const LetterEditor = React.forwardRef<LetterEditorHandle, LetterEditorProps>(
  function LetterEditor({ initialHtml, onChange, onSelectionChange, className }, ref) {
    const editor = useEditor({
      // مطلوب لتفادي عدم تطابق التوليد بين الخادم والعميل.
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          codeBlock: false,
          horizontalRule: false,
        }),
        Underline,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ],
      content: initialHtml,
      editorProps: {
        attributes: {
          dir: 'rtl',
          class: 'focus:outline-none',
          'aria-label': 'محرر نص المعروض',
        },
      },
      onUpdate: ({ editor: instance }) => onChange?.(instance.getHTML()),
      onSelectionUpdate: ({ editor: instance }) => {
        const { from, to } = instance.state.selection;
        onSelectionChange?.(
          from === to ? '' : instance.state.doc.textBetween(from, to, '\n'),
        );
      },
    });

    React.useImperativeHandle(
      ref,
      () => ({
        getHtml: () => editor?.getHTML() ?? initialHtml,
        getSelectionText: () => {
          if (!editor) return '';
          const { from, to } = editor.state.selection;
          return from === to ? '' : editor.state.doc.textBetween(from, to, '\n');
        },
        setHtml: (html: string) => {
          // false = لا نُطلق onUpdate: التحديث آتٍ من الخادم لا من المستخدم.
          editor?.commands.setContent(html, false);
        },
        focus: () => editor?.commands.focus(),
      }),
      [editor, initialHtml],
    );

    if (!editor) {
      return (
        <div className={cn('skeleton h-96 rounded-[var(--radius-card)]', className)} />
      );
    }

    return (
      <div className={cn('overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface', className)}>
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-surface-muted/50 p-1.5">
          <ToolbarButton
            label="تراجع"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            <Undo2 className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="إعادة"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          >
            <Redo2 className="size-4" />
          </ToolbarButton>

          <span className="mx-1 h-5 w-px bg-border" aria-hidden />

          <ToolbarButton
            label="عريض"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="مائل"
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="تحته خط"
            active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="size-4" />
          </ToolbarButton>

          <span className="mx-1 h-5 w-px bg-border" aria-hidden />

          <ToolbarButton
            label="قائمة نقطية"
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="قائمة مرقّمة"
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="size-4" />
          </ToolbarButton>

          <span className="mx-1 h-5 w-px bg-border" aria-hidden />

          <ToolbarButton
            label="محاذاة لليمين"
            active={editor.isActive({ textAlign: 'right' })}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
          >
            <AlignRight className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="توسيط"
            active={editor.isActive({ textAlign: 'center' })}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
          >
            <AlignCenter className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="ضبط"
            active={editor.isActive({ textAlign: 'justify' })}
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          >
            <AlignJustify className="size-4" />
          </ToolbarButton>
        </div>

        <EditorContent
          editor={editor}
          className={cn(
            'max-h-[70vh] overflow-y-auto p-6',
            // نفس طباعة ورقة المعروض ليتطابق المحرَّر مع المعاينة.
            '[&_.ProseMirror]:min-h-64 [&_.ProseMirror]:text-right',
            '[&_.ProseMirror]:[font-family:var(--font-letter)]',
            '[&_.ProseMirror]:text-[1.05rem] [&_.ProseMirror]:leading-[2]',
            '[&_.ProseMirror_p]:mb-4 [&_.ProseMirror_p]:text-justify',
            '[&_.ProseMirror_h1]:mb-3 [&_.ProseMirror_h1]:text-xl [&_.ProseMirror_h1]:font-bold',
            '[&_.ProseMirror_h2]:mb-3 [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-bold',
            '[&_.ProseMirror_ul]:mb-4 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pe-6',
            '[&_.ProseMirror_ol]:mb-4 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pe-6',
            '[&_.ProseMirror_mark]:bg-accent-100 [&_.ProseMirror_mark]:px-1 [&_.ProseMirror_mark]:rounded',
          )}
        />
      </div>
    );
  },
);
