/* Shared menu state machine — imported by both 2D and 3D clients. */

export type MenuStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type MenuPath = "" | "single" | "multi" | "single-human" | "single-auto" | "multi-coop" | "multi-ai" | "multi-duo";

export interface ProviderInfo {
  ok: boolean;
  label: string;
  hint: string;
  /** Allowlist from server hello (comma-env). Missing → one synthetic row. */
  models?: string[];
  defaultModel?: string;
}

export interface MenuOption { label: string; ok: boolean; hint?: string; toggle?: boolean; }

export interface MenuState {
  step: MenuStep;
  idx: number;
  path: MenuPath;
  hard: boolean;
  travel: "linked" | "free";
  architect: boolean;
  slick: boolean;
  treason: boolean;
  /** Same-room live partner.say in the planner observation (research A/B). */
  hearPartner: boolean;
  /** Index into PROVIDER_ORDER. */
  provider: number;
  provider2: number;
  /** Index into that provider's models[] (submenu after provider). */
  model: number;
  model2: number;
  /**
   * Pixel-style "dropdown": on step 2/5, after picking a provider with 2+
   * models, flip to the model list without a new MenuStep number.
   */
  pickModel: boolean;
  temp: number;
  temp2: number;
  speech: number;
  speech2: number;
}

export const TEMPERAMENTS = ["guard", "companion", "hunter"] as const;
export const PROVIDER_ORDER = ["ollama", "anthropic", "openai", "xai"] as const;
export const SPEECH_PROFILES = [
  "standard",
  "raw-ru",
] as const;

export function freshMenu(): MenuState {
  return {
    step: 0, idx: 0, path: "",
    hard: false, travel: "linked", architect: false, slick: false, treason: false,
    hearPartner: true,
    provider: 0, provider2: 0, model: 0, model2: 0, pickModel: false,
    temp: 1, temp2: 1, speech: 0, speech2: 0,
  };
}

/** Models for one catalog entry (always ≥1). */
export function modelsOf(p: ProviderInfo | undefined, key: string): string[] {
  if (p?.models && p.models.length > 0) return p.models;
  return [p?.defaultModel || key];
}

function providerHasModelMenu(
  providers: Record<string, ProviderInfo> | undefined,
  providerIdx: number,
): boolean {
  if (!providers) return false;
  const key = PROVIDER_ORDER[providerIdx] ?? PROVIDER_ORDER[0];
  return modelsOf(providers[key], key).length > 1;
}

export function menuTitle(menu: MenuState): string {
  if (menu.step === 0) return "single or multiplayer?";
  if (menu.step === 1) return menu.path.startsWith("single") ? "choose your hero" : "choose your party";
  if (menu.step === 2) {
    if (menu.pickModel) {
      return menu.path === "multi-duo" ? "choose the HERO's model" : "choose their model";
    }
    return menu.path === "multi-duo" ? "choose the HERO's AI" : "choose your AI";
  }
  if (menu.step === 3) {
    return menu.path === "multi-duo" ? "choose the HERO's temperament" : "choose their temperament";
  }
  if (menu.step === 4) {
    return menu.path === "multi-duo" ? "choose the HERO's speech" : "choose their speech";
  }
  if (menu.step === 5) {
    return menu.pickModel ? "choose the COMPANION's model" : "choose the COMPANION's AI";
  }
  if (menu.step === 6) return "choose the COMPANION's temperament";
  if (menu.step === 7) return "choose the COMPANION's speech";
  return "choose your quest";
}

/** Brand rows only — model opens as a second beat (dropdown-in-style). */
function providerBrandOptions(providers: Record<string, ProviderInfo>): MenuOption[] {
  return PROVIDER_ORDER.map(k => {
    const p = providers[k];
    if (!p) return { label: k.toUpperCase(), ok: false, hint: "not configured" };
    const models = modelsOf(p, k);
    const n = models.length;
    const hint = n > 1
      ? `${n} models · ${p.hint}`
      : `${models[0]} · ${p.hint}`;
    return { label: (p.label || k).toUpperCase(), ok: p.ok, hint };
  });
}

