"use client";

import { useEffect, useRef, useState } from "react";
import {
  BrainCircuit,
  Check,
  Copy,
  Download,
  FileCheck,
  FileText,
  RefreshCw,
  Scale,
  Send,
  Target,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { copyTextToClipboard } from "@/lib/utils";
import { AuthService, type AuthUser } from "@/services/auth-service";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: { id: string; title: string; href: string }[];
  provider?: "gemini" | "openai";
  model?: string;
  fallbackUsed?: boolean;
}

interface CapabilityCard {
  id: string;
  title: string;
  category: string;
  description: string;
  prompt: string;
  icon: typeof Target;
}

const CAPABILITY_CARDS: CapabilityCard[] = [
  {
    id: "cap-1",
    title: "Opportunity Evaluation",
    category: "Market Intelligence",
    description: "Analyze highest-value active public tenders with margin viability analysis.",
    prompt:
      "Provide an executive evaluation of the top public procurement opportunities closing this month in my jurisdiction, detailing estimated value, procuring entity, and key competitive factors.",
    icon: Target,
  },
  {
    id: "cap-2",
    title: "HOD Proposal Checklist",
    category: "Internal Governance",
    description: "Verify mandatory statutory, financial, and technical schedules required by your HOD.",
    prompt:
      "List the mandatory technical, financial, and statutory schedules required by the Head of Department (HOD) prior to signing off on a public tender submission.",
    icon: FileCheck,
  },
  {
    id: "cap-3",
    title: "Executive Justification Memo",
    category: "Proposal Support",
    description: "Formulate defensible justification notes for pricing and OEM warranties.",
    prompt:
      "Draft a formal memorandum to the Head of Department providing justification for a turnkey substation switchgear tender, emphasizing OEM technical compliance and gross margin defense.",
    icon: FileText,
  },
  {
    id: "cap-4",
    title: "Statutory Tax & Bid Bond Audit",
    category: "Compliance Integrity",
    description: "Audit tax clearance validity and standard bank security guarantee wording.",
    prompt:
      "Detail the compliance requirements for active tax clearance certification and outline standard commercial bank tender security bond wording.",
    icon: Scale,
  },
];

// High-fidelity Markdown text renderer for bold, code, lists, and headers
function renderFormattedContent(content: string) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  let inList = false;
  let listItems: React.ReactNode[] = [];

  const flushList = () => {
    if (inList && listItems.length > 0) {
      elements.push(
        <div key={`list-${elements.length}`} className="space-y-1.5 my-2 pl-1">
          {listItems}
        </div>,
      );
      listItems = [];
      inList = false;
    }
  };

  const formatInlineText = (text: string): React.ReactNode => {
    // Parse **bold** and `code`
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith("**") && token.endsWith("**")) {
        parts.push(
          <strong key={`b-${match.index}`} className="font-semibold text-foreground">
            {token.slice(2, -2)}
          </strong>,
        );
      } else if (token.startsWith("`") && token.endsWith("`")) {
        parts.push(
          <code
            key={`c-${match.index}`}
            className="px-1.5 py-0.5 rounded bg-muted/80 font-mono text-[11px] text-primary border border-border/50"
          >
            {token.slice(1, -1)}
          </code>,
        );
      }
      lastIndex = match.index + token.length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Headers
    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <h3
          key={`h3-${index}`}
          className="font-semibold text-xs sm:text-sm text-foreground pt-3 pb-1 border-b border-border/40 mb-2 first:pt-0"
        >
          {formatInlineText(trimmed.replace(/^###\s+/, ""))}
        </h3>,
      );
      return;
    }

    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h2
          key={`h2-${index}`}
          className="font-bold text-sm sm:text-base text-foreground pt-3 pb-1 border-b border-border/40 mb-2 first:pt-0"
        >
          {formatInlineText(trimmed.replace(/^##\s+/, ""))}
        </h2>,
      );
      return;
    }

    // Numbered list item: e.g. "1. " or "2. "
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      inList = true;
      listItems.push(
        <div key={`li-num-${index}`} className="flex items-start gap-2 text-xs leading-relaxed">
          <span className="font-mono text-[11px] font-bold text-primary shrink-0 w-4 pt-0.5">{numMatch[1]}.</span>
          <div className="flex-1 text-foreground/90">{formatInlineText(numMatch[2])}</div>
        </div>,
      );
      return;
    }

    // Bullet point: e.g. "• ", "- ", "* "
    const bulletMatch = trimmed.match(/^[-•*]\s+(.*)/);
    if (bulletMatch) {
      inList = true;
      listItems.push(
        <div key={`li-bullet-${index}`} className="flex items-start gap-2 text-xs leading-relaxed">
          <span className="size-1.5 rounded-full bg-primary/70 shrink-0 mt-2" />
          <div className="flex-1 text-foreground/90">{formatInlineText(bulletMatch[1])}</div>
        </div>,
      );
      return;
    }

    // Sub-bullet with indentation: e.g. "   - "
    const subBulletMatch = line.match(/^\s+[-•*]\s+(.*)/);
    if (subBulletMatch) {
      inList = true;
      listItems.push(
        <div key={`li-sub-${index}`} className="flex items-start gap-2 text-xs pl-5 leading-relaxed">
          <span className="size-1 rounded-full bg-muted-foreground shrink-0 mt-2" />
          <div className="flex-1 text-muted-foreground">{formatInlineText(subBulletMatch[1])}</div>
        </div>,
      );
      return;
    }

    // Empty line
    if (!trimmed) {
      flushList();
      elements.push(<div key={`sp-${index}`} className="h-1.5" />);
      return;
    }

    // Normal paragraph line
    flushList();
    elements.push(
      <p key={`p-${index}`} className="text-xs text-foreground/90 leading-relaxed">
        {formatInlineText(trimmed)}
      </p>,
    );
  });

  flushList();
  return elements;
}

