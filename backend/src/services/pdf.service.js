const PDFDocument = require('pdfkit');

const formatDate = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toISOString().slice(0, 10);
};

const formatAmount = (value, currency = 'Rs.') => {
    const amount = Number(value || 0);
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    return `${currency} ${safeAmount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

class PdfService {
    async generateQuotationPdf({ quotation, companyInfo = {} }) {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const chunks = [];

            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const companyName = companyInfo.company_name || companyInfo.name || 'Your Company';
            const companyEmail = companyInfo.email || '';
            const companyPhone = companyInfo.phone_number || companyInfo.phone || '';
            const companyAddress = [companyInfo.address_line1, companyInfo.city, companyInfo.country]
                .filter(Boolean)
                .join(', ');
            const currency = companyInfo.default_currency === 'PKR' ? 'Rs.' : (companyInfo.default_currency || 'Rs.');

            const items = Array.isArray(quotation.items) ? quotation.items : [];

            const drawHeader = () => {
                doc.fontSize(21).fillColor('#111827').text(companyName, 40, 32);

                doc
                    .fontSize(10)
                    .fillColor('#4b5563')
                    .text(companyAddress || '-', 40, 60)
                    .text(companyPhone || '-', 40, 74)
                    .text(companyEmail || '-', 40, 88);

                doc
                    .fontSize(22)
                    .fillColor('#7c3aed')
                    .text('QUOTATION', 360, 34, { width: 200, align: 'right' });

                doc
                    .fontSize(11)
                    .fillColor('#111827')
                    .text(`No: ${quotation.quotation_number || '-'}`, 360, 64, { width: 200, align: 'right' })
                    .text(`Date: ${formatDate(quotation.quotation_date)}`, 360, 80, { width: 200, align: 'right' })
                    .text(`Valid Until: ${formatDate(quotation.valid_until)}`, 360, 96, { width: 200, align: 'right' })
                    .text(`Status: ${quotation.status || '-'}`, 360, 112, { width: 200, align: 'right' });

                doc.moveTo(40, 130).lineTo(555, 130).strokeColor('#d1d5db').lineWidth(1).stroke();
            };

            const drawCustomerBlock = () => {
                doc
                    .fontSize(10)
                    .fillColor('#6b7280')
                    .text('BILL TO', 40, 148)
                    .fontSize(12)
                    .fillColor('#111827')
                    .text(quotation.customer_name || '-', 40, 165)
                    .fontSize(10)
                    .fillColor('#4b5563')
                    .text(quotation.customer_phone || '-', 40, 183)
                    .text(quotation.customer_email || '-', 40, 197)
                    .text(quotation.customer_address || '-', 40, 211, { width: 280 });

                doc.moveTo(40, 236).lineTo(555, 236).strokeColor('#e5e7eb').lineWidth(1).stroke();
            };

            const drawItemsTableHeader = () => {
                const y = doc.y + 10;

                doc
                    .fontSize(10)
                    .fillColor('#6b7280')
                    .text('Item', 40, y)
                    .text('Qty', 285, y, { width: 60, align: 'right' })
                    .text('Unit Price', 355, y, { width: 90, align: 'right' })
                    .text('Line Total', 455, y, { width: 100, align: 'right' });

                doc.moveTo(40, y + 16).lineTo(555, y + 16).strokeColor('#e5e7eb').lineWidth(1).stroke();
                doc.y = y + 22;
            };

            const ensureTableSpace = () => {
                if (doc.y > 730) {
                    doc.addPage();
                    drawItemsTableHeader();
                }
            };

            drawHeader();
            drawCustomerBlock();

            doc.y = 244;
            drawItemsTableHeader();

            items.forEach((item) => {
                ensureTableSpace();

                const lineStartY = doc.y;
                const lineTotal = Number(item.line_total ?? ((Number(item.quantity || 0) * Number(item.unit_price || 0)) - Number(item.line_discount || 0)));

                doc
                    .fontSize(10)
                    .fillColor('#111827')
                    .text(item.product_name || '-', 40, lineStartY, { width: 220 })
                    .text(String(item.quantity || 0), 285, lineStartY, { width: 60, align: 'right' })
                    .text(formatAmount(item.unit_price, currency), 355, lineStartY, { width: 90, align: 'right' })
                    .text(formatAmount(lineTotal, currency), 455, lineStartY, { width: 100, align: 'right' });

                doc.y = Math.max(doc.y + 8, lineStartY + 20);
                doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#f3f4f6').lineWidth(1).stroke();
                doc.y += 6;
            });

            if (doc.y > 690) doc.addPage();

            const totalsTop = doc.y + 12;
            const subtotal = Number(quotation.subtotal || 0);
            const discount = Number(quotation.discount_amount || 0);
            const tax = Number(quotation.tax_amount || 0);
            const total = Number(quotation.total_amount || 0);

            doc
                .fontSize(10)
                .fillColor('#4b5563')
                .text('Subtotal', 365, totalsTop, { width: 90, align: 'right' })
                .text(formatAmount(subtotal, currency), 455, totalsTop, { width: 100, align: 'right' })
                .text('Discount', 365, totalsTop + 16, { width: 90, align: 'right' })
                .text(formatAmount(discount, currency), 455, totalsTop + 16, { width: 100, align: 'right' })
                .text('Tax', 365, totalsTop + 32, { width: 90, align: 'right' })
                .text(formatAmount(tax, currency), 455, totalsTop + 32, { width: 100, align: 'right' });

            doc
                .moveTo(365, totalsTop + 50)
                .lineTo(555, totalsTop + 50)
                .strokeColor('#d1d5db')
                .lineWidth(1)
                .stroke();

            doc
                .fontSize(12)
                .fillColor('#111827')
                .text('Total', 365, totalsTop + 58, { width: 90, align: 'right' })
                .fontSize(13)
                .fillColor('#7c3aed')
                .text(formatAmount(total, currency), 455, totalsTop + 56, { width: 100, align: 'right' });

            if (quotation.notes) {
                const notesY = Math.max(totalsTop + 94, doc.y + 20);
                doc
                    .fontSize(10)
                    .fillColor('#6b7280')
                    .text('Notes', 40, notesY)
                    .fontSize(10)
                    .fillColor('#111827')
                    .text(String(quotation.notes), 40, notesY + 14, { width: 320 });
            }

            doc
                .fontSize(9)
                .fillColor('#9ca3af')
                .text('Generated by ZYNC ERP', 40, doc.page.height - 36);

            doc.end();
        });
    }
}

module.exports = PdfService;