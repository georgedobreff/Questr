"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MarkdownRendererProps {
  children: string;
  inline?: boolean;
}

export default function MarkdownRenderer({ children, inline = false }: MarkdownRendererProps) {

  const components: Components = {
    p: ({ children }) => inline ? <span>{children}</span> : <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
    div: ({ children }) => inline ? <span>{children}</span> : <div>{children}</div>,
    ul: ({ children }) => inline ? <span>{children}</span> : <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>,
    ol: ({ children }) => inline ? <span>{children}</span> : <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>,
    li: ({ children }) => inline ? <span>{children}</span> : <li className="mb-1">{children}</li>,
    h1: ({ children }) => inline ? <strong>{children}</strong> : <h1 className="text-2xl font-bold mb-4 mt-6">{children}</h1>,
    h2: ({ children }) => inline ? <strong>{children}</strong> : <h2 className="text-xl font-bold mb-3 mt-5">{children}</h2>,
    h3: ({ children }) => inline ? <strong>{children}</strong> : <h3 className="text-lg font-bold mb-2 mt-4">{children}</h3>,
    h4: ({ children }) => inline ? <strong>{children}</strong> : <h4 className="text-base font-bold mb-2 mt-3">{children}</h4>,
    h5: ({ children }) => inline ? <strong>{children}</strong> : <h5 className="text-sm font-bold mb-1 mt-2">{children}</h5>,
    h6: ({ children }) => inline ? <strong>{children}</strong> : <h6 className="text-xs font-bold mb-1 mt-2">{children}</h6>,
    code: ({ className, children, ...props }: React.ComponentPropsWithoutRef<"code">) => {
      const match = /language-(\w+)/.exec(className || "");
      const isCodeBlock = !!match;
      
      if (isCodeBlock) {
        return (
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={match[1]}
            PreTag="div"
            customStyle={{
              margin: 0,
              padding: '1rem',
              backgroundColor: 'transparent',
              fontSize: '0.85em',
            }}
          >
            {String(children).replace(/\n$/, "")}
          </SyntaxHighlighter>
        );
      }
      
      return (
        <code className="rounded px-1.5 py-0.5 bg-muted/80 font-mono text-[0.9em] border border-border/30 text-primary" {...props}>
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="overflow-x-auto rounded-lg bg-[#1e1e1e] my-4 border border-zinc-800 shadow-md ring-1 ring-white/5">
        {children}
      </pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-primary/30 pl-4 italic my-4 text-muted-foreground">
        {children}
      </blockquote>
    ),
    a: ({ href, children }) => (
      <a href={href} className="text-primary hover:underline underline-offset-4" target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
  };

  return (
    <div className={inline ? "inline" : "markdown-content"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