export default function AtcisAiPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const lastAnswer = [...messages].reverse().find((message) => message.role === "assistant" && message.provider);

  useEffect(() => () => activeRequest.current?.abort(), []);

  useEffect(() => {
    const user = AuthService.getCurrentUser();
    setCurrentUser(user);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const userRole = currentUser?.role || "account_manager";
  const userCountry = currentUser?.country || "ALL";

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isThinking) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setInput("");
    setIsThinking(true);
    const controller = new AbortController();
    activeRequest.current = controller;

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: nextHistory.slice(-20).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success || !json.reply)
        throw new Error(json.error || "Atcis AI could not complete this lookup.");
      if (activeRequest.current === controller) {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now() + 1}`,
            role: "assistant",
            content: json.reply,
            sources: Array.isArray(json.sources) ? json.sources : [],
            provider: json.provider,
            model: json.model,
            fallbackUsed: json.fallbackUsed,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        toast.error(error instanceof Error ? error.message : "Failed to connect to Atcis AI.");
        setInput(query);
      }
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setIsThinking(false);
      }
    }
  };

  const handleCopy = async (id: string, text: string) => {
    const copied = await copyTextToClipboard(text);
    if (!copied) {
      toast.error("Copy failed. Select and copy the advisory notes manually.");
      return;
    }
    setCopiedId(id);
    toast.success("Advisory notes copied to clipboard.");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setIsThinking(false);
    setMessages([]);
    toast.info("Session reset.");
  };

  const handleExportChat = () => {
    if (messages.length === 0) {
      toast.error("No conversation to export.");
      return;
    }

    const transcript = `ATCIS AI PROCUREMENT INTELLIGENCE TRANSCRIPT
Generated: ${new Date().toISOString()}
User: ${currentUser?.name || "Authorized User"} (${userRole})
Jurisdiction: ${userCountry}
======================================================================

${messages
  .map((m) => `[${m.timestamp}] ${m.role === "assistant" ? "ATCIS AI ADVISOR" : "USER"}:\n${m.content}\n`)
  .join("\n----------------------------------------------------------------------\n\n")}