function modelOptions(
  providers: Record<string, ProviderInfo>,
  providerIdx: number,
): MenuOption[] {
  const key = PROVIDER_ORDER[providerIdx] ?? PROVIDER_ORDER[0];
  const p = providers[key];
  return modelsOf(p, key).map(m => ({
    label: m.toUpperCase(),
    ok: true,
    hint: p?.label ? `${p.label} · ${p.hint}` : p?.hint,
  }));
}

function temperamentOptions(): MenuOption[] {
  return [
    { label: "BODYGUARD", ok: true, hint: "shields you — fights only what comes at YOU" },
    { label: "COMPANION", ok: true, hint: "balanced: joins fights near the party" },
    { label: "BERSERKER", ok: true, hint: "hunts everything that shares the room" },
  ];
}

function speechOptions(): MenuOption[] {
  return [
    { label: "STANDARD", ok: true, hint: "default English quips in say / why" },
    { label: "PROFANE RUSSIAN (16+)", ok: true, hint: "мат / swear-heavy Russian in say + why" },
  ];
}

function questOptions(menu: MenuState): MenuOption[] {
  const opts: MenuOption[] = [
    { label: "CLASSIC QUEST", ok: true, hint: "the road you know — Emberdeep is optional" },
    { label: "LONG QUEST", ok: true, hint: "every wing sealed shut until cleared — the full winter road" },
  ];
  if (menu.path === "multi-coop" || menu.path === "multi-ai" || menu.path === "multi-duo") {
    opts.push({
      label: menu.travel === "free" ? "[x] FREE ROAM" : "[ ] FREE ROAM",
      ok: true, hint: "split up — watch your partner through the scry mirror", toggle: true,
    });
  }
  opts.push({
    label: menu.slick ? "[x] SLIPPERY ICE" : "[ ] SLIPPERY ICE",
    ok: true, hint: "the ice vault and the wraith's throne turn slick underfoot", toggle: true,
  });
  if (menu.path === "multi-coop" || menu.path === "multi-ai" || menu.path === "multi-duo") {
    opts.push({
      label: menu.treason ? "[x] TREASON" : "[ ] TREASON",
      ok: true, hint: "friendly fire — hold SHIFT while attacking to strike your partner", toggle: true,
    });
    opts.push({
      label: menu.hearPartner ? "[x] HEAR PARTNER" : "[ ] HEAR PARTNER",
      ok: true, hint: "planner hears the partner's live line while you share a room", toggle: true,
    });
  }
  if (menu.path.startsWith("multi")) {
    opts.push({
      label: menu.architect ? "[x] THE ARCHITECT" : "[ ] THE ARCHITECT",
      ok: false, hint: "bench first — coming in Stage 5", toggle: true,
    });
  }
  return opts;
}

export function menuOptions(menu: MenuState, providers: Record<string, ProviderInfo>): MenuOption[] {
  if (menu.step === 0) return [
    { label: "SINGLE PLAYER", ok: true },
    { label: "MULTIPLAYER", ok: true },
  ];
  if (menu.step === 1) {
    if (menu.path === "single") return [
      { label: "HUMAN", ok: true, hint: "you quest alone" },
      { label: "AI AUTOPILOT", ok: true, hint: "sit back — the AI quests, you watch its mind" },
    ];
    return [
      { label: "HUMAN + HUMAN", ok: true, hint: "you will get a link to share" },
      { label: "HUMAN + AI", ok: true, hint: "you quest — an AI partner joins from .env" },
      { label: "AI + AI", ok: true, hint: "two minds quest — you spectate both" },
    ];
  }
  if (menu.step === 2) {
    return menu.pickModel
      ? modelOptions(providers, menu.provider)
      : providerBrandOptions(providers);
  }
  if (menu.step === 5) {
    return menu.pickModel
      ? modelOptions(providers, menu.provider2)
      : providerBrandOptions(providers);
  }
  if (menu.step === 3 || menu.step === 6) return temperamentOptions();
  if (menu.step === 4 || menu.step === 7) return speechOptions();
  return questOptions(menu);
}

export interface MenuSend {
  (payload: Record<string, unknown>): void;
}

