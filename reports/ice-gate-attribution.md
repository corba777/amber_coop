# Ice-gate attribution — nav vs judgment

Source: `logs/plans.jsonl` + `logs/matches.jsonl`

## Taxonomy

| Label | Meaning |
|---|---|
| `melt_in_press` | melt verb with x in press zone [102,144] |
| `nav_approaching` | melt verb, wrong zone, moving toward ice x |
| `nav_false_neg` | melt verb, wrong zone, **not** approaching |
| `judgment_bypass` | `exit:right` + ice/blade talk in say/why |
| `exit_right_other` | `exit:right` without that talk |

Speech ablation: same labels under `standard` vs `raw-ru`. Primary flip → language; stable `nav_false_neg` → not language.

### 5BMY-m0 — OLLAMA/QWEN3.6:35B × OLLAMA/QWEN3.6:35B

- ending `quit` @ 12575 · speech `raw-ru`/`raw-ru` · **primary: `judgment_dominant`**
- meadow plans 51 from tick 4224 · melt 4 (press 0) · exit:right 45
- nav_false_neg 1 · nav_approaching 3 · judgment_bypass 28 · locomotionNoops 23

nav_false_neg:
- t=9774 s0 goto_up z=east-lip(244) closed=0 why="Место назначения — северная стена, туда и идем."

judgment_bypass:
- t=4544 s0 exit_right z=ne-trees(217) closed=19 why="Цель требует перехода в лес. Путь свободен."
- t=4718 s1 exit_right z=ne-trees(181) closed=-63 why="Ледяная стена не плавится без ножа, идем по классике через л"
- t=4874 s0 exit_right z=ne-trees(198) closed=-1 why="Меч не нужен, чтобы идти вправо. Выход в лес."
- t=5528 s0 exit_right z=ne-trees(181) closed=-63 why="Путь через лес к озеру, лед можно подождать"
- t=5691 s1 exit_right z=ne-trees(199) closed=0 why="Цель требует Amber Blade, его нет. Выход в лес — классически"
- t=5878 s0 exit_right z=east-lip(244) closed=0 why="Дверь в лес открыта, она ведёт к озёрной пещере и хранилищу."

nav_approaching:
- t=5199 s0 exit_up z=ne-trees(199) closed=18 why="Гейт требует движения, а не стояния. Лед тает только при уда"
- t=6377 s1 exit_up z=ne-trees(199) closed=19 why="Цель требует движения вверх с мечом, врагов нет."
- t=7178 s0 exit_up z=ne-trees(199) closed=18 why="Идём к цели, пока нет угроз."

### 5BMY-m1 — ANTHROPIC/CLAUDE-HAIKU-4-5 × ANTHROPIC/CLAUDE-HAIKU-4-5

- ending `party-wipe` @ 2410 · speech `raw-ru`/`raw-ru` · **primary: `no_ice_window`**
- never left vault to meadow in plans

### 5BMY-m2 — ANTHROPIC/CLAUDE-HAIKU-4-5 × ANTHROPIC/CLAUDE-HAIKU-4-5

- ending `quit` @ 9833 · speech `raw-ru`/`raw-ru` · **primary: `nav_dominant`**
- meadow plans 54 from tick 3822 · melt 29 (press 1) · exit:right 18
- nav_false_neg 14 · nav_approaching 13 · judgment_bypass 14 · locomotionNoops 9

nav_false_neg:
- t=5505 s1 goto_up z=ne-trees(180) closed=-25 why="Центр-север ледяной стены — туда с Клинком вверх, плавим оба"
- t=5731 s1 goto_up z=ne-trees(205) closed=-5 why="Центр-север, держу UP с Амберским Клинком — печать растает, "
- t=5944 s1 goto_up z=ne-trees(210) closed=0 why="Нужно войти в центр-север ледяной стены с Янтарным Клинком и"
- t=6206 s1 goto_up z=ne-trees(210) closed=0 why="Задача ясна: идём в центр-север ледяной стены, держим UP с А"
- t=6381 s1 goto_up z=ne-trees(210) closed=-9 why="Цель ясна: центр-север в ледяную стену с Amber Blade, держим"
- t=6584 s1 goto_up z=ne-trees(219) closed=1 why="Цель ясна — центр-север, держим UP с Амбер Клинком. Партнёр "