======================================================================
Confidential corporate advisory record.`;

    const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ATCIS_AI_Advisory_Transcript_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Transcript exported successfully.");
  };

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-6.5rem)]">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-3 border-b border-border/60 pb-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-md bg-foreground/5 text-foreground border border-border/80 shadow-2xs">
              <BrainCircuit className="size-3.5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-base tracking-tight text-foreground sm:text-lg">Atcis AI</h1>
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono border-border/80 text-muted-foreground bg-muted/40"
                >
                  {lastAnswer?.provider === "openai"
                    ? `OpenAI · ${lastAnswer.model}`
                    : lastAnswer?.provider === "gemini"
                      ? "Gemini 2.5 Flash"
                      : "Gemini + OpenAI"}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Answers from live records and supported uploaded documents available to your account
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[11px] font-mono font-medium px-2.5 py-0.5">
            {userCountry === "ZM"
              ? "Jurisdiction: ZPPA (Zambia)"
              : userCountry === "ZW"
                ? "Jurisdiction: PRAZ (Zimbabwe)"
                : "Jurisdiction: Regional Scope"}
          </Badge>

          {messages.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportChat}
                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Download className="size-3" />
                <span>Export</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleClearChat}
                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="size-3" />
                <span>New Thread</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Chat Terminal */}
      <div className="grid grid-cols-1 flex-1 min-h-0">
        <Card className="flex flex-col min-h-0 border-border/60 shadow-xs">
          {/* Chat Content Body */}
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {/* If NO messages yet: Show clean enterprise Welcome Hero */}
            {messages.length === 0 ? (
              <div className="h-full flex flex-col justify-center max-w-2xl mx-auto py-6 space-y-6">
                <div className="space-y-2 text-center">
                  <div className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-2xs mb-1">
                    <BrainCircuit className="size-5" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
                    How can Atcis AI assist your procurement today?
                  </h2>
                  <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
                    Connected directly to active tender records, statutory regulatory frameworks, and HOD approval
                    checklists.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {CAPABILITY_CARDS.map((card) => {
                    const Icon = card.icon;
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => handleSendMessage(card.prompt)}
                        className="flex flex-col text-left p-3.5 rounded-lg border border-border/70 bg-card hover:bg-muted/50 hover:border-primary/50 transition-all space-y-1.5 shadow-2xs group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                            {card.category}
                          </span>
                          <Icon className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <h4 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                          {card.title}
                        </h4>
                        <p className="text-[11px] text-muted-foreground leading-snug">{card.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Active Chat Conversation Feed with formatted rendering */
              messages.map((m) => {
                const isAssistant = m.role === "assistant";
                return (
                  <div key={m.id} className={`flex gap-3 ${isAssistant ? "justify-start" : "justify-end"}`}>
                    {isAssistant && (
                      <div className="flex size-7 items-center justify-center rounded-md bg-muted border border-border/60 text-foreground shrink-0 mt-0.5 shadow-2xs font-mono font-bold text-[10px]">
                        AI
                      </div>
                    )}

                    <div className={`max-w-[90%] space-y-1.5 ${isAssistant ? "items-start" : "items-end"}`}>
                      <div
                        className={`rounded-lg p-4 text-xs leading-relaxed shadow-2xs ${
                          isAssistant
                            ? "bg-card border border-border/70 text-foreground"
                            : "bg-primary text-primary-foreground font-medium"
                        }`}
                      >
                        {isAssistant ? (
                          <div className="space-y-1">
                            {renderFormattedContent(m.content)}
                            {Boolean(m.sources?.length) && (
                              <details>
                                <summary>Sources consulted ({m.sources?.length})</summary>
                                <ul className="flex flex-col gap-1 pt-2">
                                  {m.sources?.map((source) => (
                                    <li key={source.id}>
                                      <a
                                        href={source.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline"
                                      >
                                        [{source.id}] {source.title}
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs whitespace-pre-wrap">{m.content}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1 font-mono">
                        <span>
                          {m.timestamp}
                          {m.provider
                            ? ` · ${m.provider === "openai" ? "OpenAI" : "Gemini"}${m.fallbackUsed ? " (fallback)" : ""}`
                            : ""}
                        </span>
                        {isAssistant && (
                          <button
                            type="button"
                            onClick={() => handleCopy(m.id, m.content)}
                            className="flex items-center gap-1 hover:text-foreground transition-colors ml-3"
                          >
                            {copiedId === m.id ? (
                              <>
                                <Check className="size-3 text-emerald-600" />
                                <span className="text-emerald-600 font-medium">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="size-3" />
                                <span>Copy Notes</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {!isAssistant && (
                      <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground shrink-0 mt-0.5 font-mono font-semibold text-xs shadow-2xs">
                        AM
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {isThinking && (
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground p-3 rounded-md bg-muted/20 border border-border/40 animate-pulse max-w-sm font-mono">
                <RefreshCw className="size-3.5 animate-spin text-foreground" />
                <span>Processing procurement intelligence query...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </CardContent>

          {/* Input Bar */}
          <div className="p-3 border-t border-border/60 bg-card rounded-b-xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Inquire on procurement schedules, statutory requirements, or draft submission notes..."
                className="h-10 text-xs shadow-2xs"
                disabled={isThinking}
              />
              <Button
                type="submit"
                disabled={isThinking || !input.trim()}
                className="h-10 px-4 bg-primary text-primary-foreground font-semibold gap-1.5 shadow-xs shrink-0"
              >
                <span>Submit</span>
                <Send className="size-3.5" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
