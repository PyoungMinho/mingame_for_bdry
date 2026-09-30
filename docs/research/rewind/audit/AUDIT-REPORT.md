# 「인생 2회차」 2차 사전조사 감사 보고서

> 작성 2026-09-30 · 데이터 편집자
> 정본 데이터: `docs/research/rewind/audit/verified-data.json` (8개 배치 통합, 665개 값, id 중복 없음)
> 배치 원본: `audit/{kr_equity, us_equity, crypto, fx_rates, gold_wage_prices, real_estate, tax_gamble, rules_timeline}.json`
> 감사 규칙: 게임에 들어갈 값만 감사, 값마다 서로 독립된 출처 2곳 이상(같은 데이터를 재가공한 사이트는 1곳으로 계산), 원천(ECOS·KRX/다음·네이버 API·Yahoo chart API·Bitstamp·업비트·FRED·law.go.kr·동행복권·KB/부동산원) 우선. 확인하지 못한 값은 `unverifiable`로 두고 게임 대체안을 붙였다.

---

## 0. 결론 먼저

1. **값 자체보다 "기준"이 틀린 경우가 더 많았다.** 정정 101건 중 약 70건은 숫자를 잘못 옮긴 것이 아니라 기준이 달랐다. 업비트 일봉의 날짜 경계가 KST 09:00였고, 예금금리는 만기 계열이 달랐으며, 금값은 연말 종가가 아니라 12월 평균을 썼다. 게임 엔진은 **이 보고서의 기준 정의(§2-A)를 그대로 코드 상수로 고정**해야 한다.
2. **주가(국내·미국)는 사실상 깨끗하다.** 212개 중 3건만 정정했다. 새롬 수정가 기준 명시 2건, NVDA 2001 분할일 1건이다.
3. **게임 규칙을 바꿔야 하는 발견이 있다**(§2-B). 2008년 알바 불가(중학생), 2008-06 LTV 70% 완화의 서울 미적용, 15억 초과 주담대 허용 시점(2022-12-01), 2002년까지 강남 30평대 1주택 양도세 비과세(면적 기준), 은마·잠실주공5의 2025 토허제 해제 창 제외 확정이 여기에 해당한다.
4. **세무조사 이벤트에 쓸 법정 수치가 확보됐다**(§2-C). 증여공제, 증여세율, 신고세액공제, 가산세(연도별), 차명거래 처벌(2014-11-29~), 토토·로또 세율이 모두 법령 원문과 당시 기사로 확인됐다. 단 **부과제척기간(몇 년 전 증여까지 추징할 수 있는지)은 이번 감사 범위 밖**이다. 이벤트에 "N년 전 거래 추징"을 쓰려면 추가 조사가 필요하다.
5. `unverifiable` 31건은 모두 대체안이 있다(§5). 게임 핵심 가격(주식·코인·환율·금리·은마 KB 시세) 중 대체안 없이 막히는 값은 없다.

---

## 1. 배치별 통계

배치 JSON 최종본 기준이다(= `verified-data.json` 메타).

| 배치 | 전체 | verified | corrected | unverifiable | 2차 재검증에서 뒤집힘* |
|---|---:|---:|---:|---:|---:|
| kr_equity (국내 주식·지수) | 101 | 99 | 2 | 0 | 0 |
| us_equity (미국 주식·분할) | 111 | 110 | 1 | 0 | 0 |
| crypto (BTC·LUNA) | 58 | 34 | 24 | 0 | 2 |
| fx_rates (환율·기준금리·예금) | 96 | 68 | 27 | 1 | 1 |
| gold_wage_prices (금·최저임금·물가) | 80 | 42 | 31 | 7 | 0 |
| real_estate (KB·실거래·은마·대출·토허) | 112 | 88 | 6 | 18 | 3 |
| tax_gamble (세금·가산세·토토·로또) | 66 | 60 | 3 | 3 | 2 |
| rules_timeline (연령·거래소·제도·생활) | 41 | 32 | 7 | 2 | 2 |
| **합계** | **665** | **533** | **101** | **31** | **10** |

비율로는 verified 80.2%, corrected 15.2%, unverifiable 4.7%다.

\* "뒤집힘"은 오케스트레이터 요약의 `overturned` 값이다. 감사자 판정을 2차 재검증이 바꾼 건수다.

**요약값과 파일값의 차이**: 오케스트레이터 요약은 real_estate 88/4/20, tax_gamble 59/3/4, rules_timeline 30/7/4로 적었다. 파일 최종본은 88/6/18, 60/3/3, 32/7/2다. 뒤집힌 판정(unverifiable → verified/corrected)이 파일에만 반영된 결과이므로 **파일값이 정본**이다.

### 1-1. 2차 재검증에서 뒤집힌 판정

| 배치 | id | 감사자 판정 | 최종 | 요지 |
|---|---|---|---|---|
| crypto | `btc.usd.close.2012` | corrected 13.24(Bitstamp) | **verified 13.51** | 2012-12-31 거래량은 Mt.Gox 15,050 BTC, Bitstamp 1,642 BTC였다. Bitstamp 13.24는 3시간 동안 체결이 없던 묵은 값이다. 2010~2012는 Mt.Gox 기준으로 한다. |
| crypto | `btc.usd.close.2011` | (Bitstamp 4.58) | **corrected 4.72** | 같은 결함이다. Mt.Gox 종가 4.722이고 CoinMetrics 4.71과 일치한다. |
| fx_rates | `deposit.1y.2026-07` | "보도자료엔 저축성수신만" | unverifiable 유지(3.49) | 한은 보도자료 표에 '정기예금 1년 3.48(잠정)'이 실려 있었다. 다만 같은 기관이라 독립 2곳 규칙은 여전히 충족하지 못한다. |
| real_estate | `eunma76.2001-12` | unverifiable | **corrected 3.7억** | 한국경제 2002-02-04 "3억6천만원 매물", 연합 2002-10-29 "연초 3.5~4.2억"으로 확인했다. |
| real_estate | `eunma76.2002-09` | unverifiable 4.8억(2002-09) | **corrected 4.8억(2002 연말)** | 4.8억은 9월이 아니라 연말 값이다. 9월은 5.0~5.2억 고점 구간이었다(당시 보도 3건). |
| real_estate | `land_permit.2025-10-20.seoul_all` | 만료일 미확인 | verified(만료 2026-12-31) | 국토부 공고 제2025-1219호로 확인했다. |
| tax_gamble | `toto.age_rule.2001` | unverifiable | **verified(20세 미만 금지)** | 한국경제 2001-09-12, 국민일보 2001-10-24를 찾았다. |
| tax_gamble | `re.cgt.1house.threshold.2000_2002` | basis "165㎡(약 45평)" | verified, basis 정정 | 165㎡는 50평이다. 2002-10-01부터 45평(≈149㎡) 기준이 적용됐다. |
| rules_timeline | `iphone.3gs16.price` | unverifiable | **verified 264,000원** | 머니투데이 2009-11-22, 헤럴드경제 2009-11-26으로 확인했다. |
| rules_timeline | `galaxys.kr_launch` | unverifiable | **verified 2010-06-24** | 경향, 디지털데일리, 한경비즈니스 3곳으로 확인했다. |

### 1-2. 품질 점검(편집자)

- verified·corrected 634건은 모두 `sources`가 2개 이상이다. 출처가 0~1개인 항목(17건)은 모두 `unverifiable`이다.
- `audit/` 폴더에 감사 작업 중 남은 파일 `ddg.html`, `naver.html`이 있다. 데이터가 아니므로 이 편집에서는 건드리지 않았다. 정리 여부는 PM이 판단한다.

---

## 2. 게임 설계에 영향을 주는 발견

### 2-A. 기준 정의 (엔진 상수로 고정할 것)

