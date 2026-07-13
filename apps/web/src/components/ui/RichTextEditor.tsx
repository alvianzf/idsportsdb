import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code2,
  Link,
  ImagePlus,
  Undo2,
  Redo2,
  Trash2,
} from "lucide-react";

// Extend Image to support a width attribute so users can resize inline
const ResizableImage = ImageExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: "100%",
        parseHTML: (el) =>
          el.style.width || el.getAttribute("width") || "100%",
        renderHTML: (attrs) => ({
          style: `width: ${attrs.width}; height: auto; display: block;`,
        }),
      },
    };
  },
});

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onImageUpload: (file: File) => Promise<string>;
  className?: string;
}

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, active, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded text-sm transition-colors ${
        active
          ? "bg-primary text-white"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-0.5 h-5 w-px bg-neutral-200" />;
}

const SIZE_PRESETS = [
  { label: "25%", value: "25%" },
  { label: "50%", value: "50%" },
  { label: "75%", value: "75%" },
  { label: "100%", value: "100%" },
];

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Tulis konten pengumuman di sini...",
  onImageUpload,
  className = "",
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);
  // Incremented on every selection change so the toolbar re-renders and
  // editor.isActive("image") is re-evaluated when the user clicks an image.
  const [, forceRender] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      ResizableImage.configure({ inline: false, allowBase64: false }),
      LinkExtension.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    onSelectionUpdate() {
      forceRender((n) => n + 1);
    },
  });

  useEffect(() => {
    if (!editor || initializedRef.current) return;
    if (value) {
      editor.commands.setContent(value);
      initializedRef.current = true;
    }
  }, [editor, value]);

  async function handleImageFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    try {
      const url = await onImageUpload(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch {
      // upload error handled by parent
    } finally {
      e.target.value = "";
    }
  }

  function handleAddLink() {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL tautan:", previousUrl ?? "");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  function setImageWidth(width: string) {
    if (!editor) return;
    editor.chain().focus().updateAttributes("image", { width }).run();
  }

  function deleteImage() {
    if (!editor) return;
    editor.chain().focus().deleteSelection().run();
  }

  if (!editor) return null;

  const currentWidth: string =
    (editor.isActive("image") && editor.getAttributes("image").width) || "100%";

  return (
    <div className={`overflow-hidden rounded-md border border-neutral-300 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-neutral-200 bg-neutral-50 px-2 py-1.5">
        <ToolbarButton title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}>
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}>
          <Italic size={14} />
        </ToolbarButton>
        <ToolbarButton title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")}>
          <Strikethrough size={14} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}>
          <Heading2 size={14} />
        </ToolbarButton>
        <ToolbarButton title="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}>
          <Heading3 size={14} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}>
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton title="Ordered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}>
          <ListOrdered size={14} />
        </ToolbarButton>
        <ToolbarButton title="Blockquote" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}>
          <Quote size={14} />
        </ToolbarButton>
        <ToolbarButton title="Code block" onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")}>
          <Code2 size={14} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton title="Tambah tautan" onClick={handleAddLink} active={editor.isActive("link")}>
          <Link size={14} />
        </ToolbarButton>
        <ToolbarButton title="Sisipkan gambar" onClick={() => fileInputRef.current?.click()}>
          <ImagePlus size={14} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton title="Undo" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 size={14} />
        </ToolbarButton>
        <ToolbarButton title="Redo" onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 size={14} />
        </ToolbarButton>

        {/* Image controls — only visible when an image node is selected */}
        {editor.isActive("image") && (
          <>
            <Divider />
            <span className="text-xs font-medium text-neutral-400 ml-1">Gambar:</span>
            {SIZE_PRESETS.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                title={`Lebar ${label}`}
                onClick={() => setImageWidth(value)}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  currentWidth === value
                    ? "bg-primary text-white"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              title="Hapus gambar"
              onClick={deleteImage}
              className="flex h-7 w-7 items-center justify-center rounded text-danger hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>

      {/* Editor content area */}
      <div className="rte-content bg-white text-sm text-neutral-900">
        <EditorContent editor={editor} />
      </div>

      {/* Hidden file input for image uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileChange}
      />
    </div>
  );
}
