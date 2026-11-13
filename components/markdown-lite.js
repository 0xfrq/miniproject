'use client';

// Renderer Markdown kecil tanpa HTML mentah: judul, daftar, tabel, tebal/miring, kode, dan sitasi [n].
function inline(text, sources, keyPrefix) {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[\d{1,2}\](?:\[\d{1,2}\])*)/g;
  let last = 0;
  let match;
  let index = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${index += 1}`;
    if (token.startsWith('**')) parts.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith('`')) parts.push(<code key={key}>{token.slice(1, -1)}</code>);
    else if (token.startsWith('*')) parts.push(<em key={key}>{token.slice(1, -1)}</em>);
    else {
      const numbers = [...token.matchAll(/\d{1,2}/g)].map((item) => Number(item[0]));
      parts.push(<span key={key} className="ai-cite-group">{numbers.map((number) => {
        const source = sources?.find((item) => item.n === number);
        return source ? <a key={number} className="ai-cite" href={source.url} target="_blank" rel="noopener noreferrer" title={`${source.title} · hal. ${source.pageStart}`}>{number}</a> : <sup key={number}>[{number}]</sup>;
      })}</span>);
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function MarkdownLite({ text, sources }) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const key = `b${index}`;
    if (!line.trim()) { index += 1; continue; }
    if (/^```/.test(line)) {
      const body = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) body.push(lines[index++]);
      index += 1;
      blocks.push(<pre key={key}><code>{body.join('\n')}</code></pre>);
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) { const Tag = `h${Math.min(4, heading[1].length + 2)}`; blocks.push(<Tag key={key}>{inline(heading[2], sources, key)}</Tag>); index += 1; continue; }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { blocks.push(<hr key={key} />); index += 1; continue; }
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[index + 1] || '')) {
      const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
      const head = cells(line);
      index += 2;
      const rows = [];
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) rows.push(cells(lines[index++]));
      blocks.push(<div className="ai-table" key={key}><table><thead><tr>{head.map((cell, i) => <th key={i}>{inline(cell, sources, `${key}h${i}`)}</th>)}</tr></thead><tbody>{rows.map((row, r) => <tr key={r}>{row.map((cell, i) => <td key={i}>{inline(cell, sources, `${key}r${r}c${i}`)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    const listPattern = /^\s*([-*•]|\d+[.)]|[a-eA-E][.)])\s+(.*)$/;
    if (listPattern.test(line)) {
      const ordered = /^\s*(\d+|[a-eA-E])[.)]/.test(line);
      const alpha = /^\s*[a-eA-E][.)]/.test(line);
      const items = [];
      while (index < lines.length && listPattern.test(lines[index])) {
        const [, , content] = listPattern.exec(lines[index]);
        items.push(content);
        index += 1;
        while (index < lines.length && /^\s{2,}\S/.test(lines[index]) && !listPattern.test(lines[index])) items[items.length - 1] += ` ${lines[index++].trim()}`;
      }
      const List = ordered ? 'ol' : 'ul';
      blocks.push(<List key={key} type={alpha ? 'a' : undefined}>{items.map((item, i) => <li key={i}>{inline(item, sources, `${key}i${i}`)}</li>)}</List>);
      continue;
    }
    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,4}\s|```|\s*\|.*\|\s*$|\s*([-*•]|\d+[.)])\s+)/.test(lines[index])) paragraph.push(lines[index++]);
    blocks.push(<p key={key}>{inline(paragraph.join(' '), sources, key)}</p>);
  }
  return <div className="ai-markdown">{blocks}</div>;
}
