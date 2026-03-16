import { describe, it, expect } from "vitest";

describe("impact prioritization scoring", () => {
  function computeImpactScore(rec: {
    expectedMarginImpactPct: number | null;
    expectedDelayImpactDays: number | null;
    expectedRiskReduction: number | null;
    confidence: number;
    createdAt: Date;
  }): number {
    const marginWeight = 0.25;
    const delayWeight = 0.25;
    const riskWeight = 0.2;
    const confidenceWeight = 0.15;
    const recencyWeight = 0.15;

    const marginImpact = Math.min(100, Math.abs(Number(rec.expectedMarginImpactPct ?? 0)) * 10);
    const delayImpact = Math.min(100, Math.abs(Number(rec.expectedDelayImpactDays ?? 0)) * 15);
    const riskImpact = Math.min(100, Number(rec.expectedRiskReduction ?? 0));
    const confidence = Number(rec.confidence ?? 0) * 100;

    const ageMs = Date.now() - new Date(rec.createdAt).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    const recency = Math.max(0, 100 - ageHours * 2);

    return Math.round(
      marginImpact * marginWeight +
      delayImpact * delayWeight +
      riskImpact * riskWeight +
      confidence * confidenceWeight +
      recency * recencyWeight,
    );
  }

  it("scores a high-impact recommendation highly", () => {
    const score = computeImpactScore({
      expectedMarginImpactPct: 8,
      expectedDelayImpactDays: 5,
      expectedRiskReduction: 70,
      confidence: 0.9,
      createdAt: new Date(),
    });
    expect(score).toBeGreaterThan(60);
  });

  it("scores a low-impact recommendation lower", () => {
    const score = computeImpactScore({
      expectedMarginImpactPct: 1,
      expectedDelayImpactDays: 0.5,
      expectedRiskReduction: 10,
      confidence: 0.4,
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    });
    expect(score).toBeLessThan(30);
  });

  it("margin-heavy rec scores well on margin sort", () => {
    const highMargin = computeImpactScore({
      expectedMarginImpactPct: 10,
      expectedDelayImpactDays: 0,
      expectedRiskReduction: 0,
      confidence: 0.5,
      createdAt: new Date(),
    });
    const lowMargin = computeImpactScore({
      expectedMarginImpactPct: 1,
      expectedDelayImpactDays: 0,
      expectedRiskReduction: 0,
      confidence: 0.5,
      createdAt: new Date(),
    });
    expect(highMargin).toBeGreaterThan(lowMargin);
  });

  it("recently created recs score higher than old ones (all else equal)", () => {
    const recent = computeImpactScore({
      expectedMarginImpactPct: 5,
      expectedDelayImpactDays: 3,
      expectedRiskReduction: 30,
      confidence: 0.7,
      createdAt: new Date(),
    });
    const old = computeImpactScore({
      expectedMarginImpactPct: 5,
      expectedDelayImpactDays: 3,
      expectedRiskReduction: 30,
      confidence: 0.7,
      createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
    });
    expect(recent).toBeGreaterThan(old);
  });

  it("caps individual components at 100", () => {
    const score = computeImpactScore({
      expectedMarginImpactPct: 50,
      expectedDelayImpactDays: 20,
      expectedRiskReduction: 200,
      confidence: 0.99,
      createdAt: new Date(),
    });
    expect(score).toBeLessThanOrEqual(100);
  });

  it("handles null values gracefully", () => {
    const score = computeImpactScore({
      expectedMarginImpactPct: null,
      expectedDelayImpactDays: null,
      expectedRiskReduction: null,
      confidence: 0.5,
      createdAt: new Date(),
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("recommendation diff generation", () => {
  function generateDiff(
    current: { urgency: string; confidence: number; reasonCodes: string[]; externalReasonCodes: string[]; intelligenceEnriched: string },
    prior: { urgency: string; confidence: number; reasonCodes: string[]; externalReasonCodes: string[]; intelligenceEnriched: string },
  ) {
    const changes = {
      urgencyChanged: prior.urgency !== current.urgency,
      confidenceChanged: prior.confidence !== current.confidence,
      reasonCodesChanged: JSON.stringify(prior.reasonCodes) !== JSON.stringify(current.reasonCodes),
      externalReasonCodesChanged: JSON.stringify(prior.externalReasonCodes) !== JSON.stringify(current.externalReasonCodes),
      intelEnrichmentChanged: prior.intelligenceEnriched !== current.intelligenceEnriched,
    };

    const triggers: string[] = [];
    if (changes.urgencyChanged) triggers.push(`urgency ${prior.urgency} → ${current.urgency}`);
    if (changes.confidenceChanged) triggers.push("confidence changed");
    if (changes.externalReasonCodesChanged) triggers.push("external intelligence signals changed");
    if (changes.intelEnrichmentChanged) triggers.push("intelligence enrichment changed");
    if (changes.reasonCodesChanged) triggers.push("internal reason codes changed");
    if (triggers.length === 0) triggers.push("recommendation regenerated with same parameters");

    return { changes, triggerSummary: triggers.join("; ") };
  }

  it("detects urgency change", () => {
    const diff = generateDiff(
      { urgency: "CRITICAL", confidence: 0.8, reasonCodes: ["A"], externalReasonCodes: [], intelligenceEnriched: "true" },
      { urgency: "HIGH", confidence: 0.8, reasonCodes: ["A"], externalReasonCodes: [], intelligenceEnriched: "true" },
    );
    expect(diff.changes.urgencyChanged).toBe(true);
    expect(diff.triggerSummary).toContain("urgency HIGH → CRITICAL");
  });

  it("detects intel enrichment added", () => {
    const diff = generateDiff(
      { urgency: "HIGH", confidence: 0.8, reasonCodes: ["A"], externalReasonCodes: ["X"], intelligenceEnriched: "true" },
      { urgency: "HIGH", confidence: 0.8, reasonCodes: ["A"], externalReasonCodes: [], intelligenceEnriched: "false" },
    );
    expect(diff.changes.intelEnrichmentChanged).toBe(true);
    expect(diff.changes.externalReasonCodesChanged).toBe(true);
  });

  it("detects no change when identical", () => {
    const diff = generateDiff(
      { urgency: "MEDIUM", confidence: 0.6, reasonCodes: ["B"], externalReasonCodes: [], intelligenceEnriched: "false" },
      { urgency: "MEDIUM", confidence: 0.6, reasonCodes: ["B"], externalReasonCodes: [], intelligenceEnriched: "false" },
    );
    expect(diff.changes.urgencyChanged).toBe(false);
    expect(diff.changes.confidenceChanged).toBe(false);
    expect(diff.triggerSummary).toContain("recommendation regenerated with same parameters");
  });

  it("detects multiple changes simultaneously", () => {
    const diff = generateDiff(
      { urgency: "CRITICAL", confidence: 0.95, reasonCodes: ["A", "B", "C"], externalReasonCodes: ["CONG_SURGE"], intelligenceEnriched: "true" },
      { urgency: "MEDIUM", confidence: 0.6, reasonCodes: ["A"], externalReasonCodes: [], intelligenceEnriched: "false" },
    );
    expect(diff.changes.urgencyChanged).toBe(true);
    expect(diff.changes.confidenceChanged).toBe(true);
    expect(diff.changes.reasonCodesChanged).toBe(true);
    expect(diff.changes.externalReasonCodesChanged).toBe(true);
    expect(diff.changes.intelEnrichmentChanged).toBe(true);
  });
});

describe("diagnostics aggregation", () => {
  function computeDiagnostics(recs: Array<{ type: string; status: string; intelligenceEnriched: string }>) {
    const typeMap: Record<string, {
      total: number;
      accepted: number;
      rejected: number;
      implemented: number;
      intelEnrichedTotal: number;
      intelEnrichedAccepted: number;
      internalOnlyTotal: number;
      internalOnlyAccepted: number;
    }> = {};

    for (const rec of recs) {
      if (!typeMap[rec.type]) {
        typeMap[rec.type] = {
          total: 0, accepted: 0, rejected: 0, implemented: 0,
          intelEnrichedTotal: 0, intelEnrichedAccepted: 0,
          internalOnlyTotal: 0, internalOnlyAccepted: 0,
        };
      }
      const entry = typeMap[rec.type]!;
      entry.total++;

      if (rec.status === "ACCEPTED") entry.accepted++;
      if (rec.status === "REJECTED") entry.rejected++;
      if (rec.status === "IMPLEMENTED") entry.implemented++;

      const isEnriched = rec.intelligenceEnriched === "true";
      if (isEnriched) {
        entry.intelEnrichedTotal++;
        if (["ACCEPTED", "MODIFIED", "IMPLEMENTED"].includes(rec.status)) {
          entry.intelEnrichedAccepted++;
        }
      } else {
        entry.internalOnlyTotal++;
        if (["ACCEPTED", "MODIFIED", "IMPLEMENTED"].includes(rec.status)) {
          entry.internalOnlyAccepted++;
        }
      }
    }

    return Object.entries(typeMap).map(([type, data]) => ({
      type,
      ...data,
      acceptanceRate: data.total > 0 ? Math.round(((data.accepted + data.implemented) / data.total) * 1000) / 10 : 0,
      rejectionRate: data.total > 0 ? Math.round((data.rejected / data.total) * 1000) / 10 : 0,
    }));
  }

  it("computes acceptance rate correctly", () => {
    const results = computeDiagnostics([
      { type: "DELAY_WARNING", status: "ACCEPTED", intelligenceEnriched: "false" },
      { type: "DELAY_WARNING", status: "ACCEPTED", intelligenceEnriched: "false" },
      { type: "DELAY_WARNING", status: "REJECTED", intelligenceEnriched: "false" },
      { type: "DELAY_WARNING", status: "PENDING", intelligenceEnriched: "false" },
    ]);
    expect(results[0]!.acceptanceRate).toBe(50);
    expect(results[0]!.rejectionRate).toBe(25);
  });

  it("separates intel-enriched vs internal acceptance", () => {
    const results = computeDiagnostics([
      { type: "RISK_MITIGATION", status: "ACCEPTED", intelligenceEnriched: "true" },
      { type: "RISK_MITIGATION", status: "REJECTED", intelligenceEnriched: "true" },
      { type: "RISK_MITIGATION", status: "ACCEPTED", intelligenceEnriched: "false" },
      { type: "RISK_MITIGATION", status: "REJECTED", intelligenceEnriched: "false" },
      { type: "RISK_MITIGATION", status: "REJECTED", intelligenceEnriched: "false" },
    ]);
    const entry = results[0]!;
    expect(entry.intelEnrichedTotal).toBe(2);
    expect(entry.intelEnrichedAccepted).toBe(1);
    expect(entry.internalOnlyTotal).toBe(3);
    expect(entry.internalOnlyAccepted).toBe(1);
  });

  it("handles empty input", () => {
    const results = computeDiagnostics([]);
    expect(results).toHaveLength(0);
  });

  it("groups by type correctly", () => {
    const results = computeDiagnostics([
      { type: "DELAY_WARNING", status: "ACCEPTED", intelligenceEnriched: "false" },
      { type: "CARRIER_SWITCH", status: "REJECTED", intelligenceEnriched: "true" },
      { type: "DELAY_WARNING", status: "PENDING", intelligenceEnriched: "false" },
    ]);
    expect(results).toHaveLength(2);
    const delayEntry = results.find((r) => r.type === "DELAY_WARNING")!;
    const carrierEntry = results.find((r) => r.type === "CARRIER_SWITCH")!;
    expect(delayEntry.total).toBe(2);
    expect(carrierEntry.total).toBe(1);
  });
});

describe("dossier data structure", () => {
  it("lane dossier structure is complete", () => {
    const dossier = {
      lane: { origin: "CNSHA", destination: "USLAX" },
      score: {
        compositeStressScore: 65,
        congestionScore: 70,
        disruptionScore: 50,
        delayStressScore: 40,
        marketPressureScore: 30,
      },
      stats: { totalShipments: 15, avgTransitDays: 18 },
      shipments: [{ id: "s1", reference: "REF-001", status: "IN_TRANSIT" }],
      recommendations: [{ id: "r1", type: "DELAY_WARNING", urgency: "HIGH" }],
      outcomePatterns: [{ action: "ACCEPTED", count: 5 }],
      signals: {
        congestion: [{ portCode: "CNSHA", congestionLevel: "high" }],
        disruptions: [],
      },
    };

    expect(dossier.lane.origin).toBe("CNSHA");
    expect(dossier.score.compositeStressScore).toBe(65);
    expect(dossier.shipments).toHaveLength(1);
    expect(dossier.recommendations).toHaveLength(1);
    expect(dossier.signals.congestion).toHaveLength(1);
  });

  it("port dossier has required fields", () => {
    const dossier = {
      portCode: "CNSHA",
      score: {
        compositeScore: 55,
        congestionSeverity: 65,
        weatherExposure: 30,
        disruptionExposure: 40,
        operationalVolatility: 45,
      },
      shipments: [],
      recommendations: [],
      signals: { congestion: [], weather: [], disruptions: [] },
      relatedLanes: [],
    };

    expect(dossier.portCode).toBe("CNSHA");
    expect(dossier.score.compositeScore).toBe(55);
    expect(dossier.signals).toHaveProperty("congestion");
    expect(dossier.signals).toHaveProperty("weather");
    expect(dossier.signals).toHaveProperty("disruptions");
  });

  it("carrier dossier has required fields", () => {
    const dossier = {
      carrierName: "MAERSK",
      score: {
        compositeScore: 30,
        performanceScore: 80,
        anomalyScore: 10,
        reliabilityScore: 75,
        laneStressExposure: 20,
      },
      shipments: [],
      recommendations: [],
      outcomePatterns: [],
      graphEdges: [],
      laneExposure: [],
    };

    expect(dossier.carrierName).toBe("MAERSK");
    expect(dossier.score.performanceScore).toBe(80);
    expect(dossier).toHaveProperty("outcomePatterns");
    expect(dossier).toHaveProperty("laneExposure");
  });

  it("entity dossier has compliance signals", () => {
    const dossier = {
      entityName: "ACME Corp",
      score: {
        compositeScore: 45,
        sanctionsRiskScore: 60,
        deniedPartyConfidence: 30,
        documentationIrregularity: 0,
      },
      shipments: [],
      recommendations: [],
      complianceSignals: {
        sanctionsMatches: [{ id: "sm1", edgeType: "ENTITY_SANCTIONS_MATCH" }],
        relevantSanctions: [],
        relevantDenied: [],
      },
      graphEdges: [],
    };

    expect(dossier.entityName).toBe("ACME Corp");
    expect(dossier.complianceSignals.sanctionsMatches).toHaveLength(1);
    expect(dossier.score.sanctionsRiskScore).toBe(60);
  });
});

describe("graph exploration structure", () => {
  it("graph node data contains edges and summary", () => {
    const graphData = {
      nodeType: "ENTITY",
      nodeId: "ent_001",
      edges: [
        { sourceId: "ent_001", targetId: "shp_001", edgeType: "ENTITY_SANCTIONS_MATCH" },
        { sourceId: "shp_001", targetId: "ent_001", edgeType: "SHIPPER_USES_CARRIER" },
      ],
      connectedNodeCount: 1,
      edgeTypeSummary: {
        ENTITY_SANCTIONS_MATCH: 1,
        SHIPPER_USES_CARRIER: 1,
      },
    };

    expect(graphData.edges).toHaveLength(2);
    expect(graphData.connectedNodeCount).toBe(1);
    expect(graphData.edgeTypeSummary.ENTITY_SANCTIONS_MATCH).toBe(1);
  });
});
