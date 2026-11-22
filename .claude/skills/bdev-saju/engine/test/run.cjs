#!/usr/bin/env node
'use strict';
// 만세력 엔진 회귀 테스트: node test/run.cjs
const path = require('path');
const { compute } = require(path.join(__dirname, '..', 'manse.cjs'));
const golden = require('./golden-jieqi.json').cases;

let pass = 0, failN = 0;
const p = (x) => x.stem + x.branch;
function check(name, got, want) {
  if (got === want) { pass++; return; }
  failN++;
  console.log(`✗ ${name}: 기대 ${want}, 결과 ${got}`);
}

// 1) 절기 경계 (독립 엔진 2곳이 합의한 정답)
for (const c of golden) {
  const r = compute([c.input, '남', '표준시']).result.palja;
  check(`${c.input} (${c.note}) 연·월·일주`, [p(r.yearPillar), p(r.monthPillar), p(r.dayPillar)].join(' '), [c.year, c.month, c.day].join(' '));
}

// 2) 개별 케이스
const cases = [
  // 기대값은 k-saju·bazi-engine으로 확인했다(서머타임 시기는 k-saju 기준 — bazi-engine은 한국 출생에도 중국 서머타임을 적용함)
  // 2024 입춘 = 2024-02-04 17:27 KST
  ['2024-02-04 17:20 남 서울', '癸卯 乙丑 戊戌 庚申', '입춘 7분 전 → 아직 계묘년'],
  ['2024-02-04 17:30 남 서울', '甲辰 丙寅 戊戌 庚申', '입춘 3분 후 → 갑진년'],
  // 1987 서머타임(UTC+10): 09:00 → 표준시 08:00 → 진태양시 07:28
  ['1987-05-22 09:00 남 서울', '丁卯 乙巳 辛未 壬辰', '1987 서머타임'],
  ['1987-05-22 08:20 남 서울', '丁卯 乙巳 辛未 辛卯', '1987 서머타임 → 06:48 卯시'],
  // 1958: 표준시 UTC+8:30, 서머타임 UTC+9:30
  ['1958-07-01 12:00 남 표준시', '戊戌 戊午 己卯 庚午', '1958 서머타임 제거 → 11:00 午시'],
  // 음력 윤달: 2023 윤2월 22일 = 양력 2023-04-12
  ['2023-02-22 10:00 여 음력 윤달 표준시', '癸卯 丙辰 庚子 辛巳', '음력 윤2월'],
  ['2023-02-22 10:00 여 음력 표준시', '癸卯 乙卯 庚午 辛巳', '음력 평2월'],
  // 경도 보정 경계: 서울 −32분
  ['1995-08-15 15:00 남 서울', '乙亥 甲申 戊寅 己未', '15:00 → 14:28 未시'],
  ['1995-08-15 15:00 남 표준시', '乙亥 甲申 戊寅 庚申', '보정 끄면 申시'],
];
for (const [inp, want, note] of cases) {
  const r = compute([inp]).result.palja;
  check(`${inp} (${note})`, [p(r.yearPillar), p(r.monthPillar), p(r.dayPillar), p(r.hourPillar)].join(' '), want);
}

// 3) 신살·관계 표 (extras.js) — 표끼리 서로 유도되는 관계로 검산
//    표 값 자체는 bazi-engine·sungheeyoon/saju와 전 항목 대조했다(README 참고)
const X = require(path.join(__dirname, '..', 'extras.js'));
const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'], BR = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const T = X.TABLES, step = (b, n) => BR[(BR.indexOf(b) + n) % 12];
STEMS.forEach((s, i) => {
  check(`문창 = 건록+3 (${s})`, T.문창귀인[i], step(T.건록[i], 3));
  check(`금여 = 건록+2 (${s})`, T.금여[i], step(T.건록[i], 2));
  if (i % 2 === 0) check(`양인 = 건록+1 (${s})`, T.양인[i], step(T.건록[i], 1));
  check(`학당 = 장생지 (${s})`, X.unseongOf(s, T.학당귀인[i]), '장생');
  check(`건록 = 12운성 건록 (${s})`, X.unseongOf(s, T.건록[i]), '건록');
  check(`암록 = 건록의 육합 (${s})`, X.branchPair(T.건록[i], T.암록[i]).some((r) => r.type === '육합'), true);
});
const JZ = Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BR[i % 12]);
const voids = JZ.filter((_, i) => i % 10 === 0).flatMap((g) => X.gongmang(g));
check('공망: 여섯 순에서 12지지가 한 번씩', [...new Set(voids)].length + '/' + voids.length, '12/12');
const shiE = JZ.filter((g) => X.gongmang(g).includes(T.건록[STEMS.indexOf(g[0])]));
check('십악대패 = 일간 건록이 공망인 일주', shiE.sort().join(), ['甲辰','乙巳','壬申','丙申','丁亥','庚辰','戊戌','癸亥','辛巳','己丑'].sort().join());
const pairs = (t) => BR.flatMap((a, i) => BR.slice(i + 1).filter((b) => X.branchPair(a, b).some((r) => r.type === t)).map((b) => a + b)).sort();
check('귀문과 원진은 4쌍이 같고 2쌍이 다르다', pairs('귀문').filter((x) => pairs('원진').includes(x)).length, 4);
check('반합은 왕지를 껴야 한다(申辰 아님)', X.branchPair('申', '辰').some((r) => r.type === '반합'), false);
check('반합 申子', X.branchPair('申', '子').some((r) => r.type === '반합'), true);
const nab = X.nabeumOf('甲子') + X.nabeumOf('乙丑') + X.nabeumOf('壬戌') + X.nabeumOf('癸亥');
check('납음 처음과 끝', nab, '해중금해중금대해수대해수');

// 4) 가족 명식 스냅샷
const snap = (inp) => { const e = X.analyzeExtras(compute([inp]).result.palja); return e.sinsal.list.map((h) => h.name).join(','); };
check('남편 신살', snap('1987-05-22 09:00 남 서울'), '국인귀인,암록,태극귀인,천덕귀인,천의성,고신살,괴강살,음양차착살,십악대패,현침살');
check('아내 신살', snap('1992-12-22 07:26 여 서울'), '천을귀인,학당귀인,양인,홍염살,태극귀인,월덕귀인,십악대패,현침살,귀문관살,원진살');

console.log(`\n통과 ${pass} / 실패 ${failN}`);
process.exit(failN ? 1 : 0);
