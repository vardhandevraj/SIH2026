import { env } from "../config/env";
import { logger } from "../utils/logger";
import type { EvidenceItem, FundFlowPath, VaspCandidate } from "../types";

export interface AiExplainInput {
  wallet: string;
  network: string;
  candidate: VaspCandidate | null;
  confidence: number;
  evidence: EvidenceItem[];
  fundFlow: FundFlowPath[];
  graphDepth: number;
}

export interface ExplainResult {
  text: string;
  source: "groq" | "template";
}

const DISCLAIMER_LINE =
  "Attribution is probabilistic and intended to support investigation. It should not be treated as definitive proof of ownership or control.";

export async function explainAttribution(input: AiExplainInput): Promise<ExplainResult> {
  if (env.groqKey) {
    try {
      const text = await callGroq(input);
      return { text: `${text}\n\n${DISCLAIMER_LINE}`, source: "groq" };
    } catch (err) {
      logger.warn("Groq unavailable, using template explanation", { error: err instanceof Error ? err.message : String(err) });
      return { text: templateExplanation(input), source: "template" };
    }
  }
  return { text: templateExplanation(input), source: "template" };
}

async function callGroq(input: AiExplainInput): Promise<string> {
  const payload = {
    wallet: input.wallet,
    network: input.network,
    candidate: input.candidate
      ? {
          name: input.candidate.name,
          confidence: input.candidate.score,
          factors: input.candidate.factors,
          minHops: input.candidate.minHops,
          directInteractionCount: input.candidate.directInteractionCount,
        }
      : null,
    evidence: input.evidence.map((e) => ({ title: e.title, description: e.description, strength: e.strength, relatedTransactions: e.relatedTransactions.length })),
    fundFlowPaths: input.fundFlow.map((p) => ({ hopCount: p.hopCount, totalAmount: p.totalAmount, token: p.token })),
    graphDepth: input.graphDepth,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.groqKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: env.groqModel,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "You are a blockchain intelligence analyst assistant. You must ONLY use the structured evidence supplied in the user message. Never invent transactions, addresses, percentages, or entities. Never claim certainty. Refer to attribution as probabilistic ('likely', 'probabilistic attribution'). Keep the explanation under 220 words and structured with short paragraphs.",
          },
          {
            role: "user",
            content: `Explain why the wallet ${input.wallet} on ${input.network} was probabilistically attributed to the candidate VASP. Use ONLY this computed evidence:\n${JSON.stringify(payload, null, 2)}`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("Empty Groq response");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export function templateExplanation(input: AiExplainInput): string {
  const lines: string[] = [];
  const { candidate, confidence } = input;

  if (!candidate) {
    lines.push(
      `No single VASP could be identified with sufficient confidence for ${short(input.wallet)} based on the available on-chain activity. ` +
        `The wallet interacts with the wider market but the deterministic scoring engine could not establish a dominant attribution signal.`
    );
    lines.push(
      "This result is probabilistic. It should not be treated as definitive proof of ownership or control. Additional data sources (more history, off-chain registries) are recommended before drawing conclusions."
    );
    return lines.join("\n\n");
  }

  lines.push(
    `The wallet ${short(input.wallet)} received a probabilistic attribution of "${candidate.name}" with an attribution confidence of approximately ${confidence}/100 based solely on deterministic analysis of on-chain data.`
  );

  const factorNames: [keyof typeof candidate.factors, string][] = [
    ["knownAddressInteraction", "direct interactions with known VASP-associated addresses"],
    ["graphProximity", "short graph distance to the candidate's known cluster"],
    ["fundFlow", "fund-flow chains moving value toward the candidate"],
    ["clusterSimilarity", "overlapping counterparties with the candidate's cluster"],
    ["behaviorSimilarity", "similarity in transaction behaviour"],
  ];
  const active = factorNames
    .filter(([k]) => candidate.factors[k] > 0)
    .sort((a, b) => candidate.factors[b[0]] - candidate.factors[a[0]])
    .slice(0, 3)
    .map(([, label]) => label);

  if (active.length > 0) {
    lines.push(
      `The attribution rests primarily on: ${active.join("; ")}. These signals were computed with the configurable factor weights and are reported as directional, not conclusive.`
    );
  }

  if (input.fundFlow.length > 0) {
    lines.push(
      `Detected ${input.fundFlow.length} fund-flow path(s) connecting the wallet to the candidate cluster across up to ${input.fundFlow[0].hopCount} hop(s). Path flows are indicative of deposit/withdrawal-style interaction, not proof of control.`
    );
  }

  if (input.confidence < 50) {
    lines.push(
      "Confidence is moderate. The evidence supports further investigation but is not strong enough to regard the attribution as a primary lead."
    );
  } else {
    lines.push(
      "The evidence is sufficiently consistent to treat the attribution as a substantive lead, but it remains a probabilistic classification subject to false-positive risk."
    );
  }

  lines.push(DISCLAIMER_LINE);
  return lines.join("\n\n");
}

function short(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}