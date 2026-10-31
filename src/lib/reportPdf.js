// Render with browser fonts so Tamil glyphs retain their shaping in the PDF.
export async function createReportPdf(element, filename) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'), import('jspdf'),
  ]);
  await document.fonts.ready;
  const canvas = await html2canvas(element, {
    scale: 1.5, backgroundColor: '#ffffff', useCORS: true,
    windowWidth: 1000,
    onclone(doc) {
      const report = doc.querySelector('.wreport');
      report.style.width = '760px';
      report.style.maxWidth = 'none';
      report.style.margin = '0';
      report.style.boxShadow = 'none';
    },
  });
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const width = 190, height = 277;
  const pagePixels = Math.floor(height * canvas.width / width);
  const ctx = canvas.getContext('2d');
  let top = 0;
  while (top < canvas.height) {
    let end = Math.min(top + pagePixels, canvas.height);
    // Prefer a blank row near the page boundary to avoid cutting Tamil text.
    if (end < canvas.height) {
      for (let y = end; y > end - 100; y--) {
        const row = ctx.getImageData(0, y, canvas.width, 1).data;
        let ink = 0;
        for (let x = 0; x < row.length; x += 4) {
          if (Math.min(row[x], row[x + 1], row[x + 2]) < 180) ink++;
        }
        if (ink < 5) { end = y; break; }
      }
    }
    const page = document.createElement('canvas');
    page.width = canvas.width; page.height = end - top;
    page.getContext('2d').drawImage(canvas, 0, top, canvas.width, page.height, 0, 0, page.width, page.height);
    if (top) pdf.addPage();
    pdf.addImage(page.toDataURL('image/jpeg', 0.92), 'JPEG', 10, 10, width, page.height * width / canvas.width);
    top = end;
  }
  return new File([pdf.output('blob')], filename, { type: 'application/pdf' });
}

export function downloadPdf(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url; link.download = file.name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