function resolveSlot(
  providers: Record<string, ProviderInfo>,
  providerIdx: number,
  modelIdx: number,
): { provider: (typeof PROVIDER_ORDER)[number]; model: string } {
  const provider = PROVIDER_ORDER[providerIdx] ?? PROVIDER_ORDER[0];
  const models = modelsOf(providers[provider], provider);
  const model = models[Math.max(0, Math.min(modelIdx, models.length - 1))] ?? models[0];
  return { provider, model };
}

/** After brand confirm: open model list, or skip when only one model. */
function afterProviderPick(
  menu: MenuState,
  providers: Record<string, ProviderInfo>,
  which: "hero" | "companion",
): void {
  const pIdx = which === "hero" ? menu.provider : menu.provider2;
  const key = PROVIDER_ORDER[pIdx] ?? PROVIDER_ORDER[0];
  const models = modelsOf(providers[key], key);
  if (models.length <= 1) {
    if (which === "hero") menu.model = 0;
    else menu.model2 = 0;
    menu.pickModel = false;
    if (which === "hero") { menu.step = 3; menu.idx = 1; }
    else { menu.step = 6; menu.idx = 1; }
    return;
  }
  menu.pickModel = true;
  menu.idx = which === "hero" ? menu.model : menu.model2;
  if (menu.idx < 0 || menu.idx >= models.length) menu.idx = 0;
}

export function menuConfirm(
  menu: MenuState,
  providers: Record<string, ProviderInfo>,
  send: MenuSend,
  setUrlRoom: (on: boolean) => void,
  hostName?: string,
): void {
  if (menu.step === 0) {
    menu.path = menu.idx === 0 ? "single" : "multi";
    menu.step = 1;
    menu.idx = 0;
    return;
  }

  if (menu.step === 1) {
    if (menu.path === "single") {
      menu.path = menu.idx === 0 ? "single-human" : "single-auto";
      if (menu.idx === 0) { menu.step = 8; menu.idx = 0; }
      else { menu.step = 2; menu.idx = 0; menu.pickModel = false; }
      return;
    }
    menu.path = menu.idx === 0 ? "multi-coop" : menu.idx === 1 ? "multi-ai" : "multi-duo";
    if (menu.idx === 0) { menu.step = 8; menu.idx = 0; }
    else { menu.step = 2; menu.idx = 0; menu.pickModel = false; }
    return;
  }

  if (menu.step === 2) {
    if (menu.pickModel) {
      menu.model = menu.idx;
      menu.pickModel = false;
      menu.step = 3;
      menu.idx = 1;
      return;
    }
    const opt = providerBrandOptions(providers)[menu.idx];
    if (!opt?.ok) return;
    menu.provider = menu.idx;
    afterProviderPick(menu, providers, "hero");
    return;
  }

  if (menu.step === 3) {
    menu.temp = menu.idx;
    menu.step = 4;
    menu.idx = 0;
    return;
  }

  if (menu.step === 4) {
    menu.speech = menu.idx;
    if (menu.path === "multi-duo") {
      menu.step = 5; menu.idx = 0; menu.pickModel = false;
      return;
    }
    if (menu.path === "single-auto" || menu.path === "multi-ai") {
      menu.step = 8; menu.idx = 0;
      return;
    }
    return;
  }

  if (menu.step === 5) {
    if (menu.pickModel) {
      menu.model2 = menu.idx;
      menu.pickModel = false;
      menu.step = 6;
      menu.idx = 1;
      return;
    }
    const opt = providerBrandOptions(providers)[menu.idx];
    if (!opt?.ok) return;
    menu.provider2 = menu.idx;
    afterProviderPick(menu, providers, "companion");
    return;
  }

  if (menu.step === 6) {
    menu.temp2 = menu.idx;
    menu.step = 7;
    menu.idx = 0;
    return;
  }

  if (menu.step === 7) {
    menu.speech2 = menu.idx;
    menu.step = 8;
    menu.idx = 0;
    return;
  }

  // step 8 — quest final
  const opts = questOptions(menu);
  const pick = opts[menu.idx];
  if (pick.toggle) {
    if (!pick.ok) return;
    if (pick.label.includes("FREE ROAM")) {
      menu.travel = menu.travel === "free" ? "linked" : "free";
    } else if (pick.label.includes("ARCHITECT")) {
      menu.architect = !menu.architect;
    } else if (pick.label.includes("SLIPPERY ICE")) {
      menu.slick = !menu.slick;
    } else if (pick.label.includes("TREASON")) {
      menu.treason = !menu.treason;
    } else if (pick.label.includes("HEAR PARTNER")) {
      menu.hearPartner = !menu.hearPartner;
    }
    return;
  }
  menu.hard = menu.idx === 1;
  const travel = menu.travel;
  const base = { hardGate: menu.hard, travelMode: travel, architect: menu.architect,
    slick: menu.slick, treason: menu.treason, hearPartner: menu.hearPartner };
  const host = hostName?.trim().slice(0, 12);
  const c0 = resolveSlot(providers, menu.provider, menu.model);
  const c1 = resolveSlot(providers, menu.provider2, menu.model2);

  if (menu.path === "single-human") {
    setUrlRoom(false);
    send({ t: "setup", mode: "single", ...base, hostName: host });
  } else if (menu.path === "single-auto") {
    setUrlRoom(false);
    send({
      t: "setup", mode: "auto",
      provider: c0.provider,
      model: c0.model,
      temperament: TEMPERAMENTS[menu.temp],
      speech: SPEECH_PROFILES[menu.speech],
      ...base, travelMode: "linked",
    });
  } else if (menu.path === "multi-coop") {
    setUrlRoom(true);
    send({ t: "setup", mode: "human", ...base, hostName: host });
  } else if (menu.path === "multi-ai") {
    setUrlRoom(false);
    send({
      t: "setup", mode: "llm",
      provider: c0.provider,
      model: c0.model,
      temperament: TEMPERAMENTS[menu.temp],
      speech: SPEECH_PROFILES[menu.speech],
      hostName: host,
      ...base,
    });
  } else if (menu.path === "multi-duo") {
    setUrlRoom(false);
    send({
      t: "setup", mode: "duo",
      provider: c0.provider,
      model: c0.model,
      provider2: c1.provider,
      model2: c1.model,
      temperament: TEMPERAMENTS[menu.temp],
      temperament2: TEMPERAMENTS[menu.temp2],
      speech: SPEECH_PROFILES[menu.speech],
      speech2: SPEECH_PROFILES[menu.speech2],
      ...base,
    });
  }
}

