import React from 'react';
import { ExternalLink } from 'lucide-react';

interface FileLinkCellProps {
  fileFormula?: string;
  sheetId: string;
  label: string;
}

const FileLinkCell: React.FC<FileLinkCellProps> = ({ fileFormula, sheetId, label }) => {
  if (!fileFormula || typeof fileFormula !== 'string') {
    return <span className="text-sm text-slate-400 italic">Not generated</span>;
  }

  const trimmedValue = fileFormula.trim();
  if (!trimmedValue) {
    return <span className="text-sm text-slate-400 italic">Not generated</span>;
  }

  let finalUrl = '';
  const sheetBaseUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;

  const hyperlinkRegex = /=HYPERLINK\(\s*(?:"([^"]+)"|'([^']+)').*?\)/i;
  const match = trimmedValue.match(hyperlinkRegex);

  let linkPart = '';
  if (match && (match[1] || match[2])) {
    linkPart = match[1] || match[2];
  }

  if (linkPart) {
    if (linkPart.startsWith('#')) {
      finalUrl = `${sheetBaseUrl}${linkPart}`;
    } else {
      finalUrl = linkPart;
    }
  } else if (trimmedValue.startsWith('http')) {
    finalUrl = trimmedValue;
  }

  if (!finalUrl) {
    return <span className="text-sm text-slate-400 italic">Invalid Link</span>;
  }

  return (
    <a
      href={finalUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800 hover:underline"
      aria-label={`View file for ${label}`}
    >
      {label}
      <ExternalLink className="w-4 h-4" />
    </a>
  );
};

export default FileLinkCell;