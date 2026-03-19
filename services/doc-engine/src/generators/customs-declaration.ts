import { wrapHtml, esc, formatCurrency, formatDate, partyBox } from "../html-base.js";
import type { DocContext } from "../validator.js";

export function generateCustomsDeclaration(ctx: DocContext): string {
  const s = ctx.shipment;
  const docNumber = `CD-${s.reference || "DRAFT"}`;
  const currency = ctx.invoice?.currency || "USD";

  const body = `
    <div class="header">
      <div class="header-left">
        <h1>CUSTOMS DECLARATION</h1>
        <div class="subtitle">Export / Import Documentation Scaffold</div>
      </div>
      <div class="header-right">
        <div class="doc-number">${esc(docNumber)}</div>
        <div class="date">${formatDate(new Date())}</div>
      </div>
    </div>

    <div class="warning">
      This is a system-generated customs declaration scaffold. It must be reviewed by a licensed customs broker and filed with the appropriate customs authority.
    </div>

    <div class="parties">
      ${partyBox("Exporter", ctx.shipper)}
      ${partyBox("Importer", ctx.consignee)}
    </div>

    <div class="section">
      <div class="section-title">Declaration Details</div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Shipment Ref</span><span class="info-value">${esc(s.reference)}</span></div>
        <div class="info-item"><span class="info-label">B/L Number</span><span class="info-value">${esc(s.blNumber || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Port of Export</span><span class="info-value">${esc(s.portOfLoading || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Port of Import</span><span class="info-value">${esc(s.portOfDischarge || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Country of Origin</span><span class="info-value">${esc(ctx.shipper?.country || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Country of Dest.</span><span class="info-value">${esc(ctx.consignee?.country || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Incoterms</span><span class="info-value">${esc(s.incoterms || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Transport Mode</span><span class="info-value">Ocean Freight</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Goods Declaration</div>
      <table>
        <thead><tr>
          <th style="width:80px">HS Code</th>
          <th>Description of Goods</th>
          <th class="text-center">Packages</th>
          <th class="text-center">Gross Weight</th>
          <th class="text-right">Declared Value</th>
        </tr></thead>
        <tbody>
          <tr>
            <td><strong>${esc(s.hsCode || "N/A")}</strong></td>
            <td>${esc(s.commodity || "Goods as described")}</td>
            <td class="text-center">${s.packageCount || "-"}</td>
            <td class="text-center">${s.grossWeight ? `${s.grossWeight} ${esc(s.weightUnit || "KG")}` : "-"}</td>
            <td class="text-right">${formatCurrency(s.cargoValue, currency)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Carrier Information</div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Carrier</span><span class="info-value">${esc(ctx.carrier?.name || s.carrier || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Vessel</span><span class="info-value">${esc(s.vessel || "N/A")}</span></div>
        <div class="info-item"><span class="info-label">Voyage</span><span class="info-value">${esc(s.voyage || "N/A")}</span></div>
      </div>
    </div>

    <div style="margin-top:24px">
      <div style="font-size:9px;font-weight:600;text-transform:uppercase;color:#6b7280;margin-bottom:8px">Declarant's Certification</div>
      <div style="padding:12px;background:#f8f9fb;border:1px solid #e5e7eb;border-radius:4px;font-size:10px;color:#6b7280">
        I hereby declare that the information provided is true and correct to the best of my knowledge. I accept responsibility for any inaccuracies.
      </div>
      <div style="border-bottom:1px solid #1a1a2e;width:200px;margin-top:40px"></div>
      <div style="font-size:9px;color:#6b7280;margin-top:4px">Authorized Signature &amp; Date</div>
    </div>
  `;

  return wrapHtml("Customs Declaration", body, docNumber);
}