| 자산 | 확정 기준 | 1차 기준과 다른 점 | 영향 |
|---|---|---|---|
| BTC 원화 | 연말 = **12-31 24:00 KST**. 2017~: 업비트 1분봉 23:59 종가. 2013~2016: 코빗 KST 일봉 종가 | 업비트 일봉 API는 **UTC 00:00(KST 09:00)에 끊긴다**. 1차 2017~2026 값은 모두 다음 날 오전 9시 가격이었다 | 연도별 -2.9%~+2.9% 차이. 2013~2016은 USD×환율 계산값을 **실제 국내 시세**로 대체했다(2013 764,002원) |
| BTC USD | 2013~: **Bitstamp UTC 일봉**. 2010~2012: Mt.Gox 체결 | 1차 StatMuse(=CMC 집계)에는 김치 프리미엄이 붙은 한국 거래소가 섞여 1~3% 높았다 | 2013 754.01 → 732.0, 2017 14,156 → 13,880 |
| 정기예금 | ECOS 121Y002 **정기예금 1~2년 미만** 연평균(세전) | 1차는 "정기예금 전체 만기" 계열이었다 | 26년 복리 ×2.31 → **×2.44**(세전), 세후 ×2.03 → **×2.13**(15.4% 가정) |
| 금 1돈 | **연말 LBMA PM × ECOS 연말 환율** ÷ 31.1035 × 3.75(이론값, 부가세·마진 제외) | 1차는 World Bank 12월 월평균이었다 | 2008 +6.6%, 2011 -6.6% 등. 2000→2026 배수 16.5 → **16.3배** |
| 금(국내) | KRX 금시장 종가를 쓸 경우 이론값과 섞지 말 것 | 2025-10-15 KRX가 이론값보다 **+18.1%** 비쌌다 | 한 가지로 고정하지 않으면 수익률이 흔들린다. "국내 금 프리미엄 함정" 이벤트 소재로 쓸 수 있다 |
| 국내 주가 2025-03~ | **KRX 정규장 종가**(Yahoo 종가, 다음 익일 기준가로 대조) | 네이버·다음 '종가'가 NXT(대체거래소) 통합 체결가일 수 있다(삼성 9/29 275,000 vs KRX 272,500) | 데이터 파이프라인에서 네이버 값을 그대로 쓰면 안 된다 |
| 새롬기술 | 수익률은 무증 반영 수정가(02-29 종가 143,000 → 연말 5,500, -96.2%), 대사는 원시가(02-18 282,000) | 1차는 두 기준을 섞었다 | 대사를 쓸 때 "3월 초 28만2천원"은 틀린 표현이다. "2월 18일 28만2천원"으로 쓴다 |
| 날짜 | 게임은 **KST 날짜**로 쓴다 | UTC/ET 날짜가 섞여 있었다 | BTC 2011 고점 06-08 UTC = **06-09 KST**. 2026 원화 고점 **01-15 KST**. 2026 USD 저점 **07-01 UTC**. 금 2026 장중 고점 **01-29 KST** |

### 2-B. 규칙·시점이 바뀐 것 (게임 로직 수정 필요)

| 항목 | 1차 | 2차 확정 | 게임 영향 |
|---|---|---|---|
| 알바 해금 | 만 15세(2008년) 가능 | 근로기준법(2005-07-01~)상 **중학교 재학 중인 18세 미만은 취직인허증 없이 고용 불가**. 1993.3~12월생은 2008년에 중3이다 | 합법 알바는 **2009-03 고1 진학 후**(친권자 동의서 필요)부터다. 2008년 알바는 '취직인허증' 또는 비공식 이벤트로만 처리한다 |
| 2008-06 LTV 70% 완화 | 전국 완화처럼 기재 | **지방 비투기지역 미분양 주택 한정**(2008-06-11) | 서울 대출 한도를 2008-06에 올리면 오류다 |
| 2009 수도권 대출 규제 | 없음 | 2009-07-07 수도권 비투기지역 LTV 50%, 2009-09-07 DTI 서울 50%·인천경기 60% | 2009년 강남 외 서울 매수 시 대출 한도가 줄어든다 |
| 12·16 대책 | 2019-12-16 | 발표 12-16, **15억 초과 주담대 금지 효력 12-17**, 9억 초과분 LTV 20%는 **12-23** | 하루 차이로 판정이 달라진다 |
| 15억 초과 주담대 허용 | 2023 | **2022-12-01**(규제지역 무주택·1주택 LTV 50% 단일화) | "2022-12 부동산 매수 정답" 루트에서 대출을 바로 쓸 수 있다 |
| 8·2 대책 | 2017-08-02 40% | 발표 08-02, 투기지역 08-03, **서울 전 주택 LTV·DTI 40%는 08-23** | 3주 동안 매수 창이 생긴다 |
| 10·15 대책 한도 | 6/4/2억(미검증) | **확인**: 시가 15억 이하 6억 / 15~25억 4억 / 25억 초과 2억, 스트레스 금리 하한 3.0%, 10-16 시행 | 그대로 사용 |
| 1주택 양도세 비과세 고가주택 | ~2021-12-07 9억 | 2000~2002: 6억 초과 **그리고** 면적(전용 50평, 2002-10-01부터 45평) → 2003: 6억 → **2008-10-07: 9억** → 2021-12-08: 12억. 보유요건 3년 → 2012-06-29 2년 | **은마 31평은 2002년까지 가격과 무관하게 비과세**다. 2006-11 고점(11.25억) 매도는 6억 초과분 과세 대상이다 |
| 취득세 | 현행만 | 2000~2004 5.8% → 2005-01-05 4.6% → 2011 4.0% → 2013-08-28 1/2/3% → 2020 6~9억 구간 세분 → 2020-08-12 다주택 8%/12% | 부동산 매수 비용을 연도별 상수로 넣는다 |
| 증권거래세 인하 | 2019-06 0.25% | **2019-05-30 체결분**부터 0.25%. 2000~2019-05-29 0.30%는 역산값이 아니라 확인값(코스피 거래세 0.15 + 농특세 0.15) | 이틀 차이이므로 월 단위 게임이면 무시해도 된다 |
| 해외주식 양도세 | 도입 연도 미확인 | **1999-01-01부터 22%, 연 250만원 공제**(2000~2026 전 기간) | NVDA·AAPL 루트 전체에 같은 공식을 쓴다 |
| 복권 33% 구간 | 2007년 초('1-06 추첨분') | **2007-01-01 이후 지급분** | 추첨일이 아니라 지급일 기준이다 |
| 코빗 | 2013-04 베타 / 07 법인 | 창립 **2013-07-05**, 국내 첫 원화 BTC 체결 **2013-09-03** | 국내 원화 코인 매수는 2013-09-03 이후 성년 본인 명의로만 허용한다(미성년 약관 쟁점이 사라진다) |
| XCOIN(빗썸 전신) | 2014 | 서비스 오픈 **2013-12-31**, 빗썸 개명 2015-07 | |
| 코인원 | 2014-08-25 | **2014-08**(일자 미확정) | 월 단위로만 쓴다 |
| 해외주식 소수점 거래 | 2020-08 미니스탁 | 최초는 **2018-10 신한금투**, 미니스탁은 2020-08-13 | "최초" 표현을 조심한다 |
| 육군 18개월 | 2020-06-02 입대자부터 | **2020-06-15** 입대자부터 | 1993년생(2012~2016 입대)은 21개월로 바뀌지 않는다 |
| 2012 수능 지원자 | 693,631 | **693,634**(응시 648,946은 맞음) | |
| 토허제 2025-02 해제 | 은마 포함 여부 미확인 | 305개 중 291개 해제. **은마·잠실주공5 등 재건축 14개 단지는 유지** | 은마로 해제 창 갭투자를 하는 선택지는 불가하다 |
| 토허제 연장 | "2026-09-17 연장"(의심) | **2025-09-17** 연장 결정(만료 2026-12-31) | 2026년 연장 이벤트는 없다 |
| 은마 2000~2003 곡선 | 2.2 / 2.5 / 4.0 / 6.0억 | **2.2 / 3.7 / 4.8 / 6.05억**, 2002-09 고점 약 5.0억(최고 5.2), 2003-09 고점 7.2억 → 10·29 대책 후 6.3억 | 2001년 은마가 1차 가정보다 48% 비싸다. "2002 토토 상금 → 강남 갭" 루트의 필요 자금이 늘어난다 |
| 2022 서울 실거래 낙폭 | 고점 대비 -24.3% | 공표 **연간 -22.09%**(검증). -24.3%는 부동산원 지수에서 계산한 값이다(독립 출처 없음) | 연출에는 -22.09%를 쓰거나 "고점 대비 약 -24%(지수 계산)"로 명시한다 |
| BTC 2011 연중 고점 | 35.88 | **31.91**(Mt.Gox, 2011-06-08 UTC). 35.88은 어느 원천에도 없다 | |
| BTC 첫 $1,000 | 2013-11-28 | **2013-11-27**(Mt.Gox). Bitstamp는 11-28 | |
| LUNA 고점 | 2022-05-07~ 장중 $119.51 | 사상 최고 **2022-04-05 $119.18**(집계). 05-06 $77.30 → 05-13 약 $0.0001 | 붕괴 직전 고점이 아니다. 한 달 전 고점이었다 |
| 2026 환율 최저 | 없음 | **2026-09-09 1,336.1원**(ECOS·FRED) | "2026 고점(07-02 1,555.8)에 달러 팔기"의 반대편 값이다 |
| 금 2026 고점 | 장중 약 $5,600(01-28) | 장중 약 $5,600(**01-29 KST**), LBMA PM 최고 $5,405, **KRX 1돈 1,011,788원**(사상 최고 종가) → 9/29 680,475원(-32.7%) | "금 1돈 100만원 돌파" 연출이 가능하다. 이론값 기준 낙폭은 -26.7%다 |

