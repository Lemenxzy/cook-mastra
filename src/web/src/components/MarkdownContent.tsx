import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // 自定义组件样式
          h1: ({ children }) => (
            <h1 className="text-lg font-bold mb-2 border-b border-current pb-1 opacity-90">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold mb-2 mt-3 opacity-90">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-medium mb-1 mt-2 opacity-90">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-medium mb-1 mt-2 opacity-90">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="mb-2 leading-relaxed last:mb-0">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside mb-2 space-y-0.5 pl-4 last:mb-0">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside mb-2 space-y-0.5 pl-4 last:mb-0">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">
              {children}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-current pl-2 py-1 opacity-80 mb-2 italic">
              {children}
            </blockquote>
          ),
          code: ({ inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <div className="rounded overflow-hidden mb-2 text-xs">
                <div className="bg-black bg-opacity-20 px-2 py-1 text-xs font-medium opacity-70">
                  {match[1]}
                </div>
                <code className={`${className} block bg-black bg-opacity-30 p-2 overflow-x-auto text-xs`} {...props}>
                  {children}
                </code>
              </div>
            ) : (
              <code className="bg-black bg-opacity-20 px-1 py-0.5 rounded text-xs font-mono" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-black bg-opacity-30 p-2 rounded overflow-x-auto mb-2 text-xs">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-2">
              <table className="min-w-full border border-current border-opacity-30 rounded text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-black bg-opacity-20">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody>
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="border-b border-current border-opacity-20">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="text-left p-2 font-medium text-xs">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="p-2 text-xs">
              {children}
            </td>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic">
              {children}
            </em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}