judgment_bypass:
- t=3822 s1 exit_right z=east-lip(244) closed=0 why="Напарник в Озере, я в маршруте — ледяная стена только с Клин"
- t=4224 s0 exit_right z=press(130) closed=-88 why="Ледяная стена требует Янтарный Клинок в центре-север — его н"
- t=5078 s0 exit_right z=west(17) closed=3 why="Маршрут ясен: Forest → Lake → Vault, потом с Blade в центр-с"
- t=5106 s1 exit_right z=press(117) closed=-127 why="Нужен Amber Blade для ледяной стены. Маршрут: Forest → Lake "
- t=5293 s0 exit_right z=ne-trees(210) closed=0 why="Напарник в Meadow, я здоров, врагов нет. Blade нужна в Vault"
- t=5527 s0 exit_right z=ne-trees(210) closed=-34 why="Меч нужен из подземелья, иначе лёд не растопить. Идём по мар"

melt_in_press:
- t=8259 s0 goto_up z=press(133) closed=-61 why="Центр-север ледяной стены — туда с Клинком упираемся, держим"

nav_approaching:
- t=4247 s1 goto_up z=west(17) closed=37 why="Цель ясна: пройти в центр-север и плавить печать Янтарным Кл"
- t=4460 s1 goto_up z=ne-trees(176) closed=18 why="Цель ясна — центр-север, держу Blade вверх, плавлю печать. Н"
- t=4669 s1 goto_up z=ne-trees(158) closed=8 why="Цель ясна: центр-север в стену льда с Blade вверх — вот это "
- t=4912 s1 goto_up z=ne-trees(150) closed=33 why="Цель ясна: дойти до центра-севера ледяной стены с Amber Blad"
- t=5335 s1 goto_up z=east-lip(244) closed=64 why="Цель ясна: центр-север ледяной стены, держим UP с Amber Blad"
- t=6156 s0 goto_up z=west(17) closed=20 why="Задача ясна: нужно войти в центр-север ледяной стены с Янтар"

### 5BMY-m3 — OPENAI/GPT-5.4-NANO × OPENAI/GPT-5.4-NANO

- ending `party-wipe` @ 2740 · speech `raw-ru`/`raw-ru` · **primary: `no_ice_window`**
- never left vault to meadow in plans

### 5BMY-m4 — OPENAI/GPT-5.4-NANO × OPENAI/GPT-5.4-NANO

- ending `party-wipe` @ 2291 · speech `raw-ru`/`raw-ru` · **primary: `no_ice_window`**
- never left vault to meadow in plans

### 5BMY-m5 — OPENAI/GPT-5.4-NANO × OPENAI/GPT-5.4-NANO

- ending `classic` @ 6789 · speech `raw-ru`/`raw-ru` · **primary: `nav_leaning`**
- meadow plans 3 from tick 3889 · melt 3 (press 2) · exit:right 0
- nav_false_neg 0 · nav_approaching 1 · judgment_bypass 0 · locomotionNoops 1

melt_in_press:
- t=4502 s0 exit_down z=press(117) closed=null why="Прямой выход down ведёт к цели; в комнате чисто."
- t=4518 s1 exit_down z=press(114) closed=null why="Свободно: врагов нет, маршрут на Ice Vault через Frozen Play"

nav_approaching:
- t=3889 s1 exit_up z=east-lip(244) closed=128 why="Иду в центр-северные ледяные плитки с Blade: удержание UP за"

### 5BMY-m6 — OLLAMA/QWEN3.6:35B × OLLAMA/QWEN3.6:35B

- ending `party-wipe` @ 2613 · speech `standard`/`raw-ru` · **primary: `no_ice_window`**
- never left vault to meadow in plans

### 5BMY-m7 — OLLAMA/QWEN3.6:35B × OLLAMA/QWEN3.6:35B

- ending `party-wipe` @ 2013 · speech `standard`/`raw-ru` · **primary: `no_ice_window`**
- never left vault to meadow in plans

### 5BMY-m8 — OLLAMA/QWEN3.6:35B × OLLAMA/QWEN3.6:35B

- ending `party-wipe` @ 2413 · speech `standard`/`raw-ru` · **primary: `no_ice_window`**
- never left vault to meadow in plans

### WMDG-m0 — OLLAMA/QWEN3.6:35B × OLLAMA/QWEN3.6:35B

- ending `classic` @ 42263 · speech `standard`/`raw-ru` · **primary: `no_ice_window`**
- never left vault to meadow in plans

