// Generates a valid multi-page PDF in pure JavaScript/TypeScript for instant testing
// Page 1: Cover and Blurb (which is excluded by design)
// Pages 2+: The real book chapters

export function createSampleManuscriptPdf(
  title: string = "Barnaby and the Magic Clocktower",
  blurb: string = "When Barnaby and his flying golden puppy discover a secret brass door in the ancient clocktower, an enchanting adventure begins!"
): File {
  // Construct a minimal compliant PDF 1.4 with 3 pages
  const p1Content = `BT /F1 14 Tf 72 720 Td (PAGE 1: COVER & BLURB - SKIPPED BY ENGINE) Tj 0 -30 Td (${title.replace(/[\(\)]/g, '')}) Tj 0 -30 Td (Blurb: ${blurb.slice(0, 100).replace(/[\(\)]/g, '')}...) Tj ET`;
  
  const p2Content = `BT /F1 14 Tf 72 720 Td (Chapter 1: The Whispering Clocktower) Tj /F1 12 Tf 0 -35 Td (Deep in the heart of Waddle Town stood the grand clocktower.) Tj 0 -22 Td (Barnaby pulled his cap down against the autumn breeze and stepped inside.) Tj 0 -22 Td (The giant brass pendulum swung with a gentle, rhythmic hum that seemed to sing.) Tj 0 -22 Td (Beside his boots, his golden pup Barnaby Junior barked with sheer excitement.) Tj ET`;

  const p3Content = `BT /F1 14 Tf 72 720 Td (Chapter 2: The Flight of the Propeller Pup) Tj /F1 12 Tf 0 -35 Td (High above the cobblestone streets, colorful streams of magic swirled.) Tj 0 -22 Td (The tiny propeller on the puppy's hat began to spin faster and faster.) Tj 0 -22 Td (Up they soared into the starry twilight sky, laughing all the way!) Tj 0 -22 Td (It was the start of the greatest mystery the town had ever known.) Tj ET`;

  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 9 0 R >> >> >>
endobj
4 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R /Resources << /Font << /F1 9 0 R >> >> >>
endobj
5 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 8 0 R /Resources << /Font << /F1 9 0 R >> >> >>
endobj
6 0 obj
<< /Length ${p1Content.length} >>
stream
${p1Content}
endstream
endobj
7 0 obj
<< /Length ${p2Content.length} >>
stream
${p2Content}
endstream
endobj
8 0 obj
<< /Length ${p3Content.length} >>
stream
${p3Content}
endstream
endobj
9 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 10
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000123 00000 n 
0000000244 00000 n 
0000000365 00000 n 
0000000486 00000 n 
0000000620 00000 n 
0000000780 00000 n 
0000000950 00000 n 
trailer
<< /Size 10 /Root 1 0 R >>
startxref
1030
%%EOF`;

  const blob = new Blob([pdfString], { type: 'application/pdf' });
  return new File([blob], `${title.replace(/[^a-zA-Z0-9]/g, '_')}_manuscript.pdf`, {
    type: 'application/pdf',
  });
}
