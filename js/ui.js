// 화면(UI) 담당. DOM 은 createElement 로 조립합니다.

// 작은 DOM 헬퍼: el('div.card', {onclick:fn}, [자식...])
function el(spec, props, children) {
  var parts = spec.split('.');
  var tag = parts[0] || 'div';
  var node = document.createElement(tag);
  for (var i = 1; i < parts.length; i++) node.classList.add(parts[i]);
  if (props) {
    for (var k in props) {
      if (k === 'text') node.textContent = props[k];
      else if (k === 'html') node.innerHTML = props[k];
      else if (k.indexOf('on') === 0 && typeof props[k] === 'function') node.addEventListener(k.slice(2), props[k]);
      else if (k === 'style') { for (var s in props[k]) node.style[s] = props[k][s]; }
      else node.setAttribute(k, props[k]);
    }
  }
  if (children) {
    for (var c = 0; c < children.length; c++) {
      if (children[c]) node.appendChild(children[c]);
    }
  }
  return node;
}
function $(id) { return document.getElementById(id); }
function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

var UI = {
  g: null,
  selChamp: 'jinx',
  selDiff: 'story',
  selStage: 'warehouse',

  init: function (game) {
    this.g = game;
    this.selChamp = game.meta.lastChamp || 'jinx';
    this.selDiff = game.meta.lastDiff || 'story';
    this.selStage = game.meta.lastStage || 'warehouse';
    this.bindStatic();
    this.buildSelect();
    this.show('title');
  },

  // 화면 전환: 해당 화면만 보이게 합니다.
  show: function (name) {
    var ids = ['screen-title', 'screen-select', 'screen-meta', 'screen-help', 'screen-result',
      'screen-missions', 'overlay-levelup', 'overlay-shop', 'overlay-pause'];
    for (var i = 0; i < ids.length; i++) {
      var n = $(ids[i]);
      if (n) n.hidden = ('screen-' + name !== ids[i] && 'overlay-' + name !== ids[i]);
    }
    $('hud').hidden = !(name === 'none' || name === 'levelup' || name === 'shop' || name === 'pause');
    this.current = name;
  },

  bindStatic: function () {
    var self = this, g = this.g;

    $('btn-play').addEventListener('click', function () { self.show('select'); self.buildSelect(); });
    $('btn-meta').addEventListener('click', function () { self.buildMeta(); self.show('meta'); });
    $('btn-missions').addEventListener('click', function () { self.buildMissions(); self.show('missions'); });
    $('btn-missions-back').addEventListener('click', function () { self.show('title'); });
    $('btn-help').addEventListener('click', function () { self.show('help'); });
    $('btn-help-back').addEventListener('click', function () { self.show('title'); });
    $('btn-meta-back').addEventListener('click', function () { self.show('title'); });
    // 원작처럼 업그레이드 화면에서 바로 출격할 수 있게 합니다.
    $('btn-meta-play').addEventListener('click', function () { self.show('select'); self.buildSelect(); });
    $('btn-select-back').addEventListener('click', function () { self.show('title'); });

    $('btn-start').addEventListener('click', function () { self.launch(); });
    $('btn-again').addEventListener('click', function () { self.launch(); });

    $('btn-resume').addEventListener('click', function () { self.closePause(); });
    $('btn-quit').addEventListener('click', function () {
      g.state = 'menu'; g.p = null; self.show('title');
    });
    $('btn-home').addEventListener('click', function () {
      g.state = 'menu'; g.p = null; self.show('title');
    });
    $('btn-shop-close').addEventListener('click', function () { self.closeShop(); });
    $('btn-shop-reroll').addEventListener('click', function () { self.shopReroll(); });
    $('btn-lv-reroll').addEventListener('click', function () { self.levelReroll(); });
  },

  launch: function () {
    var g = this.g;
    g.meta.lastChamp = this.selChamp;
    g.meta.lastDiff = this.selDiff;
    g.meta.lastStage = this.selStage;
    saveMeta(g.meta);
    g.startRun(this.selChamp, this.selDiff, this.selStage);
    this.show('none');
  },

  // ── 미션 ──────────────────────────────────────────────────────
  buildMissions: function () {
    var t = this.g.meta.totals;
    var wrap = $('mission-list');
    clear(wrap);
    for (var i = 0; i < MISSIONS.length; i++) {
      var m = MISSIONS[i];
      var done = !!this.g.meta.missions[m.id];
      wrap.appendChild(el('div.mission-row' + (done ? '.done' : ''), null, [
        el('div.mission-check', { text: done ? '✓' : '·' }),
        el('div.mission-info', null, [
          el('div.mission-name', { text: m.name }),
          el('div.mission-desc', { text: m.desc })
        ]),
        el('div.mission-right', null, [
          el('div.mission-reward', { text: m.reward }),
          el('div.mission-progress', { text: done ? '달성' : m.progress(t) })
        ])
      ]));
    }
  },

  // ── 출격 준비 (스테이지 · 챔피언 · 난이도) ────────────────────
  buildSelect: function () {
    this.buildStageSelect();
    this.buildChampSelect();
    this.buildDiffSelect();
  },

  buildStageSelect: function () {
    var self = this, g = this.g;
    var wrap = $('stage-list');
    clear(wrap);

    if (!stageUnlocked(g.meta, this.selStage)) this.selStage = 'warehouse';

    for (var i = 0; i < STAGES.length; i++) {
      (function (s) {
        var open = stageUnlocked(g.meta, s.id);
        var cleared = !!g.meta.stages[s.id];
        if (!open) {
          var prev = STAGE_BY_ID[s.unlock];
          wrap.appendChild(el('div.stage-card.locked', null, [
            el('div.stage-name', { text: '🔒 ' + s.name }),
            el('div.stage-desc', { text: (prev ? prev.name : '') + ' 클리어 후 열립니다' })
          ]));
          return;
        }
        var card = el('button.stage-card' + (self.selStage === s.id ? '.on' : ''), {
          type: 'button',
          onclick: function () { self.selStage = s.id; self.buildStageSelect(); }
        }, [
          el('div.stage-name', { text: s.name + (cleared ? ' ✓' : '') }),
          el('div.stage-desc', { text: s.blurb }),
          el('div.stage-boss', { text: '최종 보스 · ' + BOSSES[s.boss].name })
        ]);
        card.style.borderColor = self.selStage === s.id ? s.accent : '';
        wrap.appendChild(card);
      })(STAGES[i]);
    }
  },

  buildChampSelect: function () {
    var self = this;
    var wrap = $('champ-list');
    clear(wrap);

    // 잠긴 캐릭터가 선택돼 있으면 쓸 수 있는 첫 캐릭터로 되돌립니다.
    if (!missionDone(this.g.meta, CHAMPION_BY_ID[this.selChamp].unlock)) {
      for (var k = 0; k < CHAMPIONS.length; k++) {
        if (missionDone(this.g.meta, CHAMPIONS[k].unlock)) { this.selChamp = CHAMPIONS[k].id; break; }
      }
    }

    for (var i = 0; i < CHAMPIONS.length; i++) {
      (function (c) {
        var locked = !missionDone(self.g.meta, c.unlock);
        if (locked) {
          var m = MISSION_BY_ID[c.unlock];
          wrap.appendChild(el('div.champ-card.locked', null, [
            el('div.champ-badge.lock', null, [el('span', { text: '🔒' })]),
            el('div.champ-body', null, [
              el('div.champ-name', { text: c.name + ' — 잠김' }),
              el('div.champ-title', { text: m ? '미션: ' + m.desc : '' }),
              el('div.champ-skill', null, [
                el('b', { text: '진행도 ' }),
                el('span', { text: m ? m.progress(self.g.meta.totals) : '' })
              ])
            ])
          ]));
          return;
        }
        var wd = WEAPONS[c.weapon];
        var card = el('button.champ-card' + (self.selChamp === c.id ? '.on' : ''), {
          type: 'button',
          onclick: function () { self.selChamp = c.id; self.buildChampSelect(); }
        }, [
          el('div.champ-badge', { style: { background: c.color } }, [
            el('span', { text: c.name.charAt(0) })
          ]),
          el('div.champ-body', null, [
            el('div.champ-name', { text: c.name }),
            el('div.champ-title', { text: c.title }),
            el('div.champ-blurb', { text: c.blurb }),
            el('div.champ-stats', null, [
              el('span', { text: '체력 ' + c.hp }),
              el('span', { text: '방어력 ' + c.armor }),
              el('span', { text: '이동 ' + c.speed }),
              el('span.champ-role', { text: c.role })
            ]),
            el('div.champ-skill', null, [
              el('b.k-p', { text: '패시브 · ' + c.passive.name }),
              el('span', { text: ' ' + c.passive.desc })
            ]),
            el('div.champ-skill', null, [
              el('b.k-q', { text: '전용 무기 · ' + wd.name }),
              el('span', { text: ' ' + wd.desc }),
              el('i.evo-need', { text: ' → 진화: ' + PERKS[wd.evoPerk].name })
            ]),
            el('div.champ-skill', null, [
              el('b.k-e', { text: 'E · ' + c.e.name }),
              el('span', { text: ' ' + c.e.desc + ' (재사용 ' + c.e.cd + '초' + (c.e.charges ? ' · ' + c.e.charges + '충전' : '') + ')' })
            ]),
            el('div.champ-skill', null, [
              el('b.k-r', { text: 'R · ' + c.r.name }),
              el('span', { text: ' ' + c.r.desc + ' (재사용 ' + c.r.cd + '초)' })
            ])
          ])
        ]);
        card.style.borderColor = self.selChamp === c.id ? c.color : '';
        wrap.appendChild(card);
      })(CHAMPIONS[i]);
    }
  },

  buildDiffSelect: function () {
    var self = this;
    var dwrap = $('diff-list');
    clear(dwrap);
    for (var d = 0; d < DIFFICULTIES.length; d++) {
      (function (df) {
        dwrap.appendChild(el('button.diff-card' + (self.selDiff === df.id ? '.on' : ''), {
          type: 'button',
          onclick: function () { self.selDiff = df.id; self.buildDiffSelect(); }
        }, [
          el('div.diff-name', { text: df.name }),
          el('div.diff-desc', { text: df.desc }),
          el('div.diff-reward', { text: '보상 ×' + df.reward })
        ]));
      })(DIFFICULTIES[d]);
    }
  },

  // ── 업그레이드 구매 (원작 화면 배치) ──────────────────────────
  // 왼쪽 격자에서 카드를 고르면 오른쪽에 상세가 뜨고, 거기서 구매합니다.
  selUp: 'dmg',

  buildMeta: function () {
    var self = this, g = this.g, m = g.meta, t = m.totals;
    $('meta-crystals').textContent = U.fmtNum(m.crystals);
    $('meta-record').textContent =
      '최고 생존 ' + U.fmtTime(t.bestTime) + ' · 최다 처치 ' + U.fmtNum(t.bestKills) +
      ' · ' + t.runs + '판 / ' + t.wins + '승 · 누적 ' + U.fmtNum(t.kills) + '처치 · 접근 카드 ' + U.fmtNum(t.cards) + '장';

    var wrap = $('meta-list');
    clear(wrap);
    for (var i = 0; i < META_UPGRADES.length; i++) {
      (function (u) {
        var lv = m.up[u.id] || 0;
        var open = metaUnlocked(u, t);
        var maxed = lv >= u.max;

        var pips = el('div.pips');
        for (var k = 0; k < u.max; k++) pips.appendChild(el('i' + (k < lv ? '.on' : '')));

        var cls = '.up-card' + (open ? '' : '.locked') + (self.selUp === u.id ? '.on' : '');
        wrap.appendChild(el('div' + cls, {
          onclick: function () { if (open) { self.selUp = u.id; self.buildMeta(); } }
        }, [
          el('div.up-ico', { text: open ? u.icon : '🔒' }),
          el('div.up-name', { text: u.name }),
          pips,
          el('div.up-cost' + (maxed ? '.maxed' : ''), null, [
            el('span', { text: maxed ? '최대' : '💎' }),
            el('b', { text: maxed ? '' : String(u.cost[lv]) })
          ])
        ]));
      })(META_UPGRADES[i]);
    }
    this.renderUpDetail();
  },

  renderUpDetail: function () {
    var self = this, g = this.g, m = g.meta, t = m.totals;
    var u = null;
    for (var i = 0; i < META_UPGRADES.length; i++) if (META_UPGRADES[i].id === this.selUp) u = META_UPGRADES[i];
    var box = $('up-detail');
    clear(box);
    if (!u) return;

    var lv = m.up[u.id] || 0;
    var open = metaUnlocked(u, t);
    var maxed = lv >= u.max;
    var cost = maxed ? 0 : u.cost[lv];
    var can = open && !maxed && m.crystals >= cost;

    box.appendChild(el('div.d-ico', { text: open ? u.icon : '🔒' }));
    box.appendChild(el('div.d-name', { text: u.name }));
    box.appendChild(el('div.d-sub', { text: u.desc }));

    if (!open) {
      box.appendChild(el('div.d-lock', { text: '잠김 — ' + u.need }));
      return;
    }
    // 현재 적용 중인 값 (원작처럼 초록 배지로)
    box.appendChild(el('div.d-value', null, [
      el('span', { text: u.icon }),
      el('span', { text: u.value(lv) })
    ]));
    box.appendChild(el('div.d-sub', {
      text: maxed ? u.capText + ' — 더 올릴 수 없습니다'
        : '한 단계당 ' + u.step + ' · ' + u.capText + ' (' + lv + ' / ' + u.max + ')'
    }));
    box.appendChild(el('button.buy' + (can ? '' : '.off'), {
      type: 'button',
      text: maxed ? '최대' : '💎 ' + cost + ' 구매',
      onclick: function () {
        if (!can) return;
        m.crystals -= cost;
        m.up[u.id] = lv + 1;
        saveMeta(m);
        self.buildMeta();
      }
    }));
  },

  // ── HUD ───────────────────────────────────────────────────────
  updateHud: function () {
    var g = this.g, p = g.p;
    if (!p) return;
    $('hp-fill').style.width = U.clamp(p.hp / p.maxHp, 0, 1) * 100 + '%';
    $('shield-fill').style.width = U.clamp(p.shield / p.maxHp, 0, 1) * 100 + '%';
    $('hp-text').textContent = Math.ceil(p.hp) + ' / ' + Math.round(p.maxHp) + (p.shield > 0 ? ' (+' + Math.round(p.shield) + ')' : '');
    $('xp-fill').style.width = U.clamp(p.xp / p.xpNeed, 0, 1) * 100 + '%';
    $('lv-text').textContent = 'Lv.' + p.level;
    $('timer').textContent = U.fmtTime(g.t);

    // 초상화 — 챔피언이 바뀔 때만 갱신합니다.
    if (this._portraitOf !== p.champ.id) {
      this._portraitOf = p.champ.id;
      $('p-initial').textContent = p.champ.name.charAt(0);
      $('p-portrait').style.background = p.champ.color;
      $('p-portrait').style.borderColor = p.champ.accent;
    }
    $('p-level').textContent = p.level;
    $('gold-text').textContent = U.fmtNum(p.gold);
    $('kill-text').textContent = U.fmtNum(g.stats.kills);
    $('card-text').textContent = p.cards;
    $('card-stat').classList.toggle('ready', p.cards > 0 && g.evolvableWeapons().length > 0);

    // 무기 슬롯 5칸 — 맨 앞은 챔피언 전용 무기입니다.
    var ws = $('weapon-slots');
    if (ws.childElementCount !== p.weapons.length) {
      clear(ws);
      for (var i = 0; i < p.weapons.length; i++) {
        var def = WEAPONS[p.weapons[i].id];
        ws.appendChild(el('div.wslot' + (i === 0 ? '.champ' : ''), { title: def.name }, [
          el('span.wicon', { text: def.icon, style: { color: def.color } }),
          el('span.wlv')
        ]));
      }
    }
    for (var j = 0; j < p.weapons.length; j++) {
      var node = ws.children[j];
      if (!node) continue;
      var w = p.weapons[j];
      node.lastChild.textContent = w.evolved ? '진화' : w.lvl;
      node.classList.toggle('maxed', w.evolved);
      // 진화 조건을 다 채웠는데 아직 안 썼으면 반짝이게 둡니다.
      node.classList.toggle('ready', !w.evolved && g.canEvolve(w.id) && p.cards > 0);
      node.classList.toggle('near', !w.evolved && w.lvl >= 5 && !g.canEvolve(w.id));
    }

    // 기본 지속 효과 슬롯 (최대 6)
    var as = $('aug-slots');
    var keys = Object.keys(p.perks);
    if (as.childElementCount !== keys.length) {
      clear(as);
      for (var k = 0; k < keys.length; k++) {
        var pk = PERKS[keys[k]];
        as.appendChild(el('div.aslot', {
          title: pk.name, style: { borderColor: pk.color }
        }, [el('span', { text: pk.icon }), el('b')]));
      }
    }
    for (var n = 0; n < keys.length; n++) {
      if (as.children[n]) as.children[n].lastChild.textContent = p.perks[keys[n]];
    }

    // 조준 모드
    $('aim-mode').textContent = g.autoAim ? '자동 조준 (C)' : '수동 조준 (C)';
    $('aim-mode').classList.toggle('manual', !g.autoAim);

    // E / R 재사용 대기시간
    var e = p.champ.e, r = p.champ.r;
    $('skill-name').textContent = e.name;
    if (e.charges) {
      var full = p.eCharges >= e.charges;
      $('skill-cd').style.height = (full ? 0 : U.clamp(p.eChargeT / (e.cd * p.st.cdrMul), 0, 1) * 100) + '%';
      $('skill-num').textContent = p.eCharges > 0 ? '×' + p.eCharges : Math.ceil(p.eChargeT);
      $('skill-btn').classList.toggle('cooling', p.eCharges <= 0);
    } else {
      $('skill-cd').style.height = (U.clamp(p.eT / (e.cd * p.st.cdrMul), 0, 1) * 100) + '%';
      $('skill-num').textContent = p.eT > 0 ? Math.ceil(p.eT) : '';
      $('skill-btn').classList.toggle('cooling', p.eT > 0);
    }
    $('ult-name').textContent = r.name;
    $('ult-cd').style.height = (U.clamp(p.rT / (r.cd * p.st.cdrMul), 0, 1) * 100) + '%';
    $('ult-num').textContent = p.rT > 0 ? Math.ceil(p.rT) : '';
    $('ult-btn').classList.toggle('cooling', p.rT > 0);

    // 보스 체력바
    var bb = $('boss-bar');
    if (g.boss) {
      bb.hidden = false;
      $('boss-name').textContent = g.boss.def.name;
      $('boss-fill').style.width = U.clamp(g.boss.hp / g.boss.maxHp, 0, 1) * 100 + '%';
    } else bb.hidden = true;
  },

  // ── 레벨업 / 진화 ─────────────────────────────────────────────
  //
  // 접근 카드로 열린 진화 선택이 있으면 그쪽을 먼저 처리합니다.
  openLevelUp: function () {
    var g = this.g;
    this.evoMode = g.evoQueue > 0 && g.evolvableWeapons().length > 0;
    if (this.evoMode) g.choices = g.rollEvolutions();
    else {
      g.evoQueue = 0;                 // 조건이 사라졌으면 대기열을 비웁니다
      g.choices = g.rollChoices(3);
    }
    this.renderChoices();
    this.show('levelup');
  },

  renderChoices: function () {
    var self = this, g = this.g;
    var overlay = $('overlay-levelup');
    overlay.classList.toggle('evo', this.evoMode);

    if (this.evoMode) {
      $('lv-title').textContent = '접근 카드 사용';
      $('lv-sub').textContent = '진화시킬 무기를 고르세요 · 보유 카드 ' + g.p.cards + '장';
    } else {
      $('lv-title').textContent = '레벨 ' + g.p.level + ' 달성';
      $('lv-sub').textContent = g.levelQueue > 1
        ? '남은 선택 ' + g.levelQueue + '회'
        : '무기나 기본 지속 효과를 하나 고르세요';
    }

    var cost = 40;
    $('btn-lv-reroll').hidden = this.evoMode;
    $('btn-lv-reroll').textContent = '다시 뽑기 (💰 ' + cost + ')';
    $('btn-lv-reroll').classList.toggle('off', g.p.gold < cost);

    var wrap = $('lv-cards');
    clear(wrap);
    for (var i = 0; i < g.choices.length; i++) {
      (function (c) {
        wrap.appendChild(self.choiceCard(c, null, function () {
          g.applyChoice(c);
          if (self.evoMode) g.evoQueue--;
          else g.levelQueue--;
          // 진화 대기열이 남아 있으면 진화를, 아니면 남은 레벨업을 이어서 처리합니다.
          if (g.evoQueue > 0 || g.levelQueue > 0) self.openLevelUp();
          else { g.state = 'playing'; self.show('none'); }
        }));
      })(g.choices[i]);
    }
  },

  levelReroll: function () {
    var g = this.g;
    if (this.evoMode || g.p.gold < 40) return;
    g.p.gold -= 40;
    g.choices = g.rollChoices(3);
    this.renderChoices();
  },

  // 선택지·상점 공용 카드
  choiceCard: function (c, price, onPick) {
    var affordable = price === null || price === undefined || this.g.p.gold >= price;
    var cls = '.choice' + (c.kind ? '.k-' + c.kind : '') + (affordable ? '' : '.off');
    var card = el('button' + cls, {
      type: 'button',
      onclick: function () { if (affordable) onPick(); }
    }, [
      el('div.choice-tag', { text: c.tag, style: { background: c.color } }),
      el('div.choice-icon', { text: c.icon, style: { color: c.color } }),
      el('div.choice-name', { text: c.title }),
      el('div.choice-sub', { text: c.sub }),
      el('div.choice-desc', { text: c.desc }),
      c.note ? el('div.choice-note', { text: c.note }) : null,
      (price !== null && price !== undefined) ? el('div.choice-price', { text: '💰 ' + price }) : null
    ]);
    card.style.borderColor = c.color;
    return card;
  },

  // ── 상점 ──────────────────────────────────────────────────────
  openShop: function () {
    this.renderShop();
    this.show('shop');
  },

  renderShop: function () {
    var self = this, g = this.g, p = g.p;
    $('shop-gold').textContent = U.fmtNum(p.gold);
    $('btn-shop-reroll').textContent = '상품 교체 (💰 ' + g.shopRerollCost + ')';
    $('btn-shop-reroll').classList.toggle('off', p.gold < g.shopRerollCost);

    var wrap = $('shop-cards');
    clear(wrap);
    for (var i = 0; i < g.shopStock.length; i++) {
      (function (c) {
        if (c.sold) {
          wrap.appendChild(el('div.choice.sold', null, [el('div.sold-label', { text: '판매 완료' })]));
          return;
        }
        wrap.appendChild(self.choiceCard(c, c.price, function () {
          p.gold -= c.price;
          g.applyChoice(c);
          c.sold = true;
          self.renderShop();
        }));
      })(g.shopStock[i]);
    }

    // 고정 서비스
    var services = $('shop-services');
    clear(services);
    var healCost = 100 + g.shopCount * 40;
    var hpCost = 180 + g.shopCount * 60;
    var cardCost = 500 + g.shopCount * 250;
    services.appendChild(this.serviceBtn('응급 치료', '체력을 최대치의 40% 회복합니다', healCost, function () {
      p.gold -= healCost; g.healPlayer(p.maxHp * 0.4); self.renderShop();
    }, p.gold >= healCost && p.hp < p.maxHp));
    services.appendChild(this.serviceBtn('체력 증강', '최대 체력 +150 (즉시 회복)', hpCost, function () {
      p.gold -= hpCost; p.maxHp += 150; g.healPlayer(150); self.renderShop();
    }, p.gold >= hpCost));
    // 접근 카드를 돈으로 살 수 있게 두면, 정예를 놓쳐도 진화 길이 막히지 않습니다.
    services.appendChild(this.serviceBtn('접근 카드', '무기 진화에 쓰는 카드 1장', cardCost, function () {
      p.gold -= cardCost;
      p.cards++;
      g.stats.cards++;
      self.renderShop();
    }, p.gold >= cardCost));
  },

  serviceBtn: function (name, desc, price, onPick, enabled) {
    return el('button.service' + (enabled ? '' : '.off'), {
      type: 'button',
      onclick: function () { if (enabled) onPick(); }
    }, [
      el('div.service-name', { text: name }),
      el('div.service-desc', { text: desc }),
      el('div.service-price', { text: '💰 ' + price })
    ]);
  },

  shopReroll: function () {
    var g = this.g;
    if (g.p.gold < g.shopRerollCost) return;
    g.p.gold -= g.shopRerollCost;
    g.shopRerollCost = Math.round(g.shopRerollCost * 1.6);
    g.shopStock = g.rollChoices(4, true);
    this.renderShop();
  },

  closeShop: function () {
    this.g.closeShop();
    this.show('none');
    // 상점에서 카드를 샀다면 나가면서 진화 선택이 열릴 수 있습니다.
    this.g.offerEvolution();
  },

  // ── 일시정지 ──────────────────────────────────────────────────
  openPause: function () {
    if (this.g.state !== 'playing') return;
    this.g.state = 'paused';
    this.show('pause');
  },
  closePause: function () {
    if (this.g.state !== 'paused') return;
    this.g.state = 'playing';
    this.show('none');
  },

  // ── 결과 ──────────────────────────────────────────────────────
  openResult: function () {
    var g = this.g;
    $('result-title').textContent = g.win ? '작전 성공!' : '전멸';
    $('result-title').className = g.win ? 'win' : 'lose';
    $('result-sub').textContent = g.win
      ? g.stage.name + ' — ' + BOSSES[g.stage.boss].name + '을(를) 격퇴했습니다.'
      : (g.champ.name + ', ' + g.stage.name + '에서 쓰러졌습니다.');

    var rows = [
      ['스테이지', g.stage.name + ' · ' + g.diff.name],
      ['생존 시간', U.fmtTime(g.t)],
      ['처치 수', U.fmtNum(g.stats.kills)],
      ['도달 레벨', 'Lv.' + g.p.level],
      ['정예 처치', g.stats.elites + '체'],
      ['접근 카드', g.stats.cards + '장 획득 · ' + g.p.cards + '장 남음'],
      ['무기 진화', g.stats.evolutions + '회'],
      ['누적 피해량', U.fmtNum(g.stats.dmg)],
      ['획득 골드', U.fmtNum(g.stats.goldEarned)]
    ];
    var wrap = $('result-stats');
    clear(wrap);
    for (var i = 0; i < rows.length; i++) {
      wrap.appendChild(el('div.rrow', null, [
        el('span.rk', { text: rows[i][0] }),
        el('span.rv', { text: rows[i][1] })
      ]));
    }
    $('result-crystals').textContent = '💎 +' + g.lastCrystals;

    // 이번 판에 쌓은 빌드 요약
    var build = $('result-build');
    clear(build);
    for (var w = 0; w < g.p.weapons.length; w++) {
      var wp = g.p.weapons[w], def = WEAPONS[wp.id];
      build.appendChild(el('span.bchip', {
        text: def.icon + ' ' + (wp.evolved ? def.evo : def.name + ' ' + wp.lvl + '단계'),
        style: { borderColor: def.color, color: def.color }
      }));
    }
    for (var k in g.p.perks) {
      var pk = PERKS[k];
      build.appendChild(el('span.bchip', {
        text: pk.icon + ' ' + pk.name + ' Lv' + g.p.perks[k],
        style: { borderColor: pk.color, color: pk.color }
      }));
    }

    // 이번 판에 새로 달성한 미션 · 새로 열린 스테이지
    var mw = $('result-missions');
    clear(mw);
    var nm = g.newMissions || [];
    var rows2 = nm.length + (g.stageCleared ? 1 : 0);
    mw.hidden = rows2 === 0;
    if (g.stageCleared) {
      var nx = null;
      for (var s = 0; s < STAGES.length; s++) if (STAGES[s].unlock === g.stage.id) nx = STAGES[s];
      mw.appendChild(el('div.unlock-row', null, [
        el('span.unlock-icon', { text: '🗺️' }),
        el('span', { text: g.stage.name + ' 클리어' + (nx ? ' — ' + nx.name + ' 해금!' : '') })
      ]));
      g.stageCleared = false;
    }
    for (var i2 = 0; i2 < nm.length; i2++) {
      mw.appendChild(el('div.unlock-row', null, [
        el('span.unlock-icon', { text: '🏅' }),
        el('span', { text: nm[i2].name + ' 달성 — ' + nm[i2].reward })
      ]));
    }
    this.show('result');
  }
};
