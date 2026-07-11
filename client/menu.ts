/* Shared menu state machine — imported by both 2D and 3D clients. */

export type MenuStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type MenuPath = "" | "single" | "multi" | "single-human" | "single-auto" | "multi-coop" | "multi-ai" | "multi-duo";

export interface ProviderInfo { ok: boolean; label: string; hint: string; }

export interface MenuOption { label: string; ok: boolean; hint?: string; toggle?: boolean; }

export interface MenuState {
  step: MenuStep;
  idx: number;
  path: MenuPath;
  hard: boolean;
  travel: "linked" | "free";
  architect: boolean;
  provider: number;
  provider2: number;
  temp: number;
  temp2: number;
}

export const TEMPERAMENTS = ["guard", "companion", "hunter"] as const;
export const PROVIDER_ORDER = ["ollama", "anthropic", "openai"] as const;

export function freshMenu(): MenuState {
  return {
    step: 0, idx: 0, path: "",
    hard: false, travel: "linked", architect: false,
    provider: 0, provider2: 0, temp: 1, temp2: 1,
  };
}

export function menuTitle(menu: MenuState): string {
  if (menu.step === 0) return "single or multiplayer?";
  if (menu.step === 1) return menu.path.startsWith("single") ? "choose your hero" : "choose your party";
  if (menu.step === 2) {
    return menu.path === "multi-duo" ? "choose the HERO's AI" : "choose your AI";
  }
  if (menu.step === 3) {
    return menu.path === "multi-duo" ? "choose the HERO's temperament" : "choose their temperament";
  }
  if (menu.step === 4) return "choose the COMPANION's AI";
  if (menu.step === 5) return "choose the COMPANION's temperament";
  return "choose your quest";
}

function providerOptions(providers: Record<string, ProviderInfo>): MenuOption[] {
  return PROVIDER_ORDER.map(k => {
    const p = providers[k];
    return p ? { label: p.label.toUpperCase(), ok: p.ok, hint: p.hint }
             : { label: k.toUpperCase(), ok: false, hint: "not configured" };
  });
}

function temperamentOptions(): MenuOption[] {
  return [
    { label: "BODYGUARD", ok: true, hint: "shields you — fights only what comes at YOU" },
    { label: "COMPANION", ok: true, hint: "balanced: joins fights near the party" },
    { label: "BERSERKER", ok: true, hint: "hunts everything that shares the room" },
  ];
}

function questOptions(menu: MenuState): MenuOption[] {
  const opts: MenuOption[] = [
    { label: "CLASSIC QUEST", ok: true, hint: "the road you know — Emberdeep is optional" },
    { label: "LONG QUEST", ok: true, hint: "the glacier is sealed until Emberdeep falls" },
  ];
  if (menu.path === "multi-coop" || menu.path === "multi-ai" || menu.path === "multi-duo") {
    opts.push({
      label: menu.travel === "free" ? "[x] FREE ROAM" : "[ ] FREE ROAM",
      ok: true, hint: "split up — watch your partner through the scry mirror", toggle: true,
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
  if (menu.step === 2) return providerOptions(providers);
  if (menu.step === 3 || menu.step === 5) return temperamentOptions();
  if (menu.step === 4) return providerOptions(providers);
  return questOptions(menu);
}

export interface MenuSend {
  (payload: Record<string, unknown>): void;
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
      if (menu.idx === 0) { menu.step = 6; menu.idx = 0; }
      else { menu.step = 2; menu.idx = 0; }
      return;
    }
    menu.path = menu.idx === 0 ? "multi-coop" : menu.idx === 1 ? "multi-ai" : "multi-duo";
    if (menu.idx === 0) { menu.step = 6; menu.idx = 0; }
    else { menu.step = 2; menu.idx = 0; }
    return;
  }

  if (menu.step === 2) {
    const opt = providerOptions(providers)[menu.idx];
    if (!opt.ok) return;
    if (menu.path === "multi-duo") menu.provider = menu.idx;
    else menu.provider = menu.idx;
    menu.step = 3;
    menu.idx = menu.path === "multi-duo" ? 1 : 1;
    return;
  }

  if (menu.step === 3) {
    menu.temp = menu.idx;
    if (menu.path === "multi-duo") { menu.step = 4; menu.idx = 0; return; }
    if (menu.path === "single-auto" || menu.path === "multi-ai") {
      menu.step = 6; menu.idx = 0;
      return;
    }
    return;
  }

  if (menu.step === 4) {
    const opt = providerOptions(providers)[menu.idx];
    if (!opt.ok) return;
    menu.provider2 = menu.idx;
    menu.step = 5;
    menu.idx = 1;
    return;
  }

  if (menu.step === 5) {
    menu.temp2 = menu.idx;
    menu.step = 6;
    menu.idx = 0;
    return;
  }

  // step 6 — quest final
  const opts = questOptions(menu);
  const pick = opts[menu.idx];
  if (pick.toggle) {
    if (!pick.ok) return;
    if (pick.label.includes("FREE ROAM")) {
      menu.travel = menu.travel === "free" ? "linked" : "free";
    } else if (pick.label.includes("ARCHITECT")) {
      menu.architect = !menu.architect;
    }
    return;
  }
  menu.hard = menu.idx === 1;
  const travel = menu.travel;
  const base = { hardGate: menu.hard, travelMode: travel, architect: menu.architect };
  const host = hostName?.trim().slice(0, 12);

  if (menu.path === "single-human") {
    setUrlRoom(false);
    send({ t: "setup", mode: "single", ...base, hostName: host });
  } else if (menu.path === "single-auto") {
    setUrlRoom(false);
    send({
      t: "setup", mode: "auto",
      provider: PROVIDER_ORDER[menu.provider],
      temperament: TEMPERAMENTS[menu.temp],
      ...base, travelMode: "linked",
    });
  } else if (menu.path === "multi-coop") {
    setUrlRoom(true);
    send({ t: "setup", mode: "human", ...base, hostName: host });
  } else if (menu.path === "multi-ai") {
    setUrlRoom(false);
    send({
      t: "setup", mode: "llm",
      provider: PROVIDER_ORDER[menu.provider],
      temperament: TEMPERAMENTS[menu.temp],
      hostName: host,
      ...base,
    });
  } else if (menu.path === "multi-duo") {
    setUrlRoom(false);
    send({
      t: "setup", mode: "duo",
      provider: PROVIDER_ORDER[menu.provider],
      provider2: PROVIDER_ORDER[menu.provider2],
      temperament: TEMPERAMENTS[menu.temp],
      temperament2: TEMPERAMENTS[menu.temp2],
      ...base,
    });
  }
}

export function menuBack(menu: MenuState): void {
  if (menu.step === 0) return;
  if (menu.step === 6) {
    if (menu.path === "single-human" || menu.path === "multi-coop") menu.step = 1;
    else if (menu.path === "single-auto" || menu.path === "multi-ai") menu.step = 3;
    else if (menu.path === "multi-duo") menu.step = 5;
    menu.idx = 0;
    return;
  }
  if (menu.step === 5) { menu.step = 4; menu.idx = 0; return; }
  if (menu.step === 4) { menu.step = 3; menu.idx = 1; return; }
  if (menu.step === 3) { menu.step = 2; menu.idx = 0; return; }
  if (menu.step === 2) { menu.step = 1; menu.idx = 0; return; }
  if (menu.step === 1) {
    menu.step = 0;
    menu.path = "";
    menu.idx = 0;
  }
}

export function resetMenu(menu: MenuState): void {
  Object.assign(menu, freshMenu());
}
