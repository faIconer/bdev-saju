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

console.log(`\n통과 ${pass} / 실패 ${failN}`);
process.exit(failN ? 1 : 0);