### 2-C. 세무조사·증여 이벤트용 확정 수치 (PM 요청 관련)

"세무조사 들어가면 세금으로 깎이는" 이벤트에 그대로 쓸 수 있는 값이다. 모두 law.go.kr 연혁 원문과 당시 기사로 확인했다.

| 항목 | 기간 | 값 | id |
|---|---|---|---|
| 증여재산공제(직계존속→자녀, 10년 합산) | 2000-01-01~2013-12-31 | 미성년 **1,500만**, 성년 **3,000만**(1차 미확인이던 2000~2004도 같은 값으로 확정) | `gift.deduction.*.2000_2013` |
| | 2014-01-01~ | 미성년 **2,000만**, 성년 **5,000만** | `gift.deduction.*.2014` |
| 증여세율 | 2000~2026 동일 | 1억 이하 10% / 5억 20% / 10억 30% / 30억 40% / 초과 50% | `gift.rate.2000_2026` |
| 신고세액공제(기한 내 자진신고) | ~2016 / 2017 / 2018 / 2019~ | **10%** / 7% / 5% / 3% (1차의 "3%"는 2019년 이후에만 맞다) | `gift.report_credit.*` |
| 신고불성실가산세 | 2000~2003 | 무신고·과소 모두 20% | `penalty.report.2000_2003` |
| | 2004~2006 | 일반 과소 10%, 무신고·부정 과소 20% | `penalty.report.2004_2006` |
| | 2007~ | 일반 무신고 20%, 일반 과소 10%, **부정 40%**(역외 부정 60%, 2015~) | `penalty.report.2007` |
| 납부불성실(지연)가산세 | 2000~2003 | 1년 내 10%, 이후 일 0.03%, 한도 20% | `penalty.payment.2000_2003` |
| | 2004~2019-02-11 | 일 0.03%(연 10.95%) | `penalty.payment_daily.2007` |
| | 2019-02-12~ / 2022-02-15~ | 일 0.025% / 일 0.022% | `penalty.payment_daily.2019/2022` |
| 차명거래 처벌 | 2014-11-29~ | 금융실명법상 탈법 목적 차명 금지, 5년 이하 징역 또는 5천만원 이하 벌금, **실명계좌 자산은 명의자 소유로 추정** | `finrealname.nominee_ban` |
| 토토 당첨 세금 | 2002 | 기타소득(당첨금-구입액) 건별 1만원 초과 시 22%. 스페인전 10만원×45.07 → 세후 약 354만원 | `toto.tax.2002` |
| 로또 19회 세후 | 2003-04 | 317억6,390만원(세율 22%) | `lotto.r19.after_tax` |

설계 메모:
- **2014-11-29 전후로 "부모 명의 계좌" 리스크가 다르다.** 그 전에는 탈세 목적 차명도 형사처벌 조항이 없었다(증여세 추징만 가능). 그 뒤로는 명의자 소유로 추정되어 증여세에 형사처벌까지 붙는다. 회귀자가 미성년 시절 부모 명의로 불린 자산을 성년 후 넘겨받는 장면에 자연스러운 분기가 생긴다.
- 세무조사 이벤트 계산 예(2007년 이후, 부정 무신고): 추징 = 증여세 산출세액 + 40% 가산 + 지연일수 × 0.03%(0.025/0.022%).
- **미조사 항목**: 증여세 부과제척기간(일반 10년, 부정 15년 등). 이벤트에 "몇 년 전 거래까지 조사한다"를 쓰려면 이 값의 연혁 감사가 먼저 필요하다.

---

## 3. 1차 대비 정정 목록 (corrected 101건 전체)

"이전"은 1차 조사값, "이후"는 2차 확정값이다. 출처는 각 항목의 앞 3개만 적었고, 전체 목록과 판정 근거는 `verified-data.json`의 `sources`와 `note`에 있다.

#### kr_equity (2건)

