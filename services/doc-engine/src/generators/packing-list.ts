import { wrapHtml, esc, formatDate, partyBox } from "../html-base.js";
import type { DocContext } from "../validator.js";

export function generatePackingList(ctx: DocContext): string {
  const s = ctx.shipment;
  const docNumber = `PL-${s.reference || "DRAFT"}`;

  const body = `
    <div class="header">
      <div class="header-left">
        <h1>PACKING LIST</h1>
        <div class="subtitle">Shipment Packing Details</div>
      </div>
      <div class="header-right">
        <div class="doc-number">${esc(docNumber)}</div>
        <div class="date">${formatDate(new Date())}</div>
      </div>
    </div>

    <div class="parties">
      ${partyBox("Shipper", ctx.shipper)}
      ${partyBox("Consignee", ctx.consignee)}
    </div>

    <div class="section">
      <div class="section-title">Shipment Information</div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Reference</span><span class="info-value">${esc(s.reference)}</span></div>
        <div class="info-item"><span class="info-label">B/L Number</span><span class="info-value">${esc(s.blNumber || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Booking No.</span><span class="info-value">${esc(s.bookingNumber || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Vessel / Voyage</span><span class="info-value">${esc([s.vessel, s.voyage].filter(Boolean).join(" / ") || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Port of Loading</span><span class="info-value">${esc(s.portOfLoading || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Port of Discharge</span><span class="info-value">${esc(s.portOfDischarge || "N/A")}</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Cargo Details</div>
      <table>
        <thead><tr>
          <th class="text-center" style="width:40px">#</th>
          <th>Description / Commodity</th>
          <th class="text-center">Packages</th>
          <th class="text-center">Gross Weight</th>
          <th class="text-center">Volume</th>
        </tr></thead>
        <tbody>
          <tr>
            <td class="text-center">1</td>
            <td>
              ${esc(s.commodity || "Goods as described")}
              ${s.hsCode ? `<br><span style="color:#6b7280;font-size:10px">HS Code: ${esc(s.hsCode)}</span>` : ""}
            </td>
            <td class="text-center">${s.packageCount || "-"}</td>
            <td class="text-center">${s.grossWeight ? `${s.grossWeight} ${esc(s.weightUnit || "KG")}` : "-"}</td>
            <td class="text-center">${s.volume ? `${s.volume} ${esc(s.volumeUnit || "CBM")}` : "-"}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Totals</div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Total Packages</span><span class="info-value">${s.packageCount || "-"}</span></div>
        <div class="info-item"><span class="info-label">Total Gross Weight</span><span class="info-value">${s.grossWeight ? `${s.grossWeight} ${esc(s.weightUnit || "KG")}` : "-"}</span></div>
        <div class="info-item"><span class="info-label">Total Volume</span><span class="info-value">${s.volume ? `${s.volume} ${esc(s.volumeUnit || "CBM")}` : "-"}</span></div>
      </div>
    </div>

    ${ctx.notifyParty ? `
    <div class="section">
      <div class="section-title">Notify Party</div>
      <div style="padding:8px 12px;background:#f8f9fb;border:1px solid #e5e7eb;border-radius:4px;font-size:11px">
        <strong>${esc(ctx.notifyParty.name)}</strong>
        ${ctx.notifyParty.address ? `<br>${esc(ctx.notifyParty.address)}` : ""}
        ${ctx.notifyParty.contactEmail ? `<br>${esc(ctx.notifyParty.contactEmail)}` : ""}
      </div>
    </div>` : ""}
  `;

  return wrapHtml("Packing List", body, docNumber);
}
