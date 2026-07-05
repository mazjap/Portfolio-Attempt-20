import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';

interface Props {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = '' }: Props) {
  return (
    <div className={`prose-xcode ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-semibold text-xcode-text-light dark:text-xcode-text mt-8 mb-4">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold text-xcode-text-light dark:text-xcode-text mt-6 mb-3">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-medium text-xcode-text-light dark:text-xcode-text mt-5 mb-2">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-[15px] leading-7 text-xcode-text-light/90 dark:text-xcode-text/90 mb-4">{children}</p>
          ),
          a: ({ href, children }) => (
            <a href={href} className="text-xcode-accent hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-5 mb-4 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside pl-5 mb-4 space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-[15px] leading-7 text-xcode-text-light/90 dark:text-xcode-text/90">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-xcode-accent pl-4 italic text-xcode-muted my-4">
              {children}
            </blockquote>
          ),
          code: ({ className: cls, children, ...props }) => {
            const isBlock = cls?.includes('language-');
            if (isBlock) {
              return <code className={cls} {...props}>{children}</code>;
            }
            return (
              <code className="font-mono text-sm bg-xcode-surface-light dark:bg-xcode-surface px-1.5 py-0.5 rounded text-xcode-pink">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre>{children}</pre>
          ),
          hr: () => <hr className="border-xcode-border-light dark:border-xcode-border my-6" />,
          img: ({ src, alt }) => (
            <img src={src} alt={alt} className="rounded-lg w-full my-4 object-cover" />
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-xcode-text-light dark:text-xcode-text">{children}</strong>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
