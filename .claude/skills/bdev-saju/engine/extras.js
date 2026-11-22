/* ============================================================
   명식 보조 계산 (extras.js)
   원국 팔자(palja)만 받아서 신살·형충회합파해·납음·공망·지장간·세운·궁합 관계를 계산한다.
   해석은 하지 않는다. 해석은 references/interpretation.md 규칙으로 쓴다.

   신살 표 출처:
   - 천을·문창·태극·국인·금여·건록·양인·천덕·월덕·천의·홍란·천희·고신·과숙·괴강·
     음양차착·십악대패·공망: bazi-atlas/bazi-engine v0.15.1 (MIT, © 2026 Lei Zhifeng)의
     神煞 표(각 표 외부 출처 2곳 이상 대조)를 한국어 이름으로 옮김
   - 백호대살·홍염살·현침살·귀문관살·원진살·암록·학당귀인: 한국 명리 통용 표
     (암록·학당은 건록·장생에서 유도해 검산)
   학파마다 갈리는 부분은 note에 적는다.
   ============================================================ */
(function (global) {
  'use strict';

  const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const STEM_EL = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  const BRANCH_EL = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  const POS = ['year', 'month', 'day', 'hour'];
  const POS_KO = { year: '연', month: '월', day: '일', hour: '시' };
  const isYang = (s) => STEMS.indexOf(s) % 2 === 0;
  const bi = (b) => BRANCHES.indexOf(b);

  // ---------- 지장간 (한국 통용 월률분야: 여기·중기·정기) ----------
  const JIJANGGAN = {
    子: ['壬', null, '癸'], 丑: ['癸', '辛', '己'], 寅: ['戊', '丙', '甲'], 卯: ['甲', null, '乙'],
    辰: ['乙', '癸', '戊'], 巳: ['戊', '庚', '丙'], 午: ['丙', '己', '丁'], 未: ['丁', '乙', '己'],
    申: ['戊', '壬', '庚'], 酉: ['庚', null, '辛'], 戌: ['辛', '丁', '戊'], 亥: ['戊', '甲', '壬'],
  };
  const MAIN_STEM = Object.fromEntries(Object.entries(JIJANGGAN).map(([b, v]) => [b, v[2]]));

  // ---------- 납음 (60갑자, 두 기둥씩 같은 이름) ----------
  const NABEUM_PAIRS = ['해중금', '노중화', '대림목', '노방토', '검봉금', '산두화', '간하수', '성두토', '백랍금', '양류목',
    '천중수', '옥상토', '벽력화', '송백목', '장류수', '사중금', '산하화', '평지목', '벽상토', '금박금',
    '복등화', '천하수', '대역토', '차천금', '상자목', '대계수', '사중토', '천상화', '석류목', '대해수'];
  const JIAZI = Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BRANCHES[i % 12]);
  const nabeumOf = (gz) => { const i = JIAZI.indexOf(gz); return i < 0 ? null : NABEUM_PAIRS[i >> 1]; };

  // ---------- 십신·12운성 ----------
  function shipsinOf(dayStem, stem) {
    if (!stem) return null;
    const me = STEM_EL[dayStem], ot = STEM_EL[stem], same = isYang(dayStem) === isYang(stem);
    if (me === ot) return same ? '비견' : '겁재';
    if (SHENG[me] === ot) return same ? '식신' : '상관';
    if (KE[me] === ot) return same ? '편재' : '정재';
    if (KE[ot] === me) return same ? '편관' : '정관';
    if (SHENG[ot] === me) return same ? '편인' : '정인';
    return null;
  }
  const STAGES = ['장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양'];
  const STAGE_START = { 甲: '亥', 乙: '午', 丙: '寅', 丁: '酉', 戊: '寅', 己: '酉', 庚: '巳', 辛: '子', 壬: '申', 癸: '卯' };
  function unseongOf(stem, branch) {
    const d = (bi(branch) - bi(STAGE_START[stem]) + 12) % 12;
    return STAGES[isYang(stem) ? d : (12 - d) % 12];
  }

  // ---------- 12신살 ----------
  const SIBI = ['겁살', '재살', '천살', '지살', '연살', '월살', '망신살', '장성살', '반안살', '역마살', '육해살', '화개살'];
  const GEOPSAL_START = { 申: '巳', 子: '巳', 辰: '巳', 寅: '亥', 午: '亥', 戌: '亥', 巳: '寅', 酉: '寅', 丑: '寅', 亥: '申', 卯: '申', 未: '申' };
  const sibiOf = (base, b) => SIBI[(bi(b) - bi(GEOPSAL_START[base]) + 12) % 12];

  // ---------- 신살 표 ----------
  const T = {
    // 일간 기준 (index = 甲..癸)
    천을귀인: ['丑未', '子申', '亥酉', '亥酉', '丑未', '子申', '丑未', '寅午', '卯巳', '卯巳'],
    문창귀인: ['巳', '午', '申', '酉', '申', '酉', '亥', '子', '寅', '卯'],
    태극귀인: ['子午', '子午', '卯酉', '卯酉', '辰戌丑未', '辰戌丑未', '寅亥', '寅亥', '巳申', '巳申'],
    국인귀인: ['戌', '亥', '丑', '寅', '丑', '寅', '辰', '巳', '未', '申'],
    금여: ['辰', '巳', '未', '申', '未', '申', '戌', '亥', '丑', '寅'],
    건록: ['寅', '卯', '巳', '午', '巳', '午', '申', '酉', '亥', '子'],
    양인: ['卯', '', '午', '', '午', '', '酉', '', '子', ''],
    홍염살: ['午', '午', '寅', '未', '辰', '辰', '戌', '酉', '子', '申'],
  };
  const LIUHE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
  T.암록 = T.건록.map((b) => LIUHE[b]);                       // 건록과 육합하는 지지
  T.학당귀인 = STEMS.map((s) => STAGE_START[s]);             // 일간의 장생지
  const TIANDE = ['丁', '申', '壬', '辛', '亥', '甲', '癸', '寅', '丙', '乙', '巳', '庚']; // 월지 寅월부터
  const YUEDE = { 寅: '丙', 午: '丙', 戌: '丙', 申: '壬', 子: '壬', 辰: '壬', 亥: '甲', 卯: '甲', 未: '甲', 巳: '庚', 酉: '庚', 丑: '庚' };
  const GUCHEN = ['寅', '寅', '巳', '巳', '巳', '申', '申', '申', '亥', '亥', '亥', '寅'];
  const GUASU = ['戌', '戌', '丑', '丑', '丑', '辰', '辰', '辰', '未', '未', '未', '戌'];
  const PILLAR_LISTS = {
    괴강살: { list: ['庚辰', '庚戌', '壬辰', '戊戌'], note: '학파에 따라 壬戌·戊辰도 포함' },
    백호대살: { list: ['甲辰', '乙未', '丙戌', '丁丑', '戊辰', '壬戌', '癸丑'] },
    음양차착살: { list: ['丙子', '丁丑', '戊寅', '辛卯', '壬辰', '癸巳', '丙午', '丁未', '戊申', '辛酉', '壬戌', '癸亥'] },
    십악대패: { list: ['甲辰', '乙巳', '壬申', '丙申', '丁亥', '庚辰', '戊戌', '癸亥', '辛巳', '己丑'] },
  };
  const HYEONCHIM_CHARS = ['甲', '辛', '卯', '午', '申'];
  const KIND = {
    천을귀인: '길신', 문창귀인: '길신', 태극귀인: '길신', 국인귀인: '길신', 금여: '길신', 건록: '길신', 암록: '길신',
    학당귀인: '길신', 천덕귀인: '길신', 월덕귀인: '길신', 천의성: '길신', 홍란: '중립', 천희: '중립',
    양인: '흉살', 홍염살: '중립', 고신살: '흉살', 과숙살: '흉살', 괴강살: '중립', 백호대살: '흉살',
    음양차착살: '흉살', 십악대패: '흉살', 현침살: '중립', 공망: '흉살', 귀문관살: '흉살', 원진살: '흉살',
  };

  function pillarsOf(palja) {
    const out = {};
    POS.forEach((k) => { const p = palja[k + 'Pillar']; if (p) out[k] = { stem: p.stem, branch: p.branch, gz: p.stem + p.branch }; });
    return out;
  }

  // ---------- 신살 계산 ----------
  function sinsal(palja) {
    const P = pillarsOf(palja);
    const ds = P.day.stem, di = STEMS.indexOf(ds);
    const hits = [];
    const add = (name, where, basis, note) => { if (where.length) hits.push({ name, kind: KIND[name] || '중립', where, basis, ...(note ? { note } : {}) }); };
    const branchHits = (targets) => POS.filter((k) => P[k] && targets.includes(P[k].branch)).map((k) => POS_KO[k] + '지');

    ['천을귀인', '문창귀인', '태극귀인', '국인귀인', '금여', '건록', '암록', '학당귀인', '양인', '홍염살'].forEach((n) => {
      const t = T[n][di]; if (!t) return;
      add(n, branchHits(t.split('')), `일간 ${ds}`,
        n === '천을귀인' && (ds === '庚' || ds === '辛') ? '학파에 따라 庚辛 모두 寅午로 보기도 함' :
        n === '양인' ? '양간만 적용(음간 양인은 학파 차이)' : null);
    });

    // 월지 기준
    const mb = P.month.branch, mo = (bi(mb) + 10) % 12; // 寅월 = 0
    const td = TIANDE[mo];
    const tdWhere = BRANCHES.includes(td)
      ? branchHits([td])
      : POS.filter((k) => P[k] && P[k].stem === td).map((k) => POS_KO[k] + '간');
    add('천덕귀인', tdWhere, `월지 ${mb}`);
    add('월덕귀인', POS.filter((k) => P[k] && P[k].stem === YUEDE[mb]).map((k) => POS_KO[k] + '간'), `월지 ${mb}`);
    add('천의성', branchHits([BRANCHES[(bi(mb) + 11) % 12]]), `월지 ${mb}`);

    // 연지 기준
    const yb = P.year.branch, yi = bi(yb);
    const hongluan = BRANCHES[(3 - yi + 24) % 12];
    add('홍란', branchHits([hongluan]), `연지 ${yb}`);
    add('천희', branchHits([BRANCHES[(bi(hongluan) + 6) % 12]]), `연지 ${yb}`);
    add('고신살', branchHits([GUCHEN[yi]]), `연지 ${yb}`);
    add('과숙살', branchHits([GUASU[yi]]), `연지 ${yb}`);

    // 기둥 단위
    Object.entries(PILLAR_LISTS).forEach(([n, { list, note }]) => {
      add(n, POS.filter((k) => P[k] && list.includes(P[k].gz)).map((k) => POS_KO[k] + '주'), '기둥 간지', note);
    });

    // 현침살: 글자 단위
    const hc = [];
    POS.forEach((k) => {
      if (!P[k]) return;
      if (HYEONCHIM_CHARS.includes(P[k].stem)) hc.push(POS_KO[k] + '간');
      if (HYEONCHIM_CHARS.includes(P[k].branch)) hc.push(POS_KO[k] + '지');
    });
    add('현침살', hc, '甲·辛·卯·午·申 글자', '학파에 따라 未도 포함');

    // 공망: 일주가 속한 순(旬)에서 빠진 두 지지
    const g = gongmang(P.day.gz);
    add('공망', POS.filter((k) => k !== 'day' && P[k] && g.includes(P[k].branch)).map((k) => POS_KO[k] + '지'), `일주 ${P.day.gz} (${g.join('')} 공망)`);

    // 지지 쌍 신살(귀문·원진)은 relations에서 계산
    const rel = relations(palja);
    ['귀문관살', '원진살'].forEach((n) => {
      const rs = rel.filter((r) => r.type === n.replace('관살', '').replace('살', ''));
      if (rs.length) hits.push({ name: n, kind: '흉살', where: [...new Set(rs.flatMap((r) => r.where))], basis: rs.map((r) => r.chars).join(', ') });
    });

    // 기둥별로 다시 묶기
    const byPillar = { year: [], month: [], day: [], hour: [] };
    const keyOf = { 연: 'year', 월: 'month', 일: 'day', 시: 'hour' };
    hits.forEach((h) => h.where.forEach((w) => { const k = keyOf[w[0]]; if (k && !byPillar[k].includes(h.name)) byPillar[k].push(h.name); }));
    return { list: hits, byPillar };
  }

  function gongmang(dayGz) {
    const i = JIAZI.indexOf(dayGz);
    const xun = Math.floor(i / 10);
    return [BRANCHES[(xun * 10 + 10) % 12], BRANCHES[(xun * 10 + 11) % 12]];
  }

  // ---------- 형충회합파해 ----------
  const STEM_HAP = { 甲己: '土', 乙庚: '金', 丙辛: '水', 丁壬: '木', 戊癸: '火' };
  const STEM_CHUNG = ['甲庚', '乙辛', '丙壬', '丁癸'];
  const LIUHE_EL = { 子丑: '土', 寅亥: '木', 卯戌: '火', 辰酉: '金', 巳申: '水', 午未: '火' }; // 午未는 학파에 따라 土
  const PAIRS = {
    충: ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'],
    파: ['子酉', '丑辰', '寅亥', '卯午', '巳申', '未戌'],
    해: ['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌'],
    원진: ['子未', '丑午', '寅酉', '卯申', '辰亥', '巳戌'],
    귀문: ['子酉', '丑午', '寅未', '卯申', '辰亥', '巳戌'],
  };
  const SAMHAP = [['申子辰', '水'], ['亥卯未', '木'], ['寅午戌', '火'], ['巳酉丑', '金']];
  const BANGHAP = [['寅卯辰', '木'], ['巳午未', '火'], ['申酉戌', '金'], ['亥子丑', '水']];
  const HYEONG = [['寅巳申', '삼형(지세지형)'], ['丑戌未', '삼형(무은지형)']];
  const JAHYEONG = ['辰', '午', '酉', '亥'];
  const pairKey = (table, a, b) => {
    if (Array.isArray(table)) return table.find((p) => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a));
    return Object.keys(table).find((p) => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a));
  };

  // 두 글자(천간 또는 지지) 사이 관계. 원국 내부와 두 사람 사이 모두 이 함수를 쓴다.
  function stemPair(a, b) {
    const out = [];
    const h = pairKey(STEM_HAP, a, b); if (h) out.push({ type: '천간합', element: STEM_HAP[h] });
    if (pairKey(STEM_CHUNG, a, b)) out.push({ type: '천간충' });
    return out;
  }
  function branchPair(a, b) {
    const out = [];
    const lh = pairKey(LIUHE_EL, a, b); if (lh) out.push({ type: '육합', element: LIUHE_EL[lh] });
    for (const [t, list] of Object.entries(PAIRS)) if (pairKey(list, a, b)) out.push({ type: t });
    for (const [set, el] of SAMHAP) if (a !== b && set.includes(a) && set.includes(b)) out.push({ type: '반합', element: el, note: `${set} 삼합의 두 글자` });
    for (const [set, name] of HYEONG) if (a !== b && set.includes(a) && set.includes(b)) out.push({ type: '형', note: name });
    if ((a === '子' && b === '卯') || (a === '卯' && b === '子')) out.push({ type: '형', note: '자묘형(무례지형)' });
    if (a === b && JAHYEONG.includes(a)) out.push({ type: '형', note: '자형' });
    // 암합: 두 지지의 정기끼리 천간합 (이미 육합인 쌍은 제외)
    if (!lh) { const m = pairKey(STEM_HAP, MAIN_STEM[a], MAIN_STEM[b]); if (m && a !== b) out.push({ type: '암합', element: STEM_HAP[m], note: `정기 ${MAIN_STEM[a]}${MAIN_STEM[b]} 합` }); }
    return out;
  }

  // 여러 지지 묶음(삼합 완성·방합)
  function groupRelations(items) { // items: [{ch, where}]
    const out = [];
    for (const [list, type] of [[SAMHAP, '삼합'], [BANGHAP, '방합']]) {
      for (const [set, el] of list) {
        const found = set.split('').filter((c) => items.some((x) => x.ch === c));
        if (found.length === 3) out.push({ type, element: el, chars: set, where: items.filter((x) => set.includes(x.ch)).map((x) => x.where) });
      }
    }
    const hy = HYEONG[0][0], hy2 = HYEONG[1][0];
    for (const set of [hy, hy2]) {
      if (set.split('').every((c) => items.some((x) => x.ch === c))) out.push({ type: '삼형', chars: set, where: items.filter((x) => set.includes(x.ch)).map((x) => x.where) });
    }
    return out;
  }

  function relations(palja) {
    const P = pillarsOf(palja);
    const keys = POS.filter((k) => P[k]);
    const out = [];
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const A = P[keys[i]], B = P[keys[j]];
        stemPair(A.stem, B.stem).forEach((r) => out.push({ ...r, chars: A.stem + B.stem, where: [POS_KO[keys[i]] + '간', POS_KO[keys[j]] + '간'] }));
        branchPair(A.branch, B.branch).forEach((r) => out.push({ ...r, chars: A.branch + B.branch, where: [POS_KO[keys[i]] + '지', POS_KO[keys[j]] + '지'] }));
      }
    }
    groupRelations(keys.map((k) => ({ ch: P[k].branch, where: POS_KO[k] + '지' }))).forEach((r) => out.push(r));
    return out;
  }

  // ---------- 두 사람 사이 관계 (궁합용) ----------
  function compare(paljaA, paljaB, labels = ['A', 'B']) {
    const A = pillarsOf(paljaA), B = pillarsOf(paljaB);
    const out = [];
    for (const ka of POS) for (const kb of POS) {
      if (!A[ka] || !B[kb]) continue;
      const wa = `${labels[0]} ${POS_KO[ka]}`, wb = `${labels[1]} ${POS_KO[kb]}`;
      stemPair(A[ka].stem, B[kb].stem).forEach((r) => out.push({ ...r, chars: A[ka].stem + B[kb].stem, where: [wa + '간', wb + '간'] }));
      branchPair(A[ka].branch, B[kb].branch).forEach((r) => out.push({ ...r, chars: A[ka].branch + B[kb].branch, where: [wa + '지', wb + '지'] }));
    }
    // 한쪽 원국에 없던 삼합·방합이 두 사람을 합쳐서 완성되는 경우
    const items = [...POS.filter((k) => A[k]).map((k) => ({ ch: A[k].branch, where: `${labels[0]} ${POS_KO[k]}지`, who: 0 })),
      ...POS.filter((k) => B[k]).map((k) => ({ ch: B[k].branch, where: `${labels[1]} ${POS_KO[k]}지`, who: 1 }))];
    const inA = groupRelations(items.filter((x) => x.who === 0)).map((r) => r.type + r.chars);
    const inB = groupRelations(items.filter((x) => x.who === 1)).map((r) => r.type + r.chars);
    groupRelations(items).filter((r) => !inA.includes(r.type + r.chars) && !inB.includes(r.type + r.chars))
      .forEach((r) => out.push({ ...r, note: '두 사람이 합쳐야 완성' }));
    const dayA = A.day, dayB = B.day;
    return {
      dayMaster: { chars: dayA.stem + dayB.stem, relations: stemPair(dayA.stem, dayB.stem),
        shipsin: [`${labels[1]}의 일간은 ${labels[0]}에게 ${shipsinOf(dayA.stem, dayB.stem)}`, `${labels[0]}의 일간은 ${labels[1]}에게 ${shipsinOf(dayB.stem, dayA.stem)}`] },
      dayBranch: { chars: dayA.branch + dayB.branch, relations: branchPair(dayA.branch, dayB.branch) },
      all: out,
    };
  }

  // ---------- 세운(특정 연도) ----------
  // 연도 간지는 입춘 기준이다. 그해 입춘 전 날짜는 전년도 간지를 쓴다.
  function sewoon(palja, year) {
    const gz = JIAZI[((year - 4) % 60 + 60) % 60];
    const P = pillarsOf(palja);
    const ds = P.day.stem, s = gz[0], b = gz[1];
    const rel = [];
    POS.forEach((k) => {
      if (!P[k]) return;
      stemPair(s, P[k].stem).forEach((r) => rel.push({ ...r, chars: s + P[k].stem, where: ['세운 천간', POS_KO[k] + '간'] }));
      branchPair(b, P[k].branch).forEach((r) => rel.push({ ...r, chars: b + P[k].branch, where: ['세운 지지', POS_KO[k] + '지'] }));
    });
    const sins = [];
    const di = STEMS.indexOf(ds);
    ['천을귀인', '문창귀인', '건록', '암록', '양인', '홍염살'].forEach((n) => { const t = T[n][di]; if (t && t.includes(b)) sins.push(n); });
    return {
      year, ganzhi: gz, nabeum: nabeumOf(gz),
      stemShipsin: shipsinOf(ds, s), branchShipsin: shipsinOf(ds, MAIN_STEM[b]),
      unseong: unseongOf(ds, b),
      sibiShinsal: { byYear: sibiOf(P.year.branch, b), byDay: sibiOf(P.day.branch, b) },
      gongmang: gongmang(P.day.gz).includes(b),
      sinsal: sins,
      relations: rel,
    };
  }

  function analyzeExtras(palja) {
    const P = pillarsOf(palja);
    const jijanggan = {}, nabeum = {};
    POS.forEach((k) => {
      if (!P[k]) return;
      const [a, b, c] = JIJANGGAN[P[k].branch];
      jijanggan[k] = { 여기: a, 중기: b, 정기: c };
      nabeum[k] = nabeumOf(P[k].gz);
    });
    return { jijanggan, nabeum, gongmang: gongmang(P.day.gz), sinsal: sinsal(palja), relations: relations(palja) };
  }

  const api = { analyzeExtras, sinsal, relations, compare, sewoon, gongmang, nabeumOf, shipsinOf, unseongOf, stemPair, branchPair, JIJANGGAN, TABLES: T };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.SajuExtras = api;
})(typeof window !== 'undefined' ? window : globalThis);
