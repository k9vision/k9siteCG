import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const BLUE = rgb(0.231, 0.510, 0.965);   // #3B82F6
const DARK = rgb(0.122, 0.161, 0.216);    // #1F2937
const GRAY = rgb(0.42, 0.45, 0.49);       // #6b7280
const LIGHT_BG = rgb(0.976, 0.980, 0.984); // #f9fafb
const WHITE = rgb(1, 1, 1);

export async function generateInvoicePDF(invoice, items) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // Letter size
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  const pageWidth = 612 - margin * 2;
  let y = 742;

  // --- Try to embed logo ---
  try {
    const logoRes = await fetch('https://k9visiontx.com/k9visionlogo.jpeg');
    if (logoRes.ok) {
      const logoBytes = new Uint8Array(await logoRes.arrayBuffer());
      const logoImage = await doc.embedJpg(logoBytes);
      const logoDims = logoImage.scaleToFit(80, 80);
      page.drawImage(logoImage, { x: margin, y: y - logoDims.height, width: logoDims.width, height: logoDims.height });
      // Title next to logo
      page.drawText('K9 Vision', { x: margin + 90, y: y - 25, size: 24, font: fontBold, color: BLUE });
      page.drawText('Dog Training Services', { x: margin + 90, y: y - 45, size: 12, font, color: GRAY });
      y -= 90;
    } else {
      throw new Error('Logo fetch failed');
    }
  } catch {
    // Fallback: text-only header
    page.drawText('K9 Vision', { x: margin, y, size: 28, font: fontBold, color: BLUE });
    y -= 20;
    page.drawText('Dog Training Services', { x: margin, y, size: 12, font, color: GRAY });
    y -= 30;
  }

  // --- Invoice header ---
  y -= 10;
  page.drawText(`Invoice #${invoice.invoice_number}`, { x: margin, y, size: 18, font: fontBold, color: DARK });
  y -= 25;

  const drawField = (label, value) => {
    if (!value) return;
    page.drawText(`${label}: `, { x: margin, y, size: 10, font: fontBold, color: DARK });
    page.drawText(value, { x: margin + font.widthOfTextAtSize(`${label}: `, 10) + fontBold.widthOfTextAtSize(`${label}: `, 10) - font.widthOfTextAtSize(`${label}: `, 10), y, size: 10, font, color: GRAY });
    y -= 16;
  };

  // Simpler field drawing
  const infoFields = [
    ['Date', new Date(invoice.date).toLocaleDateString()],
    ['Due Date', invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : null],
    ['Trainer', invoice.trainer_name],
  ];
  for (const [label, value] of infoFields) {
    if (!value) continue;
    const labelText = `${label}: `;
    const labelWidth = fontBold.widthOfTextAtSize(labelText, 10);
    page.drawText(labelText, { x: margin, y, size: 10, font: fontBold, color: DARK });
    page.drawText(value, { x: margin + labelWidth, y, size: 10, font, color: GRAY });
    y -= 16;
  }

  // --- Bill To ---
  y -= 10;
  page.drawText('Bill To:', { x: margin, y, size: 12, font: fontBold, color: DARK });
  y -= 16;
  page.drawText(invoice.client_name || '', { x: margin, y, size: 10, font: fontBold, color: DARK });
  y -= 16;
  const dogInfo = `${invoice.dog_name || ''}${invoice.dog_breed ? ` (${invoice.dog_breed})` : ''}`;
  if (dogInfo.trim()) {
    page.drawText(`Dog: ${dogInfo}`, { x: margin, y, size: 10, font, color: GRAY });
    y -= 16;
  }

  // --- Line items table ---
  y -= 15;
  const colX = [margin, margin + 150, margin + 185, margin + 235, margin + 290, margin + 350, margin + 400, margin + 450];
  const colLabels = ['Service', 'Qty', 'Price', 'Total', 'Due Date', 'Upfront', 'Paid', 'Balance'];
  const colAligns = ['left', 'center', 'right', 'right', 'center', 'center', 'right', 'right'];

  // Table header background
  page.drawRectangle({ x: margin - 5, y: y - 4, width: pageWidth + 10, height: 20, color: LIGHT_BG });

  for (let i = 0; i < colLabels.length; i++) {
    const textWidth = fontBold.widthOfTextAtSize(colLabels[i], 9);
    let xPos = colX[i];
    if (colAligns[i] === 'right') xPos = colX[i] + 50 - textWidth;
    else if (colAligns[i] === 'center') xPos = colX[i] + 25 - textWidth / 2;
    page.drawText(colLabels[i], { x: xPos, y, size: 9, font: fontBold, color: DARK });
  }

  y -= 6;
  page.drawLine({ start: { x: margin - 5, y }, end: { x: margin + pageWidth + 5, y }, thickness: 1, color: rgb(0.9, 0.91, 0.92) });
  y -= 16;

  // Table rows
  for (const item of items) {
    const itemTotal = Number(item.total || 0);
    const amountPaid = Number(item.amount_paid || 0);
    const balance = itemTotal - amountPaid;
    const dueDateStr = item.due_date ? new Date(item.due_date + 'T00:00:00').toLocaleDateString() : '—';
    const upfrontPct = Number(item.upfront_pct || 0);
    const rowValues = [
      item.service_name || 'Service',
      String(item.quantity || 0),
      `$${Number(item.price || 0).toFixed(2)}`,
      `$${itemTotal.toFixed(2)}`,
      dueDateStr,
      `${upfrontPct}%`,
      `$${amountPaid.toFixed(2)}`,
      `$${balance.toFixed(2)}`
    ];

    for (let i = 0; i < rowValues.length; i++) {
      const text = rowValues[i];
      // Truncate long service names
      const displayText = i === 0 && text.length > 25 ? text.substring(0, 22) + '...' : text;
      const textWidth = font.widthOfTextAtSize(displayText, 9);
      let xPos = colX[i];
      if (colAligns[i] === 'right') xPos = colX[i] + 50 - textWidth;
      else if (colAligns[i] === 'center') xPos = colX[i] + 25 - textWidth / 2;
      page.drawText(displayText, { x: xPos, y, size: 9, font, color: DARK });
    }

    y -= 6;
    page.drawLine({ start: { x: margin - 5, y }, end: { x: margin + pageWidth + 5, y }, thickness: 0.5, color: rgb(0.9, 0.91, 0.92) });
    y -= 16;
  }

  // --- Totals ---
  y -= 5;
  const totalsX = margin + 320;
  const valuesX = margin + 420;

  const totalsData = [
    ['Subtotal:', `$${Number(invoice.subtotal || 0).toFixed(2)}`],
  ];
  if (invoice.discount_amount > 0) {
    const discLabel = invoice.discount_type === 'percentage' ? `Discount (${invoice.discount_value}%):` : 'Discount:';
    totalsData.push([discLabel, `-$${Number(invoice.discount_amount).toFixed(2)}`]);
  }
  totalsData.push([`Tax (${invoice.tax_rate || 0}%):`, `$${Number(invoice.tax_amount || 0).toFixed(2)}`]);

  for (const [label, value] of totalsData) {
    page.drawText(label, { x: totalsX, y, size: 10, font, color: GRAY });
    const valWidth = font.widthOfTextAtSize(value, 10);
    page.drawText(value, { x: valuesX + 70 - valWidth, y, size: 10, font, color: DARK });
    y -= 18;
  }

  // Total line
  page.drawLine({ start: { x: totalsX, y: y + 12 }, end: { x: valuesX + 70, y: y + 12 }, thickness: 1, color: BLUE });
  const totalLabel = 'Total:';
  const totalValue = `$${Number(invoice.total || 0).toFixed(2)}`;
  page.drawText(totalLabel, { x: totalsX, y, size: 14, font: fontBold, color: BLUE });
  const totalValWidth = fontBold.widthOfTextAtSize(totalValue, 14);
  page.drawText(totalValue, { x: valuesX + 70 - totalValWidth, y, size: 14, font: fontBold, color: BLUE });
  y -= 22;

  // Total Paid & Balance Due
  const totalPaid = items.reduce((sum, i) => sum + Number(i.amount_paid || 0), 0);
  const balanceDue = Number(invoice.total || 0) - totalPaid;
  const GREEN = rgb(0.294, 0.871, 0.498);
  const RED = rgb(0.973, 0.443, 0.443);

  const tpLabel = 'Total Paid:';
  const tpValue = `$${totalPaid.toFixed(2)}`;
  page.drawText(tpLabel, { x: totalsX, y, size: 10, font, color: GREEN });
  const tpWidth = font.widthOfTextAtSize(tpValue, 10);
  page.drawText(tpValue, { x: valuesX + 70 - tpWidth, y, size: 10, font: fontBold, color: GREEN });
  y -= 18;

  const bdLabel = 'Balance Due:';
  const bdValue = `$${balanceDue.toFixed(2)}`;
  const bdColor = balanceDue <= 0 ? GREEN : RED;
  page.drawText(bdLabel, { x: totalsX, y, size: 12, font: fontBold, color: bdColor });
  const bdWidth = fontBold.widthOfTextAtSize(bdValue, 12);
  page.drawText(bdValue, { x: valuesX + 70 - bdWidth, y, size: 12, font: fontBold, color: bdColor });
  y -= 25;

  // --- Notes ---
  if (invoice.notes) {
    page.drawText('Notes:', { x: margin, y, size: 10, font: fontBold, color: DARK });
    y -= 16;
    // Simple word-wrap for notes
    const words = invoice.notes.split(' ');
    let line = '';
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(testLine, 10) > pageWidth) {
        page.drawText(line, { x: margin, y, size: 10, font, color: GRAY });
        y -= 14;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      page.drawText(line, { x: margin, y, size: 10, font, color: GRAY });
      y -= 20;
    }
  }

  // --- Footer ---
  const footerY = 40;
  const footerText = 'Thank you for choosing K9 Vision!';
  const footerWidth = font.widthOfTextAtSize(footerText, 10);
  page.drawText(footerText, { x: (612 - footerWidth) / 2, y: footerY, size: 10, font, color: GRAY });

  return await doc.save();
}