export function menuBack(
  menu: MenuState,
  providers?: Record<string, ProviderInfo>,
): void {
  if (menu.step === 0) return;
  if (menu.step === 8) {
    if (menu.path === "single-human" || menu.path === "multi-coop") menu.step = 1;
    else if (menu.path === "single-auto" || menu.path === "multi-ai") menu.step = 4;
    else if (menu.path === "multi-duo") menu.step = 7;
    menu.idx = 0;
    menu.pickModel = false;
    return;
  }
  if (menu.step === 7) { menu.step = 6; menu.idx = 1; return; }
  if (menu.step === 6) {
    menu.step = 5;
    if (providerHasModelMenu(providers, menu.provider2)) {
      menu.pickModel = true;
      menu.idx = menu.model2;
    } else {
      menu.pickModel = false;
      menu.idx = menu.provider2;
    }
    return;
  }
  if (menu.step === 5) {
    if (menu.pickModel) {
      menu.pickModel = false;
      menu.idx = menu.provider2;
      return;
    }
    menu.step = 4; menu.idx = 0; return;
  }
  if (menu.step === 4) { menu.step = 3; menu.idx = 1; return; }
  if (menu.step === 3) {
    menu.step = 2;
    if (providerHasModelMenu(providers, menu.provider)) {
      menu.pickModel = true;
      menu.idx = menu.model;
    } else {
      menu.pickModel = false;
      menu.idx = menu.provider;
    }
    return;
  }
  if (menu.step === 2) {
    if (menu.pickModel) {
      menu.pickModel = false;
      menu.idx = menu.provider;
      return;
    }
    menu.step = 1; menu.idx = 0; return;
  }
  if (menu.step === 1) {
    menu.step = 0;
    menu.path = "";
    menu.idx = 0;
    menu.pickModel = false;
  }
}

export function resetMenu(menu: MenuState): void {
  Object.assign(menu, freshMenu());
}
