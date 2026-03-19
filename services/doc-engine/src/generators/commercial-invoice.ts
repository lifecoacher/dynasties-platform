import { wrapHtml, esc, formatCurrency, formatDate, partyBox } from "../html-base.js";
import type { DocContext } from "../validator.js";

export function generateCommercialInvoice(ctx: DocContext): string {
  const s = ctx.shipment;
  const inv = ctx.invoice;
  const invNumber = inv?.invoiceNumber || `CI-${s.reference || "DRAFT"}`;
  const currency = inv?.currency || "USD";

  let lineItemsHtml = "";
  if (ctx.lineItems.length > 0) {
    const rows = ctx.lineItems.map((li, i) => `
      <tr>
        <td class="text-center">${i + 1}</td>
        <td>${esc(li.description || s.commodity || "-")}</td>
        <td class="text-center">${li.quantity || 1}</td>
        <td class="text-right">${formatCurrency(li.unitPrice, currency)}</td>
        <td class="text-right">${formatCurrency(li.amount, currency)}</td>
      </tr>
    `).join("");

    lineItemsHtml = `
      <table>
        <thead><tr>
          <th class="text-center" style="width:40px">#</th>
          <th>Description</th>
          <th class="text-center" style="width:60px">Qty</th>
          <th class="text-right" style="width:100px">Unit Price</th>
          <th class="text-right" style="width:100px">Amount</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  } else {
    lineItemsHtml = `
      <table>
        <thead><tr>
          <th class="text-center" style="width:40px">#</th>
          <th>Description</th>
          <th class="text-center" style="width:80px">Packages</th>
          <th class="text-right" style="width:100px">Value</th>
        </tr></thead>
        <tbody>
          <tr>
            <td class="text-center">1</td>
            <td>${esc(s.commodity || "Goods as described")}<br><span style="color:#6b7280;font-size:10px">HS Code: ${esc(s.hsCode || "N/A")}</span></td>
            <td class="text-center">${s.packageCount || "-"}</td>
            <td class="text-right">${formatCurrency(s.cargoValue, currency)}</td>
          </tr>
        </tbody>
      </table>
    `;
  }

  const subtotal = inv?.subtotal || s.cargoValue || 0;
  const tax = inv?.taxTotal || 0;
  const total = inv?.grandTotal || subtotal;

  const body = `
    <div class="header">
      <div class="header-left">
        <h1>COMMERCIAL INVOICE</h1>
        <div class="subtitle">International Trade Document</div>
      </div>
      <div class="header-right">
        <div class="doc-number">${esc(invNumber)}</div>
        <div class="date">${formatDate(inv?.issuedAt || new Date())}</div>
      </div>
    </div>

    <div class="parties">
      ${partyBox("Seller / Exporter", ctx.shipper)}
      ${partyBox("Buyer / Importer", ctx.consignee)}
    </div>

    <div class="section">
      <div class="section-title">Shipment Details</div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Reference</span><span class="info-value">${esc(s.reference)}</span></div>
        <div class="info-item"><span class="info-label">Incoterms</span><span class="info-value">${esc(s.incoterms || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Port of Loading</span><span class="info-value">${esc(s.portOfLoading || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Port of Discharge</span><span class="info-value">${esc(s.portOfDischarge || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Vessel / Voyage</span><span class="info-value">${esc([s.vessel, s.voyage].filter(Boolean).join(" / ") || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Currency</span><span class="info-value">${esc(currency)}</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Items</div>
      ${lineItemsHtml}
    </div>

    <table class="totals">
      <tr><td>Subtotal</td><td class="text-right">${formatCurrency(subtotal, currency)}</td></tr>
      ${Number(tax) > 0 ? `<tr><td>Tax</td><td class="text-right">${formatCurrency(tax, currency)}</td></tr>` : ""}
      <tr class="grand-total"><td>Total Due</td><td class="text-right">${formatCurrency(total, currency)}</td></tr>
    </table>

    ${inv?.paymentTerms ? `<div style="margin-top:12px;font-size:10px;color:#6b7280">Payment Terms: ${esc(inv.paymentTerms)}</div>` : ""}
  `;

  return wrapHtml("Commercial Invoice", body, invNumber);
}
