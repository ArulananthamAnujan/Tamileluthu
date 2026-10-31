import { supabase } from '../supabase.js';

// The browser draws the report itself (via SVG), so Tamil shaping, fonts and modern CSS
// colours come out exactly as on screen. (html2canvas cannot read colour-mix() and failed.)
export async function createReportPdf(element, filename) {
  if (!element) throw new Error('Nothing to print');
  const [{ domToCanvas }, { jsPDF }] = await Promise.all([import('modern-screenshot'), import('jspdf')]);
  await document.fonts.ready;
  const canvas = await domToCanvas(element, {
    // Captured at its on-screen width (sizes are copied as laid out), then scaled to fit A4.
    scale: Math.max(1.25, Math.min(2.2, 1100 / Math.max(element.offsetWidth, 300))),
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
    pdf.addImage(page.toDataURL('image/jpeg', 0.82), 'JPEG', 10, 10, width, page.height * width / canvas.width);
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

// Plain ASCII file names: some phones refuse to share files with other characters.
export const asciiName = (name) => (name || 'report.pdf').normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-(?=\.pdf$)/g, '') || 'report.pdf';

/** Saves the PDF in the school's private storage and returns a 30-day link to it. */
export async function uploadPdfLink(file) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in again.');
  const path = `${user.id}/${crypto.randomUUID()}.pdf`;
  const { error } = await supabase.storage.from('reports').upload(path, file, { contentType: 'application/pdf' });
  if (error) throw error;
  const { data, error: e2 } = await supabase.storage.from('reports').createSignedUrl(path, 60 * 60 * 24 * 30, { download: file.name });
  if (e2) throw e2;
  return data.signedUrl;
}

/**
 * Sends the PDF itself (not a link) to another app.
 *  - Android app: the phone's share sheet, or WhatsApp directly when whatsapp is true.
 *  - Phones/tablets in a browser: the system share sheet (WhatsApp, email, Drive, Files…).
 *  - If the browser refuses to share files (some Samsung/PWA setups), the PDF is saved
 *    privately and shared as a link instead; WhatsApp opens with the link ready.
 *  - Computers: downloads the PDF (and opens WhatsApp Web for WhatsApp).
 * Returns { status: 'shared' | 'cancelled' | 'downloaded' | 'link' | 'update_app' | 'app_error', url?, error? }.
 */
export async function sharePdfFile(input, { title = '', text = '', whatsapp = false } = {}) {
  const file = new File([input], asciiName(input.name), { type: 'application/pdf' });
  const nb = native();
  if (nb?.sharePdf) {
    const res = nb.sharePdf(await fileToBase64(file), file.name, whatsapp ? 'whatsapp' : '');
    return res === 'ok' ? { status: 'shared' } : { status: 'app_error', error: res };
  }
  let error = '';
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title });
      return { status: 'shared' };
    } catch (e) {
      if (e?.name === 'AbortError') return { status: 'cancelled' };
      error = `${e?.name || 'Error'}: ${e?.message || ''}`.slice(0, 160);
      console.error('File share refused:', e);
    }
  }
  // An old copy of the Android app has no native sharing, and its web view ignores downloads.
  if (/ThiruthiApp/.test(navigator.userAgent)) return { status: 'update_app' };
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (mobile || whatsapp) {
    try {
      const url = await uploadPdfLink(file);
      if (whatsapp) window.location.href = `https://wa.me/?text=${encodeURIComponent(`${text || title}\n${url}`)}`;
      return { status: 'link', url, error };
    } catch (e) {
      console.error('PDF link failed:', e);
      error = error || String(e?.message || e);
    }
  }
  downloadPdf(file);
  if (whatsapp && !mobile) window.open(`https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  return { status: 'downloaded', error };
}

/** Saves the PDF on the device (Downloads in the Android app). */
export async function savePdfFile(input) {
  const file = new File([input], asciiName(input.name), { type: 'application/pdf' });
  const nb = native();
  if (nb?.savePdf) {
    const res = nb.savePdf(await fileToBase64(file), file.name);
    if (res === 'ok' || res === 'shared') return res;
    return `app_error:${res}`;
  }
  if (/ThiruthiApp/.test(navigator.userAgent)) return 'update_app';
  downloadPdf(file);
  return 'downloaded';
}
