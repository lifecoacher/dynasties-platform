import { wrapHtml, esc, formatDate, partyBox } from "../html-base.js";
import type { DocContext } from "../validator.js";

export function generateBillOfLading(ctx: DocContext): string {
  const s = ctx.shipment;
  const blNumber = s.blNumber || `BL-${s.reference || "DRAFT"}`;

  const body = `
    <div class="header">
      <div class="header-left">
        <h1>BILL OF LADING</h1>
        <div class="subtitle">Draft &mdash; Not Negotiable Until Signed</div>
      </div>
      <div class="header-right">
        <div class="doc-number">${esc(blNumber)}</div>
        <div class="date">${formatDate(new Date())}</div>
        <div class="stamp">DRAFT</div>
      </div>
    </div>

    <div class="warning">
      This is a system-generated draft Bill of Lading. It must be reviewed and signed by the carrier before it becomes a negotiable document.
    </div>

    <div class="parties">
      ${partyBox("Shipper", ctx.shipper)}
      ${partyBox("Consignee", ctx.consignee)}
    </div>

    <div style="margin-bottom:24px">
      ${partyBox("Notify Party", ctx.notifyParty)}
    </div>

    <div class="section">
      <div class="section-title">Voyage Details</div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">B/L Number</span><span class="info-value">${esc(blNumber)}</span></div>
        <div class="info-item"><span class="info-label">Booking No.</span><span class="info-value">${esc(s.bookingNumber || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Vessel</span><span class="info-value">${esc(s.vessel || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Voyage</span><span class="info-value">${esc(s.voyage || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Port of Loading</span><span class="info-value">${esc(s.portOfLoading || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Port of Discharge</span><span class="info-value">${esc(s.portOfDischarge || "N/A")}</span></div>
        ${s.etd ? `<div class="info-item"><span class="info-label">ETD</span><span class="info-value">${formatDate(s.etd)}</span></div>` : ""}
        ${s.eta ? `<div class="info-item"><span class="info-label">ETA</span><span class="info-value">${formatDate(s.eta)}</span></div>` : ""}
        <div class="info-item"><span class="info-label">Freight Terms</span><span class="info-value">${esc(s.freightTerms || "PREPAID")}</span></div>
        ${s.carrier ? `<div class="info-item"><span class="info-label">Carrier</span><span class="info-value">${esc(ctx.carrier?.name || s.carrier)}</span></div>` : ""}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Particulars of Cargo</div>
      <table>
        <thead><tr>
          <th>Marks &amp; Numbers</th>
          <th>Description of Goods</th>
          <th class="text-center">Packages</th>
          <th class="text-center">Gross Weight</th>
          <th class="text-center">Measurement</th>
        </tr></thead>
        <tbody>
          <tr>
            <td>${esc(s.reference || "-")}</td>
            <td>
              ${esc(s.commodity || "As per commercial invoice")}
              ${s.hsCode ? `<br><span style="font-size:10px;color:#6b7280">HS: ${esc(s.hsCode)}</span>` : ""}
            </td>
            <td class="text-center">${s.packageCount || "-"}</td>
            <td class="text-center">${s.grossWeight ? `${s.grossWeight} ${esc(s.weightUnit || "KG")}` : "-"}</td>
            <td class="text-center">${s.volume ? `${s.volume} ${esc(s.volumeUnit || "CBM")}` : "-"}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:32px">
      <div>
        <div style="font-size:9px;font-weight:600;text-transform:uppercase;color:#6b7280;margin-bottom:24px">Shipper's Signature</div>
        <div style="border-bottom:1px solid #1a1a2e;width:200px;margin-top:40px"></div>
      </div>
      <div>
        <div style="font-size:9px;font-weight:600;text-transform:uppercase;color:#6b7280;margin-bottom:24px">Carrier's Signature</div>
        <div style="border-bottom:1px solid #1a1a2e;width:200px;margin-top:40px"></div>
      </div>
    </div>
  `;

  return wrapHtml("Bill of Lading (Draft)", body, blNumber);
}
