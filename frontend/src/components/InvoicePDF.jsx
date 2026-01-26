import html2pdf from 'html2pdf.js'

export function generateInvoicePDF(saleData, companyName = 'ZYNC ERP') {
    // Debug logging
    console.log('=== PDF Generator Debug ===')
    console.log('Full saleData:', saleData)

    // Extract customer data - handle both nested and flattened
    const customerName = saleData.customer?.name || saleData.customer_name || 'Walk-in Customer'
    const customerPhone = saleData.customer?.phone || saleData.customer_phone || ''
    const customerEmail = saleData.customer?.email || saleData.customer_email || ''
    const customerAddress = saleData.customer?.address || saleData.customer_address || ''

    // Extract invoice data with fallbacks
    const invoiceNumber = saleData.invoice_number || 'N/A'
    const invoiceDate = saleData.invoice_date || new Date().toISOString()
    const items = saleData.items || []
    const subtotal = saleData.subtotal || 0
    const discountAmount = saleData.discount_amount || 0
    const taxAmount = saleData.tax_amount || 0
    const totalAmount = saleData.total_amount || 0
    const paidAmount = saleData.paid_amount || 0
    const paymentMethod = saleData.payment_method || 'cash'
    const paymentStatus = saleData.payment_status || 'paid'

    console.log('Extracted:', { invoiceNumber, totalAmount, itemsCount: items.length })
    console.log('===========================')

    // Create HTML content for invoice
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Invoice ${invoiceNumber}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; color: #000 !important; }
                body { font-family: Arial, sans-serif; background: white; }
                .invoice-container {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 40px;
                    background: white;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 30px;
                    border-bottom: 3px solid #1e3c72;
                    padding-bottom: 20px;
                }
                .company-info h1 {
                    font-size: 28px;
                    color: #1e3c72 !important;
                    margin-bottom: 5px;
                }
                .company-info p {
                    font-size: 12px;
                    margin: 2px 0;
                }
                .invoice-meta {
                    text-align: right;
                }
                .invoice-meta h2 {
                    font-size: 18px;
                    color: #1e3c72 !important;
                    margin-bottom: 8px;
                }
                .meta-row {
                    display: flex;
                    justify-content: space-between;
                    margin: 4px 0;
                    font-size: 12px;
                }
                .meta-label {
                    font-weight: bold;
                    min-width: 100px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                }
                thead {
                    background-color: #1e3c72;
                }
                th {
                    padding: 12px;
                    text-align: left;
                    font-size: 12px;
                    font-weight: bold;
                    color: white !important;
                }
                td {
                    padding: 10px 12px;
                    font-size: 12px;
                    border-bottom: 1px solid #eee;
                }
                .text-right {
                    text-align: right;
                }
                .text-center {
                    text-align: center;
                }
                .summary {
                    display: flex;
                    justify-content: flex-end;
                    margin: 30px 0;
                }
                .summary-box {
                    width: 300px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    padding: 15px;
                }
                .summary-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    font-size: 12px;
                }
                .summary-row.total {
                    border-top: 2px solid #1e3c72;
                    padding-top: 10px;
                    margin-top: 10px;
                    font-size: 14px;
                    font-weight: bold;
                }
                .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                    text-align: center;
                    font-size: 11px;
                }
            </style>
        </head>
        <body>
            <div class="invoice-container">
                <!-- Header -->
                <div class="header">
                    <div class="company-info">
                        <h1>🏢 ${companyName}</h1>
                        <p>📍 Kathmandu, Nepal</p>
                        <p>📞 +977-1-XXXXXXX</p>
                        <p>📧 info@zync.com</p>
                    </div>
                    <div class="invoice-meta">
                        <h2>📄 INVOICE</h2>
                        <div class="meta-row">
                            <span class="meta-label">Invoice #:</span>
                            <span>${invoiceNumber}</span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">Date:</span>
                            <span>${new Date(invoiceDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })}</span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">Payment:</span>
                            <span>${paymentMethod === 'cash' ? '💵 Cash' : paymentMethod === 'bank' ? '🏦 Bank' : '💳 Cheque'}</span>
                        </div>
                    </div>
                </div>

                <!-- Customer Info -->
                <div style="margin-bottom: 30px;">
                    <h3 style="font-size: 12px; color: #1e3c72 !important; margin-bottom: 10px;">📋 BILL TO:</h3>
                    <p style="font-size: 12px; line-height: 1.6;">
                        <strong>${customerName}</strong><br>
                        ${customerPhone ? `Phone: ${customerPhone}<br>` : ''}
                        ${customerEmail ? `Email: ${customerEmail}<br>` : ''}
                        ${customerAddress ? `Address: ${customerAddress}` : ''}
                    </p>
                </div>

                <!-- Items Table -->
                <table>
                    <thead>
                        <tr>
                            <th>📦 Product</th>
                            <th class="text-center">Qty</th>
                            <th class="text-right">Unit Price</th>
                            <th class="text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td>${item.product_name || item.name || 'Product'}</td>
                                <td class="text-center">${item.quantity || 0}</td>
                                <td class="text-right">Rs. ${(item.unit_price || 0).toLocaleString()}</td>
                                <td class="text-right"><strong>Rs. ${(item.line_total || (item.unit_price * item.quantity) || 0).toLocaleString()}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <!-- Summary -->
                <div class="summary">
                    <div class="summary-box">
                        <div class="summary-row">
                            <span>Subtotal:</span>
                            <span>Rs. ${subtotal.toLocaleString()}</span>
                        </div>
                        ${discountAmount > 0 ? `
                            <div class="summary-row">
                                <span>Discount:</span>
                                <span>-Rs. ${discountAmount.toLocaleString()}</span>
                            </div>
                        ` : ''}
                        ${taxAmount > 0 ? `
                            <div class="summary-row">
                                <span>Tax:</span>
                                <span>+Rs. ${taxAmount.toLocaleString()}</span>
                            </div>
                        ` : ''}
                        <div class="summary-row total">
                            <span>Total Amount:</span>
                            <span>Rs. ${totalAmount.toLocaleString()}</span>
                        </div>
                        <div class="summary-row" style="background: #f0f8ff; padding: 6px; margin: 6px 0; border-radius: 3px;">
                            <span>Paid:</span>
                            <span>Rs. ${paidAmount.toLocaleString()}</span>
                        </div>
                        ${paidAmount < totalAmount ? `
                            <div class="summary-row" style="background: #fff8dc; padding: 6px; margin: 6px 0; border-radius: 3px;">
                                <span>Due:</span>
                                <span>Rs. ${(totalAmount - paidAmount).toLocaleString()}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="footer">
                    <p>Thank you for your business! 🙏</p>
                    <p>Generated on ${new Date().toLocaleString()} | Computer-generated document</p>
                </div>
            </div>
        </body>
        </html>
    `

    // Configuration for html2pdf
    const options = {
        margin: 10,
        filename: `Invoice_${invoiceNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
    }

    // Generate PDF
    html2pdf().set(options).from(htmlContent).save()
}

export function InvoicePDFButton({ saleData, variant = 'primary' }) {
    const handlePrintPDF = () => {
        if (!saleData) {
            alert('No sale data available')
            return
        }
        generateInvoicePDF(saleData)
    }

    return (
        <button
            onClick={handlePrintPDF}
            className={`btn btn-${variant}`}
            style={{
                padding: '8px 16px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
            }}
        >
            📄 Print PDF
        </button>
    )
}
