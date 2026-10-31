// The browser draws the report itself (via SVG), so Tamil shaping, fonts and modern CSS
// colours come out exactly as on screen. (html2canvas cannot read colour-mix() and failed.)
export async function createReportPdf(element, filename) {
  if (!element) throw new Error('Nothing to print');
  const [{ domToCanvas }, { jsPDF }] = await Promise.all([import('modern-screenshot'), import('jspdf')]);
  await document.fonts.ready;
  const canvas = await domToCanvas(element, {
    // Captured at its on-screen width (sizes are copied as laid out), then scaled to fit A4.
    scale: Math.max(1.5, Math.min(3, 1400 / Math.max(element.offsetWidth, 300))),
    backgroundColor: '#ffffff',
    style: { margin: '0', boxShadow: 'none' },
    // Hide on-screen-only controls (buttons) in the PDF.
    filter: (node) => !(node instanceof HTMLElement && (node.tagName === 'BUTTON' || node.classList.contains('noprint'))),
  });
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const width = 190, height = 277;
  const pagePixels = Math.floor(height * canvas.width / width);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

// The Android app provides window.ThiruthiNative, because Android web views cannot share or download files.
const native = () => (typeof window !== 'undefined' ? window.ThiruthiNative : null);

/**
 * Sends the PDF itself (not a link) to another app.
 *  - Android app: the phone's share sheet, or WhatsApp directly when whatsapp is true.
 *  - Phones/tablets in a browser: the system share sheet (WhatsApp, email, Drive, Files…).
 *  - Computers: downloads the PDF (and opens WhatsApp Web for WhatsApp) so it can be attached.
 * Returns 'shared' | 'cancelled' | 'downloaded' | 'retry'.
 */
export async function sharePdfFile(file, { title = '', text = '', whatsapp = false } = {}) {
  const nb = native();
  if (nb?.sharePdf) {
    const res = nb.sharePdf(await fileToBase64(file), file.name, whatsapp ? 'whatsapp' : '');
    if (res === 'ok') return 'shared';
  }
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title, text });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
      if (e?.name === 'NotAllowedError') return 'retry'; // the browser wants a fresh tap
    }
  }
  downloadPdf(file);
  if (whatsapp) window.open(`https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  return 'downloaded';
}

/** Saves the PDF on the device (Downloads in the Android app). */
export async function savePdfFile(file) {
  const nb = native();
  if (nb?.savePdf) {
    const res = nb.savePdf(await fileToBase64(file), file.name);
    if (res === 'ok' || res === 'shared') return res;
  }
  downloadPdf(file);
  return 'downloaded';
}
