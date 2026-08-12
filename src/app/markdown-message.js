'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

function flatten(children) {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(flatten).join('');
  return '';
}

function CodeBlock({ lang, code }) {
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

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-white/10 bg-[#0D0F14]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="text-[10.5px] uppercase tracking-wide text-gray-500">{lang || 'kod'}</span>
        <button onClick={copy} className="text-gray-500 transition-colors hover:text-gray-200">
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function MarkdownMessage({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        pre({ children }) {
          const codeEl = children;
          const code = flatten(codeEl?.props?.children).replace(/\n$/, '');
          const lang = /language-(\w+)/.exec(codeEl?.props?.className || '')?.[1];
          return <CodeBlock lang={lang} code={code} />;
        },
        code({ className, children }) {
          return (
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-[13px]">
              {children}
            </code>
          );
        },
        p({ children }) {
          return <p className="mb-2 last:mb-0">{children}</p>;
        },
        ul({ children }) {
          return <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>;
        },
        a({ children, href }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted underline-offset-2 hover:text-[#E4A93B]"
            >
              {children}
            </a>
          );
        },
        strong({ children }) {
          return <strong className="font-semibold">{children}</strong>;
        },
        table({ children }) {
          return (
            <div className="mb-2 overflow-x-auto">
              <table className="border-collapse text-[13px]">{children}</table>
            </div>
          );
        },
        th({ children }) {
          return <th className="border border-white/10 px-2 py-1 text-left">{children}</th>;
        },
        td({ children }) {
          return <td className="border border-white/10 px-2 py-1">{children}</td>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