| id | 이전(1차) | 이후(2차) | 단위 | 출처 |
|---|---|---|---|---|
| `saerom.close.2000-02-29.adj` (2000-02-29) | (1차: 고점=2000-02-18 282,000으로만 기재) | **143,000** | KRW/주(무증 반영 수정가) | [1](https://api.finance.naver.com/siseJson.naver?symbol=035610&requestType=1&startTime=19990101&endTime=20260930&timeframe=day) · [2](https://query1.finance.yahoo.com/v8/finance/chart/035610.KQ?period1=915148800&period2=1791000000&interval=1d&events=split) · [3](https://finance.daum.net/api/quote/A035610/days?symbolCode=A035610&perPage=100&pagination=true) |
| `saerom.high.2000-03-02.adj` (2000-03-02) | 없음 | **156,500** | KRW/주(무증 반영 수정가) | [1](https://api.finance.naver.com/siseJson.naver?symbol=035610&requestType=1&startTime=19990101&endTime=20260930&timeframe=day) · [2](https://query1.finance.yahoo.com/v8/finance/chart/035610.KQ?period1=915148800&period2=1791000000&interval=1d&events=split) · [3](https://finance.daum.net/api/quote/A035610/days?symbolCode=A035610&perPage=100&pagination=true) |

#### us_equity (1건)

| id | 이전(1차) | 이후(2차) | 단위 | 출처 |
|---|---|---|---|---|
| `nvda.split.2001-09-17` (2001-09-17) | 2001-09-12 2:1 | **2** | 분할 배수(1주→n주) | [1](https://www.sec.gov/Archives/edgar/data/1045810/000101287001502932/0001012870-01-502932.txt) · [2](https://www.sec.gov/Archives/edgar/data/1045810/000101287001501827/0001012870-01-501827.txt) · [3](https://www.stocksplithistory.com/nvidia/) |

#### crypto (24건)

| id | 이전(1차) | 이후(2차) | 단위 | 출처 |
|---|---|---|---|---|
| `btc.usd.close.2011` (2011-12-31) | 4.61 | **4.72** | USD/BTC | [1](http://web.archive.org/web/20140330235726id_/http://api.bitcoincharts.com/v1/csv/mtgoxUSD.csv.gz) · [2](https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD&start_time=2011-12-31&end_time=2011-12-31) · [3](http://web.archive.org/web/20140330235717id_/http://api.bitcoincharts.com/v1/csv/btceUSD.csv.gz) |
| `btc.usd.close.2013` (2013-12-31) | 754.01 | **732** | USD/BTC | [1](https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=86400&limit=1&start=1388448000) · [2](https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD&start_time=2013-12-31&end_time=2013-12-31) · [3](https://api.blockchain.info/charts/market-price?timespan=all&format=json&sampled=false) |
| `btc.usd.close.2017` (2017-12-31) | 14156.4 | **13,880** | USD/BTC | [1](https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=86400&limit=1&start=1514678400) · [2](https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400&start=2017-12-31T00:00:00Z&end=2017-12-31T23:59:59Z) · [3](https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD&start_time=2017-12-31&end_time=2017-12-31) |
| `btc.usd.close.2018` (2018-12-31) | 3742.7 | **3,693.3** | USD/BTC | [1](https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=86400&limit=1&start=1546214400) · [2](https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400&start=2018-12-31T00:00:00Z&end=2018-12-31T23:59:59Z) · [3](https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD&start_time=2018-12-31&end_time=2018-12-31) |
| `btc.krw.close.2013` (2013-12-31) | 약 79.6만(USD×환율 계산값) | **764,002** | KRW/BTC | [1](https://api.korbit.co.kr/v2/candles?symbol=btc_krw&interval=1D&start=1388415600000&end=1388501999000&limit=1) · [2](https://api.bithumb.com/v1/candles/days?market=KRW-BTC&count=1&to=2014-01-01%2000:00:00) · [3](https://data.bitcoinity.org/export_data.csv?currency=KRW&data_type=price&c=e&t=l&timespan=all) |
| `btc.krw.close.2014` (2014-12-31) | 약 35.2만(계산값) | **338,000** | KRW/BTC | [1](https://api.korbit.co.kr/v2/candles?symbol=btc_krw&interval=1D&start=1419951600000&end=1420037999000&limit=1) · [2](https://api.bithumb.com/v1/candles/days?market=KRW-BTC&count=1&to=2015-01-01%2000:00:00) · [3](https://data.bitcoinity.org/export_data.csv?currency=KRW&data_type=price&c=e&t=l&timespan=all) |
| `btc.krw.close.2015` (2015-12-31) | 약 50.5만(계산값) | **509,900** | KRW/BTC | [1](https://api.korbit.co.kr/v2/candles?symbol=btc_krw&interval=1D&start=1451487600000&end=1451573999000&limit=1) · [2](https://api.bithumb.com/v1/candles/days?market=KRW-BTC&count=1&to=2016-01-01%2000:00:00) · [3](https://data.bitcoinity.org/export_data.csv?currency=KRW&data_type=price&c=e&t=l&timespan=all) |
| `btc.krw.close.2016` (2016-12-31) | 약 116.4만(계산값) | **1,192,500** | KRW/BTC | [1](https://api.korbit.co.kr/v2/candles?symbol=btc_krw&interval=1D&start=1483110000000&end=1483196399000&limit=1) · [2](https://api.bithumb.com/v1/candles/days?market=KRW-BTC&count=1&to=2017-01-01%2000:00:00) · [3](https://data.bitcoinity.org/export_data.csv?currency=KRW&data_type=price&c=e&t=l&timespan=all) |
| `btc.krw.close.2017` (2017-12-31) | 19280000 (업비트 API 일봉 '2017-12-31' 종가 = 실제로는 다음해 1/1 09:00 KST 시점) | **18,713,000** | KRW/BTC | [1](https://api.upbit.com/v1/candles/minutes/1?market=KRW-BTC&count=1&to=2018-01-01T00:00:00%2B09:00) · [2](https://api.bithumb.com/v1/candles/minutes/1?market=KRW-BTC&count=1&to=2018-01-01%2000:00:00) · [3](https://api.korbit.co.kr/v2/candles?symbol=btc_krw&interval=1D&start=1514646000000&end=1514732399000&limit=1) |
| `btc.krw.close.2018` (2018-12-31) | 4200000 (업비트 API 일봉 '2018-12-31' 종가 = 실제로는 다음해 1/1 09:00 KST 시점) | **4,262,000** | KRW/BTC | [1](https://api.upbit.com/v1/candles/minutes/1?market=KRW-BTC&count=1&to=2019-01-01T00:00:00%2B09:00) · [2](https://api.bithumb.com/v1/candles/minutes/1?market=KRW-BTC&count=1&to=2019-01-01%2000:00:00) · [3](https://api.korbit.co.kr/v2/candles?symbol=btc_krw&interval=1D&start=1546182000000&end=1546268399000&limit=1) |
| `btc.krw.close.2019` (2019-12-31) | 8312000 (업비트 API 일봉 '2019-12-31' 종가 = 실제로는 다음해 1/1 09:00 KST 시점) | **8,342,000** | KRW/BTC | [1](https://api.upbit.com/v1/candles/minutes/1?market=KRW-BTC&count=1&to=2020-01-01T00:00:00%2B09:00) · [2](https://api.bithumb.com/v1/candles/minutes/1?market=KRW-BTC&count=1&to=2020-01-01%2000:00:00) · [3](https://api.korbit.co.kr/v2/candles?symbol=btc_krw&interval=1D&start=1577718000000&end=1577804399000&limit=1) |
| `btc.krw.close.2020` (2020-12-31) | 32042000 (업비트 API 일봉 '2020-12-31' 종가 = 실제로는 다음해 1/1 09:00 KST 시점) | **31,612,000** | KRW/BTC | [1](https://api.upbit.com/v1/candles/minutes/1?market=KRW-BTC&count=1&to=2021-01-01T00:00:00%2B09:00) · [2](https://api.bithumb.com/v1/candles/minutes/1?market=KRW-BTC&count=1&to=2021-01-01%2000:00:00) · [3](https://api.korbit.co.kr/v2/candles?symbol=btc_krw&interval=1D&start=1609340400000&end=1609426799000&limit=1) |
| `btc.krw.close.2021` (2021-12-31) | 56784000 (업비트 API 일봉 '2021-12-31' 종가 = 실제로는 다음해 1/1 09:00 KST 시점) | **58,412,000** | KRW/BTC | [1](https://api.upbit.com/v1/candles/minutes/1?market=KRW-BTC&count=1&to=2022-01-01T00:00:00%2B09:00) · [2](https://api.bithumb.com/v1/candles/minutes/1?market=KRW-BTC&count=1&to=2022-01-01%2000:00:00) · [3](https://api.korbit.co.kr/v2/candles?symbol=btc_krw&interval=1D&start=1640876400000&end=1640962799000&limit=1) |
| `btc.krw.close.2022` (2022-12-31) | 21079000 (업비트 API 일봉 '2022-12-31' 종가 = 실제로는 다음해 1/1 09:00 KST 시점) | **21,164,000** | KRW/BTC | [1](https://api.upbit.com/v1/candles/minutes/1?market=KRW-BTC&count=1&to=2023-01-01T00:00:00%2B09:00) · [2](https://api.bithumb.com/v1/candles/minutes/1?market=KRW-BTC&count=1&to=2023-01-01%2000:00:00) · [3](https://api.korbit.co.kr/v2/candles?symbol=btc_krw&interval=1D&start=1672412400000&end=1672498799000&limit=1) |
| `btc.krw.close.2023` (2023-12-31) | 57047000 (업비트 API 일봉 '2023-12-31' 종가 = 실제로는 다음해 1/1 09:00 KST 시점) | **56,901,000** | KRW/BTC | [1](https://api.upbit.com/v1/candles/minutes/1?market=KRW-BTC&count=1&to=2024-01-01T00:00:00%2B09:00) · [2](https://api.bithumb.com/v1/candles/minutes/1?market=KRW-BTC&count=1&to=2024-01-01%2000:00:00) · [3](https://api.korbit.co.kr/v2/candles?symbol=btc_krw&interval=1D&start=1703948400000&end=1704034799000&limit=1) |
| `btc.krw.close.2024` (2024-12-31) | 139257000 (업비트 API 일봉 '2024-12-31' 종가 = 실제로는 다음해 1/1 09:00 KST 시점) | **142,200,000** | KRW/BTC | [1](https://api.upbit.com/v1/candles/minutes/1?market=KRW-BTC&count=1&to=2025-01-01T00:00:00%2B09:00) · [2](https://api.bithumb.com/v1/candles/minutes/1?market=KRW-BTC&count=1&to=2025-01-01%2000:00:00) · [3](https://api.korbit.co.kr/v2/candles?symbol=btc_krw&interval=1D&start=1735570800000&end=1735657199000&limit=1) |
| `btc.krw.close.2025` (2025-12-31) | 128067000 (업비트 API 일봉 '2025-12-31' 종가 = 실제로는 다음해 1/1 09:00 KST 시점) | **128,336,000** | KRW/BTC | [1](https://api.upbit.com/v1/candles/minutes/1?market=KRW-BTC&count=1&to=2026-01-01T00:00:00%2B09:00) · [2](https://api.bithumb.com/v1/candles/minutes/1?market=KRW-BTC&count=1&to=2026-01-01%2000:00:00) · [3](https://api.korbit.co.kr/v2/candles?symbol=btc_krw&interval=1D&start=1767106800000&end=1767193199000&limit=1) |
| `btc.krw.close.2026-09-29` (2026-09-29) | 113,587,000 (업비트 일봉 '9/29' 종가 = 실제로는 9/30 09:00 KST) | **113,263,000** | KRW/BTC | [1](https://api.upbit.com/v1/candles/minutes/1?market=KRW-BTC&count=1&to=2026-09-30T00:00:00%2B09:00) · [2](https://api.bithumb.com/v1/candles/minutes/1?market=KRW-BTC&count=1&to=2026-09-30%2000:00:00) · [3](https://api.korbit.co.kr/v2/candles?symbol=btc_krw&interval=1D&start=1790607600000&end=1790693999000&limit=1) |
| `btc.usd.high.2011` (2011-06-08) | 35.88 (1차 표 '2011 연중 고점') | **31.91** | USD/BTC | [1](https://data.bitcoinity.org/export_data.csv?currency=USD&data_type=price&exchange=mtgox&t=l&timespan=all) · [2](https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD&start_time=2011-06-08&end_time=2011-06-08) · [3](https://api.blockchain.info/charts/market-price?timespan=all&format=json&sampled=false) |
| `btc.event.first_1000.2013-11-27` (2013-11-27) | 2013-11-28 (1차: '한국시간으론 11/28 표기 권장') | **1,000** | USD/BTC (돌파 기준선) | [1](https://www.coindesk.com/markets/2013/11/27/bitcoin-price-hits-1000-after-doubling-in-7-days-what-next) · [2](https://www.cnbc.com/2013/11/27/bitcoin-hits-1000-for-first-time.html) · [3](https://data.bitcoinity.org/export_data.csv?currency=USD&data_type=price&exchange=mtgox&t=l&timespan=all) |
| `btc.usd.low.2020-03-13` (2020-03-13) | 4,106.98 (StatMuse/CMC 저점, Bitstamp 3,850 병기) | **3,850** | USD/BTC | [1](https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=86400&limit=1&start=1584057600) · [2](https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400&start=2020-03-13T00:00:00Z&end=2020-03-13T23:59:59Z) · [3](https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?period1=1410000000&period2=1791000000&interval=1d) |
| `luna.usd.high.2022-04-05` (2022-04-05) | 1차 119.18 → 1차 팩트체크가 119.51로 정정 | **119.18** | USD/LUNA | [1](https://api.coingecko.com/api/v3/coins/terra-luna?localization=false&tickers=false) · [2](https://query1.finance.yahoo.com/v8/finance/chart/LUNC-USD?period1=1648771200&period2=1653004800&interval=1d) · [3](https://api.binance.com/api/v3/klines?symbol=LUNAUSDT&interval=1d&startTime=1648771200000&endTime=1653004800000) |
| `btc.krw.high.2026` (2026-01-15) | 1/14 143,050,000 (업비트 UTC일봉 날짜) | **143,050,000** | KRW/BTC | [1](https://api.upbit.com/v1/candles/minutes/60?market=KRW-BTC&count=200&to=2026-01-18T00:00:00%2B09:00) · [2](https://api.bithumb.com/v1/candles/minutes/60?market=KRW-BTC&count=200&to=2026-01-18%2000:00:00) · [3](https://api.korbit.co.kr/v2/candles?symbol=btc_krw&interval=1D&start=1768402800000&end=1768489199000&limit=1) |
| `btc.usd.low.2026` (2026-07-01) | 2026-06-30, 57,718 (StatMuse 57,747.77) | **57,734.63** | USD/BTC | [1](https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=86400&limit=1&start=1782864000) · [2](https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400&start=2026-07-01T00:00:00Z&end=2026-07-01T23:59:59Z) · [3](https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?period1=1410000000&period2=1791000000&interval=1d) |

#### fx_rates (27건)

| id | 이전(1차) | 이후(2차) | 단위 | 출처 |
|---|---|---|---|---|
| `deposit.1y.avg.2000` (2000) | 7.08 (정기예금 전체 만기) | **7.94** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2001` (2001) | 5.46 (정기예금 전체 만기) | **5.79** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2002` (2002) | 4.71 (정기예금 전체 만기) | **4.95** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2003` (2003) | 4.15 (정기예금 전체 만기) | **4.25** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2004` (2004) | 3.75 (정기예금 전체 만기) | **3.87** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2005` (2005) | 3.57 (정기예금 전체 만기) | **3.72** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2006` (2006) | 4.36 (정기예금 전체 만기) | **4.5** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2007` (2007) | 5.01 (정기예금 전체 만기) | **5.17** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2008` (2008) | 5.67 (정기예금 전체 만기) | **5.87** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2009` (2009) | 3.23 (정기예금 전체 만기) | **3.48** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2010` (2010) | 3.18 (정기예금 전체 만기) | **3.86** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2011` (2011) | 3.69 (정기예금 전체 만기) | **4.15** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2012` (2012) | 3.43 (정기예금 전체 만기) | **3.7** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2013` (2013) | 2.70 (정기예금 전체 만기) | **2.89** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2014` (2014) | 2.42 (정기예금 전체 만기) | **2.54** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2015` (2015) | 1.72 (정기예금 전체 만기) | **1.81** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2016` (2016) | 1.47 (정기예금 전체 만기) | **1.56** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2017` (2017) | 1.51 (정기예금 전체 만기) | **1.67** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2018` (2018) | 1.84 (정기예금 전체 만기) | **2.03** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2019` (2019) | 1.74 (정기예금 전체 만기) | **1.85** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2020` (2020) | 1.04 (정기예금 전체 만기) | **1.16** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2021` (2021) | 1.05 (정기예금 전체 만기) | **1.2** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2022` (2022) | 2.73 (정기예금 전체 만기) | **3.12** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2023` (2023) | 3.68 (정기예금 전체 만기) | **3.84** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2024` (2024) | 3.45 (정기예금 전체 만기) | **3.48** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.avg.2025` (2025) | 2.71 (정기예금 전체 만기) | **2.73** | % p.a. | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |
| `deposit.1y.compound.2000-2025` (2000-2025) | 세전 ×2.31 / 세후 ×2.03 (전체 만기 계열로 계산) | **2.44** | 배 (원금=1) | [1](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/121Y002/A/2000/2025/BEABAA2113) · [2](https://api.worldbank.org/v2/country/KOR/indicator/FR.INR.DPST?format=json&date=2000:2025) |

#### gold_wage_prices (31건)

| id | 이전(1차) | 이후(2차) | 단위 | 출처 |
|---|---|---|---|---|
| `gold.don_krw.close.2000` (2000-12-29) | 41,315 (12월 월평균 기준) | **41,841** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20001220/20001231/0000003) · [3](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) |
| `gold.don_krw.close.2002` (2002-12-31) | 47,481 (12월 월평균 기준) | **49,655** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20021220/20021231/0000003) · [3](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) |
| `gold.don_krw.close.2003` (2003-12-31) | 58,521 (12월 월평균 기준) | **59,851** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20031220/20031231/0000003) · [3](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) |
| `gold.don_krw.close.2004` (2004-12-31) | 55,160 (12월 월평균 기준) | **54,362** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20041220/20041231/0000003) · [3](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) |
| `gold.don_krw.close.2005` (2005-12-29) | 62,202 (12월 월평균 기준) | **62,567** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20051220/20051231/0000003) · [3](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) |
| `gold.don_krw.close.2007` (2007-12-28) | 90,628 (12월 월평균 기준) | **94,098** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20071220/20071231/0000003) · [3](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) |
| `gold.don_krw.close.2008` (2008-12-30) | 123,911 (12월 월평균 기준) | **132,073** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20081220/20081231/0000003) · [3](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) |
| `gold.don_krw.close.2009` (2009-12-30) | 159,352 (12월 월평균 기준) | **152,683** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20091220/20091231/0000003) · [3](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) |
| `gold.don_krw.close.2010` (2010-12-30) | 190,313 (12월 월평균 기준) | **192,297** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20101220/20101231/0000003) · [3](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) |
| `gold.don_krw.close.2011` (2011-12-29) | 227,742 (12월 월평균 기준) | **212,606** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20111220/20111231/0000003) · [3](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) |
| `gold.don_krw.close.2012` (2012-12-28) | 217,495 (12월 월평균 기준) | **213,945** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20121220/20121231/0000003) · [3](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) |
| `gold.don_krw.close.2013` (2013-12-30) | 155,493 (12월 월평균 기준) | **153,266** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20131220/20131231/0000003) · [3](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) |
| `gold.don_krw.close.2015` (2015-12-30) | 152,106 (12월 월평균 기준) | **149,845** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20151220/20151231/0000003) · [3](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) |
| `gold.don_krw.close.2016` (2016-12-29) | 168,467 (12월 월평균 기준) | **166,851** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20161220/20161231/0000003) · [3](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) |
| `gold.don_krw.close.2017` (2017-12-28) | 163,138 (12월 월평균 기준) | **166,623** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20171220/20171231/0000003) · [3](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) |
| `gold.don_krw.close.2018` (2018-12-28) | 168,143 (12월 월평균 기준) | **172,044** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20181220/20181231/0000003) · [3](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) |
| `gold.don_krw.close.2019` (2019-12-30) | 206,205 (12월 월평균 기준) | **211,189** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20191220/20191231/0000003) · [3](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) |
| `gold.don_krw.close.2020` (2020-12-30) | 243,342 (12월 월평균 기준) | **247,219** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20201220/20201231/0000003) · [3](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) |
| `gold.don_krw.close.2021` (2021-12-30) | 256,557 (12월 월평균 기준) | **258,829** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20211220/20211231/0000003) · [3](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) |
| `gold.don_krw.close.2022` (2022-12-29) | 274,114 (12월 월평균 기준) | **276,515** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20221220/20221231/0000003) · [3](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) |
| `gold.don_krw.close.2023` (2023-12-28) | 314,614 (12월 월평균 기준) | **322,751** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20231220/20231231/0000003) · [3](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) |
| `gold.don_krw.close.2024` (2024-12-30) | 470,106 (12월 월평균 기준) | **463,200** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20241220/20241231/0000003) · [3](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) |
| `gold.don_krw.close.2025` (2025-12-30) | 747,583 (12월 월평균 기준) | **757,785** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20251220/20251231/0000003) · [3](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) |
| `gold.don_krw.latest.2026` (2026-09-29) | 약 676,700 (09-28 현물 $4,136.81 × 1,356.7) | **681,011** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20260920/20260930/0000003) · [3](https://api.stock.naver.com/marketindex/metals/M04020000/prices?page=1&pageSize=60 (KRX 금시장 1g 종가, 2014-03-24~)) |
| `gold.usd_oz.peak.2011` (2011-09-05) | 2011-08~09 고점(값 미기재), 1돈 이론값 227,742를 고점처럼 서술 | **1,895** | USD/oz (LBMA PM 고시가) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=946684800&period2=1790000000&interval=1d) · [3](https://raw.githubusercontent.com/datasets/gold-prices/main/data/monthly.csv) |
| `gold.don_krw.peak.2011` (2011-09-20) | 227,742 (2011년 12월 월평균 기준값을 '고점'으로 사용) | **249,084** | 원/돈(3.75g) | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20110901/20110930/0000003) · [3](https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXKOUS) |
| `gold.usd_oz.peak_intraday.2026-01` (2026-01-29) | 2026-01-28 장중 약 $5,600 (피드별 $5,589~5,608, 시간대 미표기) | **5,600** | USD/oz (약, 장중) | [1](https://www.cbsnews.com/news/highest-gold-price-in-history-how-its-changed-from-2025-to-2026/) · [2](https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=1769472000&period2=1769817600&interval=1h) · [3](https://prices.lbma.org.uk/json/gold_pm.json) |
| `gold.multiple.2000_to_2026` (2026-09-29) | 약 16.5배 (41,315 → 680,000) | **16.28** | 배 | [1](https://prices.lbma.org.uk/json/gold_pm.json) · [2](https://ecos.bok.or.kr/api/StatisticSearch/sample/json/kr/1/10/731Y003/D/20001220/20001231/0000003) · [3](https://api.stock.naver.com/marketindex/metals/M04020000/prices?page=1&pageSize=60 (KRX 금시장 1g 종가, 2014-03-24~)) |
| `price.bus.seoul.2000_h2` (2000-07-01) | 500~600원 (자료마다 다름, low) | **600** | 원 | [1](https://news.seoul.go.kr/traffic/archives/345) · [2](https://data.si.re.kr/data-seoul/지표로-본-서울-변천-2010/346) · [3](https://www.seoul.co.kr/news/newsView.php?id=20040812009004) |
| `price.jajangmyeon.seoul.2000` (2000-12-31) | 2,742 | **2,700** | 원(약) | [1](https://economist.co.kr/article/view/ecn202202260026) · [2](https://data.si.re.kr/data-seoul/지표로-본-서울-변천-2010/346) · [3](https://www.seoul.co.kr/news/newsView.php?id=20040812009004) |
| `price.jajangmyeon.seoul.2026` (2026-08-31) | 약 7,200~7,650 (7,230/7,551/7,654, 권장 '약 7,500원') | **7,731** | 원 | [1](https://www.price.go.kr/tprice/portal/servicepriceinfo/dineoutprice/dineOutPriceList.do) · [2](https://www.dhilbo.co.kr/news/articleView.html?idxno=1898) · [3](https://view.asiae.co.kr/article/2026092509431053400) |

#### real_estate (6건)

| id | 이전(1차) | 이후(2차) | 단위 | 출처 |
|---|---|---|---|---|
| `eunma76.2001-12` (2001-12-31) | 2.5억 ("2억원대" 중간값 가정) | **37,000** | 만원/호 | [1](http://news.bizwatch.co.kr/article/real_estate/2018/04/16/0020) · [2](https://n.news.naver.com/mnews/article/015/0000475515) · [3](https://n.news.naver.com/mnews/article/001/0000263342) |
| `eunma76.2002-09` (2002-12-31) | 4.0억 (2002, 32평 3.8~4.15억 M) | **48,000** | 만원/호 | [1](https://n.news.naver.com/mnews/article/014/0000045076) · [2](https://n.news.naver.com/mnews/article/015/0000578410) · [3](https://n.news.naver.com/mnews/article/008/0000242647) |
| `ltv.2008-06.relax` (2008-06-11) | 2008-06 LTV 70%로 완화 (서울 포함처럼 기재) | **70** | % (LTV 상한, 지방 비투기지역 미분양 주택 한정) | [1](https://www.seoul.co.kr/news/economy/estate/2010/08/29/20100829800014) · [2](https://www.khan.co.kr/article/201706060600001) · [3](https://n.news.naver.com/mnews/article/003/0002136854) |
| `mortgage_ban.2019-12-16` (2019-12-17) | 2019-12-16 (15억 초과 주담대 금지) | **1,500,000,000** | 원 (금지 기준 시가) | [1](https://www.lawtimes.co.kr/news/179564) · [2](https://www.hankookilbo.com/news/article/201912161245037086) · [3](https://imnews.imbc.com/news/2023/econo/article/6469947_36140.html) |
| `mortgage_ban_lift.2022-12-01` (2022-12-01) | 2023 15억 초과 금지 해제(LTV 50%) | **50** | % (규제지역 무주택·처분조건부 1주택 LTV) | [1](https://www.korea.kr/news/policyNewsView.do?newsId=148908439) · [2](https://www.hankyung.com/article/2022112771047) · [3](https://www.ajunews.com/view/20221110140445575) |
| `land_permit.2025-09-17.extend` (2025-09-17) | '2026-09-17 연장' [의심] | **20,261,231** | 만료일(YYYYMMDD) | [1](https://www.hankyung.com/article/202509179925i) · [2](https://www.mt.co.kr/estate/2025/09/17/2025091716040920475) · [3](https://www.news1.kr/realestate/general/5915625) |

#### tax_gamble (3건)

| id | 이전(1차) | 이후(2차) | 단위 | 출처 |
|---|---|---|---|---|
| `gift.report_credit.2000_2016` (2000-01-01) | 자진신고 3% 공제(M, 기간 미표기 → 게임 전 기간 3%로 오독될 위험) | **10** | % of 산출세액 | [1](https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=52170) · [2](https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=177183) · [3](https://n.news.naver.com/mnews/article/014/0000074186) |
| `sectax.2019` (2019-05-30) | 2019-06 0.25% | **0.25** | % of 매도금액 (코스피·코스닥 동일 총부담) | [1](https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=208731) · [2](https://n.news.naver.com/mnews/article/014/0004234596) · [3](https://n.news.naver.com/mnews/article/016/0001539447) |
| `re.cgt.1house.threshold.2008` (2008-10-07) | ~2021-12-07 9억 (9억 시작 시점 미표기) | **900,000,000** | KRW 양도 실거래가 | [1](https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=89130) · [2](https://n.news.naver.com/mnews/article/001/0002286656) · [3](https://n.news.naver.com/mnews/article/008/0002038943) |

#### rules_timeline (7건)

| id | 이전(1차) | 이후(2차) | 단위 | 출처 |
|---|---|---|---|---|
| `crypto.korbit.launch` (2013-07-05) | 2013-04 베타 / 2013-07 법인 | **20,130,705** | YYYYMMDD | [1](https://www.fntimes.com/html/view.php?ud=2023070319163799769249a1ae63_18) · [2](https://www.mt.co.kr/stock/2023/07/03/2023070309232512253) · [3](https://www.etnews.com/20250807000193) |
| `crypto.xcoin.open` (2013-12-31) | 2014 (XCOIN 설립) | **20,131,231** | YYYYMMDD | [1](http://www.boannews.com/news/articleView.html?idxno=39155) · [2](https://www.mt.co.kr/stock/2023/12/06/2023120609464297280) · [3](https://ko.wikipedia.org/wiki/빗썸) |
| `crypto.coinone.open` (2014-08) | 2014-08-25 | **201,408** | YYYYMM | [1](http://news.bizwatch.co.kr/article/mobile/2018/02/20/0019) · [2](https://namu.wiki/w/코인원) · [3](https://www.paxnetnews.com/articles/53413) |
| `overseas_stock.fractional_first` (2018-10) | 2020-08 소수점 거래(미니스탁) — 최초처럼 서술 | **201,810** | YYYYMM | [1](https://view.asiae.co.kr/article/2018101509555826483) · [2](https://www.seoul.co.kr/news/economy/2018/10/30/20181030035003) · [3](http://www.kbanker.co.kr/news/articleView.html?idxno=75627) |
| `army.service_18m_from` (2020-06-15) | 2020-06-02 입대자부터 18개월 (나무위키 단일) | **20,200,615** | YYYYMMDD(입대일) | [1](https://kookbang.dema.mil.kr/newsWeb/20180730/5/BBSMSTR_000000010205/view.do) · [2](https://www.seoul.co.kr/news/politics/2018/07/27/20180727800045) · [3](http://www.kookje.co.kr/news2011/asp/newsbody.asp?code=0100&key=20180728.99099013733) |
| `csat.2012.applicants` (2011-11-10) | 693,631 | **693,634** | 명 | [1](https://www.seoul.co.kr/news/society/2011/11/10/20111110800016) · [2](https://namu.wiki/w/2012학년도%20대학수학능력시험) · [3](http://www.hankyung.com/news/app/newsview.php?aid=2011090940391) |
| `labor.min_working_age` (2005-07-01) | 만 15세 알바 가능한 2008년(최저임금 3,770원) | **15** | 만 나이(세, 단 중학생은 18세 미만이면 불가) | [1](https://www.law.go.kr/DRF/lawService.do?OC=test&target=law&type=XML&MST=67778) · [2](https://www.law.go.kr/DRF/lawService.do?OC=test&target=law&type=XML&MST=85973) · [3](https://www.easylaw.go.kr/CSP/CnpClsMain.laf?csmSeq=1381&ccfNo=1&cciNo=1&cnpClsNo=1) |

---

## 4. verified지만 게임 값이 바뀐 항목 (기준 통일)

판정은 `verified`(1차 값과 ±1% 이내)지만 BTC USD 기준을 Bitstamp로 통일하면서 표에 넣을 값을 바꾼 항목이다. `rewind-research.md` §2·§3에는 새 값을 반영했다.

| id | 1차 | 2차(게임값) | 차이 |
|---|---:|---:|---:|
| `btc.usd.close.2012` | 13.53 | 13.51 (Mt.Gox) | -0.1% |
| `btc.usd.close.2014` | 320.19 | 321.0 | +0.3% |
| `btc.usd.close.2015` | 430.57 | 430.89 | +0.1% |
| `btc.usd.close.2016` | 963.74 | 966.3 | +0.3% |
| `btc.usd.close.2019` | 7,193.60 | 7,168.36 | -0.4% |
| `btc.usd.close.2020` | 29,001.72 | 28,992.79 | -0.0% |
| `btc.usd.close.2021` | 46,306.45 | 46,214.37 | -0.2% |
| `btc.usd.close.2022` | 16,547.50 | 16,528.0 | -0.1% |
| `btc.usd.close.2023` | 42,265.19 | 42,258.0 | -0.0% |
| `btc.usd.close.2024` | 93,429.20 | 93,381.0 | -0.1% |
| `btc.usd.close.2025` | 87,508.83 | 87,496.0 | -0.0% |
| `btc.usd.close.2026-09-28` | 83,502.61 | 83,461.65 (09-29 종가 83,629.41 신규) | -0.0% |
| `btc.usd.high.2017-12-17` | 약 19,783 (CMC) | 19,666 | -0.6% |
| `btc.usd.high.2021-11-10` | 68,990.90 | 69,000 | +0.0% |
| `btc.usd.ath.2025-10-06` | 126,198.07 | 126,272 | +0.1% |
| `btc.usd.high.2026-01-14` | 97,694 | 97,939 | +0.3% |
| `btc.event.mtgox_first_trade` | $0.05 (07-18) | $0.04951 (07-17 UTC = 07-18 KST) | 반올림 |
| `btc.usd.close.2010` | 0.30 (미검증) | 0.30 (verified: CoinMetrics·blockchain.info·bitcoinity, 모두 Mt.Gox 파생) | 판정만 변경 |
| `eunma76.2000-12` | 2.2억 (L, 원문 미확인) | 2.2억 (verified: 이데일리 2010, 비즈워치 2018. 공통 원천 가능성 있음) | 판정만 변경 |
| `eunma76.2003-12` | 6.0억 | 6.05억 (KB 2004-01 대용) | +0.8% |
| `gold.usd_return.2025` | 약 +65% | +67.4% (LBMA PM), COMEX 기준 +64.4% | 범위 |

---

## 5. unverifiable 31건과 게임 대체안

| 배치 | id | 값 | 막힌 이유 | 게임 대체안 |
|---|---|---|---|---|
| fx_rates | `deposit.1y.2026-07` | 3.49% | 한은 ECOS와 한은 보도자료(3.48, 잠정)뿐이라 같은 기관이다 | 2026년 예금 이자는 1~7월 평균 **약 3.09%**를 "한은 단일·잠정"으로 표기해 쓰거나, 2025 연간 2.73%를 적용한다 |
| gold | `gold.don_krw.retail_buy.2026-09-29` | 792,000원 | 한국금거래소 페이지가 JS 렌더링이라 원문 확인 실패, 2차 출처 없음 | 살 때 = KRX 680,475원 × 1.10(부가세) ≈ **749,000원**. 또는 "75만~80만원" 범위로 표기 |
| gold | `gold.don_krw.retail.2011-08-04` | 223,300원 | 독립 출처 없음. 국제 고점(09-05) 이전 날짜 | `gold.don_krw.peak.2011`(2011-09-20 이론 249,084원)을 쓴다 |
| gold | `price.soju.2000` | — | 이코노미스트 1곳뿐, 출고가·소매가 구분 불가 | "천 원도 안 하던 소주" 같은 체감 표현만 쓴다 |
| gold | `price.soju.restaurant.2026` | — | 2026 통계 없음 | "식당에선 5~6천원" 체감 대사만 쓴다 |
| gold | `allowance.elementary.2000` | — | 2000~2001 당시 조사 없음 | "월 용돈 5천원 안팎"을 당시 체감으로 쓴다. 7세 종잣돈(세뱃돈 3만~10만)은 설계 추정이므로 UI에 사실처럼 표기하지 않는다 |
| gold | `allowance.elementary.2002` | 5천원 이하 41.4% | 부산일보 단일(창원 3~4학년) | 분위기 참고용으로만 쓴다 |
| gold | `sebaetdon.elementary.2013_2023` | 2023 3만원 | 경향 단일, 2000년 값 아님 | 참고용. 2000년 세뱃돈 수치는 쓰지 않는다 |
| real_estate | `seoul_apt_avg_price.2000-12`~`2007-12` (8건) | 2.13~5.09억 | KB 평균가 통계는 2008-12부터 있다. 역산 추정치다 | **"(추정)" 표기를 유지**하거나 가격 대신 KB 지수(검증됨)로 등락만 표현한다 |
| real_estate | `seoul_apt_avg_price.2008-12`, `2009-12`, `2010-12`, `2011-12`, `2015-12`, `2018-12`, `2019-12`, `2023-12` (8건) | 5.25/5.39/5.27/5.39/5.25/8.16/8.60/12.00억 | KB 원천 API 직접 조회값이지만 같은 달 값을 인용한 독립 보도가 없다 | **KB 원천 API 값을 그대로 쓴다**(원천값이라 전사 오류 위험이 낮다). 나머지 연도는 verified |
| real_estate | `seoul_apt_real_tx_index.2008.peak_to_trough` | -18.4% | 지수 개편·소급으로 고점 월과 낙폭이 다르다(현행 -18.4%, 구 기준 -15.1%) | 연간 **-10.21%**(검증)를 쓰거나 "고점 대비 약 -15~18%" 범위로 쓴다 |
| real_estate | `seoul_apt_real_tx_index.2022.peak_to_trough` | -24.3% | 계산값이며 제시한 독립 보도가 없다 | 연간 **-22.09%**(검증)를 쓰거나 "-24.3%(부동산원 지수 계산)"으로 명시한다 |
| tax_gamble | `toto.wc2002.spain_score` | 27.44배 | 머니투데이 단일 | 게임에서 빼거나 "약 27배"로만 쓴다. 스페셜 15회 45.07배는 검증됐다 |
| tax_gamble | `toto.wc2002.germany` | — | 결과 배당 기사 없음 | 이 경기 베팅은 제외하거나 "배당 비공개"로 처리한다 |
| tax_gamble | `toto.wc2002.turkey` | 32.77배 | 연합 단일(내부 산술은 맞음) | "약 32배"로 쓰거나 제외한다 |
| rules_timeline | `crypto.minor_pre2018` | — | 2018년 이전 거래소 미성년 약관의 독립 출처 없음 | **국내 원화 코인은 2013-09-03 이후 성년 본인 명의로만** 허용한다. 2010~2012 Mt.Gox 경로는 "부모/어른 명의" 이벤트로 처리한다 |
| rules_timeline | `cyworld.minihompy_launch` | — | 영문 위키 2002-09-09와 국내 언론 다수 "2001년"이 충돌한다 | "2001~2002년 등장, 중학생 시절(2006~2008) 전성기"로 쓴다 |

---

## 6. `docs/planning/rewind-research.md` 반영 범위

- **반영함**: §2 연말 시세표(2-A·2-B와 표 읽기 메모), §3 급등락 이벤트표, §4 현실 제약(연령·계좌·세금·대출·토허제). 바뀐 칸과 행에는 `[2차]` 표시를 달았다. 각 절 머리에는 "2차 감사 반영" 안내를 넣었다.
- **반영하지 않음(작업 범위 밖, 후속 필요)**: §0, §1 연표, §6 미확인 목록에는 아직 1차 값이 남아 있다. 주요 잔존 항목은 아래와 같다.
  - §0-6: "BTC 2025-10 $126k → 9/28 $83.5k"는 ATH 126,272 / 9/29 83,629로 바꾼다.
  - §1 2008: "15세라 알바가 가능하다"는 오류다. 2009-03 고1부터 가능하다.
  - §1 2002: "은마는 2억대 → 약 4억"은 3.7억 → 4.8억(9월 고점 약 5.0억)으로 바꾼다.
  - §1 2011: "BTC 연중 최고 35.88"은 31.91로, "금 1돈 이론값 연말 227,742"는 212,606(연말 종가 기준)으로, 금 고점은 2011-09로 바꾼다.
  - §1 2013: "04월 코빗 베타"를 삭제한다. 07-05 창립, 09-03 첫 거래다.
  - §1 2014: "빗썸 전신 XCOIN 설립 08-25"는 2013-12-31 오픈으로 바꾼다.
  - §1 2017: 업비트 연말 19,280,000은 18,713,000으로 바꾼다.
  - §1 2020: 소수점 거래 "출시"는 "미니스탁 출시(최초는 2018-10)"로 바꾼다.
  - §1 2022: LUNA 고점을 04-05 $119.18로 바꾼다.
  - §1 2023: "15억 초과 주담대 금지 해제"는 2022-12-01로 옮긴다.
  - §1 2026: BTC 고점은 01-14 UTC / 01-15 KST, USD 저점은 07-01, 엔딩 업비트 값은 113,263,000으로 바꾼다.
  - §4-1 병역·§6-4 "2020-06-02"는 2020-06-15로 바꾼다(§4는 반영함).
  - §6 목록의 상당수가 이번 감사로 해소됐다(증여공제 2000~2004, 실명제 날짜, 증권거래세 2026, 해외주식 양도세 도입, 갤럭시S, 10·15 한도, 토허제 14개 단지 등). §6은 이 보고서 §5로 대체한다.
