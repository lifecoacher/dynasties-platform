import { wrapHtml, esc, formatCurrency, formatDate, partyBox } from "../html-base.js";
import type { DocContext } from "../validator.js";

export function generateShipmentSummary(ctx: DocContext): string {
  const s = ctx.shipment;
  const inv = ctx.invoice;
  const docNumber = `SS-${s.reference || "DRAFT"}`;

  const statusColor = s.status === "DELIVERED" ? "#00BFA6" : s.status === "IN_TRANSIT" ? "#4EAEE3" : s.status === "CANCELLED" || s.status === "REJECTED" ? "#E05252" : "#D4A24C";

  const body = `
    <div class="header">
      <div class="header-left">
        <h1>SHIPMENT SUMMARY</h1>
        <div class="subtitle">Comprehensive Shipment Overview</div>
      </div>
      <div class="header-right">
        <div class="doc-number">${esc(s.reference)}</div>
        <div class="date">${formatDate(new Date())}</div>
        <div style="display:inline-block;padding:3px 10px;background:${statusColor}15;color:${statusColor};font-weight:700;font-size:11px;border-radius:4px;margin-top:4px">${esc(s.status)}</div>
      </div>
    </div>

    <div class="parties">
      ${partyBox("Shipper", ctx.shipper)}
      ${partyBox("Consignee", ctx.consignee)}
    </div>

    <div class="section">
      <div class="section-title">Routing &amp; Transport</div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Reference</span><span class="info-value">${esc(s.reference)}</span></div>
        <div class="info-item"><span class="info-label">Status</span><span class="info-value">${esc(s.status)}</span></div>
        <div class="info-item"><span class="info-label">Port of Loading</span><span class="info-value">${esc(s.portOfLoading || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Port of Discharge</span><span class="info-value">${esc(s.portOfDischarge || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Vessel</span><span class="info-value">${esc(s.vessel || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Voyage</span><span class="info-value">${esc(s.voyage || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Booking No.</span><span class="info-value">${esc(s.bookingNumber || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">B/L Number</span><span class="info-value">${esc(s.blNumber || "N/A")}</span></div>
        ${s.etd ? `<div class="info-item"><span class="info-label">ETD</span><span class="info-value">${formatDate(s.etd)}</span></div>` : ""}
        ${s.eta ? `<div class="info-item"><span class="info-label">ETA</span><span class="info-value">${formatDate(s.eta)}</span></div>` : ""}
        <div class="info-item"><span class="info-label">Freight Terms</span><span class="info-value">${esc(s.freightTerms || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Incoterms</span><span class="info-value">${esc(s.incoterms || "N/A")}</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Cargo Details</div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Commodity</span><span class="info-value">${esc(s.commodity || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">HS Code</span><span class="info-value">${esc(s.hsCode || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Packages</span><span class="info-value">${s.packageCount || "N/A"}</span></div>
        <div class="info-item"><span class="info-label">Gross Weight</span><span class="info-value">${s.grossWeight ? `${s.grossWeight} ${esc(s.weightUnit || "KG")}` : "N/A"}</span></div>
        <div class="info-item"><span class="info-label">Volume</span><span class="info-value">${s.volume ? `${s.volume} ${esc(s.volumeUnit || "CBM")}` : "N/A"}</span></div>
        <div class="info-item"><span class="info-label">Cargo Value</span><span class="info-value">${formatCurrency(s.cargoValue, inv?.currency || "USD")}</span></div>
      </div>
    </div>

    ${ctx.carrier ? `
    <div class="section">
      <div class="section-title">Carrier</div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Name</span><span class="info-value">${esc(ctx.carrier.name)}</span></div>
        ${ctx.carrier.scacCode ? `<div class="info-item"><span class="info-label">SCAC</span><span class="info-value">${esc(ctx.carrier.scacCode)}</span></div>` : ""}
        ${ctx.carrier.contactEmail ? `<div class="info-item"><span class="info-label">Contact</span><span class="info-value">${esc(ctx.carrier.contactEmail)}</span></div>` : ""}
      </div>
    </div>` : ""}

    ${inv ? `
    <div class="section">
      <div class="section-title">Financial Summary</div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Invoice</span><span class="info-value">${esc(inv.invoiceNumber)}</span></div>
        <div class="info-item"><span class="info-label">Status</span><span class="info-value">${esc(inv.status)}</span></div>
        <div class="info-item"><span class="info-label">Subtotal</span><span class="info-value">${formatCurrency(inv.subtotal, inv.currency)}</span></div>
        <div class="info-item"><span class="info-label">Grand Total</span><span class="info-value">${formatCurrency(inv.grandTotal, inv.currency)}</span></div>
        ${inv.dueDate ? `<div class="info-item"><span class="info-label">Due Date</span><span class="info-value">${formatDate(inv.dueDate)}</span></div>` : ""}
        ${inv.paymentTerms ? `<div class="info-item"><span class="info-label">Payment Terms</span><span class="info-value">${esc(inv.paymentTerms)}</span></div>` : ""}
      </div>
    </div>` : ""}

    ${ctx.lineItems.length > 0 ? `
    <div class="section">
      <div class="section-title">Charge Breakdown</div>
      <table>
        <thead><tr>
          <th>Type</th>
          <th>Description</th>
          <th class="text-center">Qty</th>
          <th class="text-right">Amount</th>
        </tr></thead>
        <tbody>
          ${ctx.lineItems.map(li => `
            <tr>
              <td><span style="font-size:9px;font-weight:600;text-transform:uppercase;padding:2px 6px;background:#f0f1f3;border-radius:3px">${esc(li.lineType || "FEE")}</span></td>
              <td>${esc(li.description || "-")}</td>
              <td class="text-center">${li.quantity || 1}</td>
              <td class="text-right">${formatCurrency(li.amount, inv?.currency)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>` : ""}

    ${ctx.notifyParty ? `
    <div class="section">
      <div class="section-title">Notify Party</div>
      <div style="padding:8px 12px;background:#f8f9fb;border:1px solid #e5e7eb;border-radius:4px;font-size:11px">
        <strong>${esc(ctx.notifyParty.name)}</strong>
        ${ctx.notifyParty.address ? ` &mdash; ${esc(ctx.notifyParty.address)}` : ""}
      </div>
    </div>` : ""}
  `;

  return wrapHtml("Shipment Summary", body, docNumber);
}
