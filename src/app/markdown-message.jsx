'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Check, Copy, Download } from 'lucide-react';

// Kod bloklari uchun sintaksis ranglari (highlight.js). Rang jadvali
// globals.css'da `.hljs-*` sifatida mavzuga (dark/light) mos berilgan.

function flatten(children) {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(flatten).join('');
  if (children?.props?.children) return flatten(children.props.children);
  return '';
}

const LANG_LABEL = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  py: 'Python',
  python: 'Python',
  sh: 'Shell',
  bash: 'Bash',
  json: 'JSON',
  html: 'HTML',
  css: 'CSS',
  sql: 'SQL',
  jsx: 'JSX',
  tsx: 'TSX',
};

function CodeBlock({ lang, code, children }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    const ext = lang ? (LANG_LABEL[lang] ? lang : lang) : 'txt';
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kod.${ext === 'python' ? 'py' : ext === 'javascript' ? 'js' : ext === 'typescript' ? 'ts' : ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="tg-codeblock my-3 overflow-hidden rounded-xl border border-[var(--tg-border)] bg-[var(--tg-code-bg)]">
      <div className="flex items-center justify-between border-b border-[var(--tg-border)] px-3 py-1.5">
        <span className="text-[10.5px] font-medium uppercase tracking-wide text-[var(--tg-text-3)]">
          {LANG_LABEL[lang] || lang || 'kod'}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={download} title="Fayl sifatida yuklab olish" className="tg-actionbtn">
            <Download size={12} />
          </button>
          <button type="button" onClick={copy} title="Nusxa olish" className="tg-actionbtn flex items-center gap-1 text-[11px]">
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span className="hidden sm:inline">{copied ? 'Nusxalandi' : 'Nusxa'}</span>
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed tg-scroll">{children}</pre>
    </div>
  );
}

export default function MarkdownMessage({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]}
      components={{
        pre({ children }) {
          // <pre> ichidagi <code> elementi (hljs sinflari bilan) — uni o'zimiz
          // qayta chizamiz, shunda pastdagi `code` komponenti FAQAT qator
          // ichidagi kod uchun ishlaydi.
          const codeEl = Array.isArray(children) ? children[0] : children;
          const inner = codeEl?.props?.children;
          const cls = codeEl?.props?.className || '';
          const code = flatten(inner).replace(/\n$/, '');
          const lang = /language-(\w+)/.exec(cls)?.[1];
          return (
            <CodeBlock lang={lang} code={code}>
              <code className={cls}>{inner}</code>
            </CodeBlock>
          );
        },
        code({ children }) {
          return <code className="rounded-md bg-[var(--tg-hover-strong)] px-1.5 py-0.5 font-mono text-[13px]">{children}</code>;
        },
        p({ children }) {
          return <p className="mb-3 last:mb-0">{children}</p>;
        },
        h1({ children }) {
          return <h1 className="mb-2 mt-4 text-[20px] font-bold first:mt-0">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="mb-2 mt-4 text-[18px] font-bold first:mt-0">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="mb-1.5 mt-3 text-[16px] font-semibold first:mt-0">{children}</h3>;
        },
        ul({ children }) {
          return <ul className="mb-3 ml-5 list-disc space-y-1 last:mb-0">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="mb-3 ml-5 list-decimal space-y-1 last:mb-0">{children}</ol>;
        },
        li({ children }) {
          return <li className="pl-0.5">{children}</li>;
        },
        blockquote({ children }) {
          return (
            <blockquote className="mb-3 border-l-2 border-[var(--tg-gold)]/60 pl-3 text-[var(--tg-text-2)] last:mb-0">{children}</blockquote>
          );
        },
        hr() {
          return <hr className="my-4 border-[var(--tg-border)]" />;
        },
        a({ children, href }) {
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--tg-teal)] underline decoration-dotted underline-offset-2 hover:text-[var(--tg-gold)]">
              {children}
            </a>
          );
        },
        strong({ children }) {
          return <strong className="font-semibold">{children}</strong>;
        },
        table({ children }) {
          return (
            <div className="mb-3 overflow-x-auto rounded-xl border border-[var(--tg-border)] last:mb-0 tg-scroll">
              <table className="w-full border-collapse text-[13.5px]">{children}</table>
            </div>
          );
        },
        thead({ children }) {
          return <thead className="bg-[var(--tg-hover)]">{children}</thead>;
        },
        th({ children }) {
          return <th className="border-b border-[var(--tg-border)] px-3 py-2 text-left font-semibold">{children}</th>;
        },
        td({ children }) {
          return <td className="border-b border-[var(--tg-border)] px-3 py-1.5 align-top last:border-b-0">{children}</td>;
        },
        img({ src, alt }) {
          return <img src={src} alt={alt || ''} className="my-2 max-h-80 rounded-xl border border-[var(--tg-border)]" />;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
