/**
 * 인생 2회차 — 시장 데이터 (자동 생성 · 손으로 고치지 말 것)
 *
 * 원천: docs/research/rewind/audit/verified-data.json (2차 감사, 값마다 독립 출처 2곳 이상)
 * 생성: scratchpad gen-market.py — status 가 verified/corrected 인 값만 사용. src 의 "audit:<id>" 로 출처 추적.
 * 게임 단순화(감사 대상 아님): 매매 수수료, 대출 가산금리(기준금리+1.5%p), 2002년 LTV 도입 전 주담대 0,
 *   2013-08 이후 취득세 3%(부가세 제외), 1주택 양도세 비과세 가정, 이자소득세 미반영.
 * 달러 자산의 사건 시세: 같은 날 환율이 있으면 정확 환산, 없으면 그해 연말 환율(estimated), 2008~2009 사건은 제외.
 * 생성 시각: 2026-09-30 · 사건 62개
 */
import type { MarketData } from './types';

export const MARKET: MarketData = {
  years: {
    "2000": {
      year: 2000,
      fx: 1264.5,
      depositRate: 7.94,
      baseRate: 5.25,
      prices: {
        samsung: {
          krw: 3160,
          src: "audit:samsung.close.2000"
        },
        aapl: {
          krw: 335.8512,
          usd: 0.2656,
          src: "audit:aapl.close.2000×usdkrw.close.2000"
        },
        nvda: {
          krw: 172.6043,
          usd: 0.1365,
          src: "audit:nvda.close.2000×usdkrw.close.2000"
        },
        gold: {
          krw: 41841,
          src: "audit:gold.don_krw.close.2000 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1264.5,
          src: "audit:usdkrw.close.2000"
        },
        apt: {
          krw: 220000000,
          src: "audit:eunma76.2000-12"
        }
      }
    },
    "2001": {
      year: 2001,
      fx: 1313.5,
      depositRate: 5.79,
      baseRate: 4.0,
      prices: {
        samsung: {
          krw: 5580,
          src: "audit:samsung.close.2001"
        },
        aapl: {
          krw: 513.7098,
          usd: 0.3911,
          src: "audit:aapl.close.2001×usdkrw.close.2001"
        },
        nvda: {
          krw: 732.2763,
          usd: 0.5575,
          src: "audit:nvda.close.2001×usdkrw.close.2001"
        },
        gold: {
          krw: 43787,
          src: "audit:gold.don_krw.close.2001 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1313.5,
          src: "audit:usdkrw.close.2001"
        },
        apt: {
          krw: 370000000,
          src: "audit:eunma76.2001-12"
        }
      }
    },
    "2002": {
      year: 2002,
      fx: 1186.2,
      depositRate: 4.95,
      baseRate: 4.25,
      prices: {
        samsung: {
          krw: 6280,
          src: "audit:samsung.close.2002"
        },
        aapl: {
          krw: 303.5486,
          usd: 0.2559,
          src: "audit:aapl.close.2002×usdkrw.close.2002"
        },
        nvda: {
          krw: 113.7566,
          usd: 0.0959,
          src: "audit:nvda.close.2002×usdkrw.close.2002"
        },
        gold: {
          krw: 49655,
          src: "audit:gold.don_krw.close.2002 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1186.2,
          src: "audit:usdkrw.close.2002"
        },
        apt: {
          krw: 480000000,
          src: "audit:eunma76.2002-09"
        }
      }
    },
    "2003": {
      year: 2003,
      fx: 1192.6,
      depositRate: 4.25,
      baseRate: 3.75,
      prices: {
        samsung: {
          krw: 9020,
          src: "audit:samsung.close.2003"
        },
        aapl: {
          krw: 455.0962,
          usd: 0.3816,
          src: "audit:aapl.close.2003×usdkrw.close.2003"
        },
        nvda: {
          krw: 230.5296,
          usd: 0.1933,
          src: "audit:nvda.close.2003×usdkrw.close.2003"
        },
        gold: {
          krw: 59851,
          src: "audit:gold.don_krw.close.2003 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1192.6,
          src: "audit:usdkrw.close.2003"
        },
        apt: {
          krw: 605000000,
          src: "audit:eunma76.2003-12"
        }
      }
    },
    "2004": {
      year: 2004,
      fx: 1035.1,
      depositRate: 3.87,
      baseRate: 3.25,
      prices: {
        samsung: {
          krw: 9010,
          src: "audit:samsung.close.2004"
        },
        aapl: {
          krw: 1190.365,
          usd: 1.15,
          src: "audit:aapl.close.2004×usdkrw.close.2004"
        },
        nvda: {
          krw: 203.1901,
          usd: 0.1963,
          src: "audit:nvda.close.2004×usdkrw.close.2004"
        },
        gold: {
          krw: 54362,
          src: "audit:gold.don_krw.close.2004 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1035.1,
          src: "audit:usdkrw.close.2004"
        },
        apt: {
          krw: 575000000,
          src: "audit:eunma76.kb.2004-12"
        }
      }
    },
    "2005": {
      year: 2005,
      fx: 1011.6,
      depositRate: 3.72,
      baseRate: 3.75,
      prices: {
        samsung: {
          krw: 13180,
          src: "audit:samsung.close.2005"
        },
        aapl: {
          krw: 2597.283,
          usd: 2.5675,
          src: "audit:aapl.close.2005×usdkrw.close.2005"
        },
        nvda: {
          krw: 308.2345,
          usd: 0.3047,
          src: "audit:nvda.close.2005×usdkrw.close.2005"
        },
        gold: {
          krw: 62567,
          src: "audit:gold.don_krw.close.2005 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1011.6,
          src: "audit:usdkrw.close.2005"
        },
        apt: {
          krw: 780000000,
          src: "audit:eunma76.kb.2005-12"
        }
      }
    },
    "2006": {
      year: 2006,
      fx: 929.8,
      depositRate: 4.5,
      baseRate: 4.5,
      prices: {
        samsung: {
          krw: 12260,
          src: "audit:samsung.close.2006"
        },
        aapl: {
          krw: 2817.294,
          usd: 3.03,
          src: "audit:aapl.close.2006×usdkrw.close.2006"
        },
        nvda: {
          krw: 573.5006,
          usd: 0.6168,
          src: "audit:nvda.close.2006×usdkrw.close.2006"
        },
        gold: {
          krw: 70848,
          src: "audit:gold.don_krw.close.2006 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 929.8,
          src: "audit:usdkrw.close.2006"
        },
        apt: {
          krw: 1125000000,
          src: "audit:eunma76.kb.2006-12"
        }
      }
    },
    "2007": {
      year: 2007,
      fx: 936.1,
      depositRate: 5.17,
      baseRate: 5.0,
      prices: {
        samsung: {
          krw: 11120,
          src: "audit:samsung.close.2007"
        },
        aapl: {
          krw: 6622.2522,
          usd: 7.0743,
          src: "audit:aapl.close.2007×usdkrw.close.2007"
        },
        nvda: {
          krw: 796.1531,
          usd: 0.8505,
          src: "audit:nvda.close.2007×usdkrw.close.2007"
        },
        gold: {
          krw: 94098,
          src: "audit:gold.don_krw.close.2007 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 936.1,
          src: "audit:usdkrw.close.2007"
        },
        apt: {
          krw: 1000000000,
          src: "audit:eunma76.kb.2007-12"
        }
      }
    },
    "2008": {
      year: 2008,
      fx: 1259.5,
      depositRate: 5.87,
      baseRate: 3.0,
      prices: {
        samsung: {
          krw: 9020,
          src: "audit:samsung.close.2008"
        },
        aapl: {
          krw: 3839.2079,
          usd: 3.0482,
          src: "audit:aapl.close.2008×usdkrw.close.2008"
        },
        nvda: {
          krw: 254.0411,
          usd: 0.2017,
          src: "audit:nvda.close.2008×usdkrw.close.2008"
        },
        gold: {
          krw: 132073,
          src: "audit:gold.don_krw.close.2008 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1259.5,
          src: "audit:usdkrw.close.2008"
        },
        apt: {
          krw: 805000000,
          src: "audit:eunma76.kb.2008-12"
        }
      }
    },
    "2009": {
      year: 2009,
      fx: 1164.5,
      depositRate: 3.48,
      baseRate: 2.0,
      prices: {
        samsung: {
          krw: 15980,
          src: "audit:samsung.close.2009"
        },
        aapl: {
          krw: 8764.1434,
          usd: 7.5261,
          src: "audit:aapl.close.2009×usdkrw.close.2009"
        },
        nvda: {
          krw: 543.8215,
          usd: 0.467,
          src: "audit:nvda.close.2009×usdkrw.close.2009"
        },
        gold: {
          krw: 152683,
          src: "audit:gold.don_krw.close.2009 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1164.5,
          src: "audit:usdkrw.close.2009"
        },
        apt: {
          krw: 1000000000,
          src: "audit:eunma76.kb.2009-12"
        }
      }
    },
    "2010": {
      year: 2010,
      fx: 1134.8,
      depositRate: 3.86,
      baseRate: 2.5,
      prices: {
        samsung: {
          krw: 18980,
          src: "audit:samsung.close.2010"
        },
        aapl: {
          krw: 13072.896,
          usd: 11.52,
          src: "audit:aapl.close.2010×usdkrw.close.2010"
        },
        nvda: {
          krw: 436.898,
          usd: 0.385,
          src: "audit:nvda.close.2010×usdkrw.close.2010"
        },
        tsla: {
          krw: 2014.6104,
          usd: 1.7753,
          src: "audit:tsla.close.2010×usdkrw.close.2010"
        },
        btc: {
          krw: 340.44,
          usd: 0.3,
          estimated: true,
          src: "audit:btc.usd.close.2010×usdkrw.close.2010 (국내 원화 시세 이전 — 환산)"
        },
        gold: {
          krw: 192297,
          src: "audit:gold.don_krw.close.2010 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1134.8,
          src: "audit:usdkrw.close.2010"
        },
        apt: {
          krw: 925000000,
          src: "audit:eunma76.kb.2010-12"
        }
      }
    },
    "2011": {
      year: 2011,
      fx: 1151.8,
      depositRate: 4.15,
      baseRate: 3.25,
      prices: {
        samsung: {
          krw: 21160,
          src: "audit:samsung.close.2011"
        },
        aapl: {
          krw: 16659.9807,
          usd: 14.4643,
          src: "audit:aapl.close.2011×usdkrw.close.2011"
        },
        nvda: {
          krw: 399.0987,
          usd: 0.3465,
          src: "audit:nvda.close.2011×usdkrw.close.2011"
        },
        tsla: {
          krw: 2193.0272,
          usd: 1.904,
          src: "audit:tsla.close.2011×usdkrw.close.2011"
        },
        btc: {
          krw: 5436.496,
          usd: 4.72,
          estimated: true,
          src: "audit:btc.usd.close.2011×usdkrw.close.2011 (국내 원화 시세 이전 — 환산)"
        },
        gold: {
          krw: 212606,
          src: "audit:gold.don_krw.close.2011 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1151.8,
          src: "audit:usdkrw.close.2011"
        },
        apt: {
          krw: 885000000,
          src: "audit:eunma76.kb.2011-12"
        }
      }
    },
    "2012": {
      year: 2012,
      fx: 1070.6,
      depositRate: 3.7,
      baseRate: 2.75,
      prices: {
        samsung: {
          krw: 30440,
          src: "audit:samsung.close.2012"
        },
        aapl: {
          krw: 20347.9307,
          usd: 19.0061,
          src: "audit:aapl.close.2012×usdkrw.close.2012"
        },
        nvda: {
          krw: 328.1389,
          usd: 0.3065,
          src: "audit:nvda.close.2012×usdkrw.close.2012"
        },
        tsla: {
          krw: 2417.4148,
          usd: 2.258,
          src: "audit:tsla.close.2012×usdkrw.close.2012"
        },
        btc: {
          krw: 14463.806,
          usd: 13.51,
          estimated: true,
          src: "audit:btc.usd.close.2012×usdkrw.close.2012 (국내 원화 시세 이전 — 환산)"
        },
        gold: {
          krw: 213945,
          src: "audit:gold.don_krw.close.2012 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1070.6,
          src: "audit:usdkrw.close.2012"
        },
        apt: {
          krw: 740000000,
          src: "audit:eunma76.kb.2012-12"
        }
      }
    },
    "2013": {
      year: 2013,
      fx: 1055.4,
      depositRate: 2.89,
      baseRate: 2.5,
      prices: {
        samsung: {
          krw: 27440,
          src: "audit:samsung.close.2013"
        },
        aapl: {
          krw: 21146.4166,
          usd: 20.0364,
          src: "audit:aapl.close.2013×usdkrw.close.2013"
        },
        nvda: {
          krw: 422.6877,
          usd: 0.4005,
          src: "audit:nvda.close.2013×usdkrw.close.2013"
        },
        tsla: {
          krw: 10584.29,
          usd: 10.0287,
          src: "audit:tsla.close.2013×usdkrw.close.2013"
        },
        btc: {
          krw: 764002,
          src: "audit:btc.krw.close.2013"
        },
        gold: {
          krw: 153266,
          src: "audit:gold.don_krw.close.2013 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1055.4,
          src: "audit:usdkrw.close.2013"
        },
        apt: {
          krw: 782500000,
          src: "audit:eunma76.kb.2013-12"
        }
      }
    },
    "2014": {
      year: 2014,
      fx: 1099.3,
      depositRate: 2.54,
      baseRate: 2.0,
      prices: {
        samsung: {
          krw: 26540,
          src: "audit:samsung.close.2014"
        },
        aapl: {
          krw: 30335.1835,
          usd: 27.595,
          src: "audit:aapl.close.2014×usdkrw.close.2014"
        },
        nvda: {
          krw: 551.0791,
          usd: 0.5013,
          src: "audit:nvda.close.2014×usdkrw.close.2014"
        },
        tsla: {
          krw: 16299.6509,
          usd: 14.8273,
          src: "audit:tsla.close.2014×usdkrw.close.2014"
        },
        btc: {
          krw: 338000,
          src: "audit:btc.krw.close.2014"
        },
        gold: {
          krw: 159840,
          src: "audit:gold.don_krw.close.2014 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1099.3,
          src: "audit:usdkrw.close.2014"
        },
        apt: {
          krw: 877500000,
          src: "audit:eunma76.kb.2014-12"
        }
      }
    },
    "2015": {
      year: 2015,
      fx: 1172.5,
      depositRate: 1.81,
      baseRate: 1.5,
      prices: {
        samsung: {
          krw: 25200,
          src: "audit:samsung.close.2015"
        },
        aapl: {
          krw: 30854.3375,
          usd: 26.315,
          src: "audit:aapl.close.2015×usdkrw.close.2015"
        },
        nvda: {
          krw: 966.14,
          usd: 0.824,
          src: "audit:nvda.close.2015×usdkrw.close.2015"
        },
        tsla: {
          krw: 18760.8207,
          usd: 16.0007,
          src: "audit:tsla.close.2015×usdkrw.close.2015"
        },
        btc: {
          krw: 509900,
          src: "audit:btc.krw.close.2015"
        },
        gold: {
          krw: 149845,
          src: "audit:gold.don_krw.close.2015 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1172.5,
          src: "audit:usdkrw.close.2015"
        },
        apt: {
          krw: 977500000,
          src: "audit:eunma76.kb.2015-12"
        }
      }
    },
    "2016": {
      year: 2016,
      fx: 1207.7,
      depositRate: 1.56,
      baseRate: 1.25,
      prices: {
        samsung: {
          krw: 36040,
          src: "audit:samsung.close.2016"
        },
        aapl: {
          krw: 34968.9535,
          usd: 28.955,
          src: "audit:aapl.close.2016×usdkrw.close.2016"
        },
        nvda: {
          krw: 3222.7474,
          usd: 2.6685,
          src: "audit:nvda.close.2016×usdkrw.close.2016"
        },
        tsla: {
          krw: 17204.8942,
          usd: 14.246,
          src: "audit:tsla.close.2016×usdkrw.close.2016"
        },
        btc: {
          krw: 1192500,
          src: "audit:btc.krw.close.2016"
        },
        gold: {
          krw: 166851,
          src: "audit:gold.don_krw.close.2016 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1207.7,
          src: "audit:usdkrw.close.2016"
        },
        apt: {
          krw: 1137500000,
          src: "audit:eunma76.kb.2016-12"
        }
      }
    },
    "2017": {
      year: 2017,
      fx: 1070.5,
      depositRate: 1.67,
      baseRate: 1.5,
      prices: {
        samsung: {
          krw: 50960,
          src: "audit:samsung.close.2017"
        },
        aapl: {
          krw: 45290.1787,
          usd: 42.3075,
          src: "audit:aapl.close.2017×usdkrw.close.2017"
        },
        nvda: {
          krw: 5178.5438,
          usd: 4.8375,
          src: "audit:nvda.close.2017×usdkrw.close.2017"
        },
        tsla: {
          krw: 22220.0473,
          usd: 20.7567,
          src: "audit:tsla.close.2017×usdkrw.close.2017"
        },
        btc: {
          krw: 18713000,
          src: "audit:btc.krw.close.2017"
        },
        gold: {
          krw: 166623,
          src: "audit:gold.don_krw.close.2017 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1070.5,
          src: "audit:usdkrw.close.2017"
        },
        apt: {
          krw: 1465000000,
          src: "audit:eunma76.kb.2017-12"
        }
      }
    },
    "2018": {
      year: 2018,
      fx: 1115.7,
      depositRate: 2.03,
      baseRate: 1.75,
      prices: {
        samsung: {
          krw: 38700,
          src: "audit:samsung.close.2018"
        },
        aapl: {
          krw: 43997.6295,
          usd: 39.435,
          src: "audit:aapl.close.2018×usdkrw.close.2018"
        },
        nvda: {
          krw: 3723.6487,
          usd: 3.3375,
          src: "audit:nvda.close.2018×usdkrw.close.2018"
        },
        tsla: {
          krw: 24753.7012,
          usd: 22.1867,
          src: "audit:tsla.close.2018×usdkrw.close.2018"
        },
        btc: {
          krw: 4262000,
          src: "audit:btc.krw.close.2018"
        },
        gold: {
          krw: 172044,
          src: "audit:gold.don_krw.close.2018 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1115.7,
          src: "audit:usdkrw.close.2018"
        },
        apt: {
          krw: 1635000000,
          src: "audit:eunma76.kb.2018-12"
        }
      }
    },
    "2019": {
      year: 2019,
      fx: 1156.4,
      depositRate: 1.85,
      baseRate: 1.25,
      prices: {
        samsung: {
          krw: 55800,
          src: "audit:samsung.close.2019"
        },
        aapl: {
          krw: 84894.215,
          usd: 73.4125,
          src: "audit:aapl.close.2019×usdkrw.close.2019"
        },
        nvda: {
          krw: 6802.523,
          usd: 5.8825,
          src: "audit:nvda.close.2019×usdkrw.close.2019"
        },
        tsla: {
          krw: 32250.4927,
          usd: 27.8887,
          src: "audit:tsla.close.2019×usdkrw.close.2019"
        },
        btc: {
          krw: 8342000,
          src: "audit:btc.krw.close.2019"
        },
        gold: {
          krw: 211189,
          src: "audit:gold.don_krw.close.2019 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1156.4,
          src: "audit:usdkrw.close.2019"
        },
        apt: {
          krw: 2005000000,
          src: "audit:eunma76.kb.2019-12"
        }
      }
    },
    "2020": {
      year: 2020,
      fx: 1086.3,
      depositRate: 1.16,
      baseRate: 0.5,
      prices: {
        samsung: {
          krw: 81000,
          src: "audit:samsung.close.2020"
        },
        aapl: {
          krw: 144141.147,
          usd: 132.69,
          src: "audit:aapl.close.2020×usdkrw.close.2020"
        },
        nvda: {
          krw: 14181.6465,
          usd: 13.055,
          src: "audit:nvda.close.2020×usdkrw.close.2020"
        },
        tsla: {
          krw: 255519.486,
          usd: 235.22,
          src: "audit:tsla.close.2020×usdkrw.close.2020"
        },
        btc: {
          krw: 31612000,
          src: "audit:btc.krw.close.2020"
        },
        gold: {
          krw: 247219,
          src: "audit:gold.don_krw.close.2020 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1086.3,
          src: "audit:usdkrw.close.2020"
        },
        apt: {
          krw: 2085000000,
          src: "audit:eunma76.kb.2020-12"
        }
      }
    },
    "2021": {
      year: 2021,
      fx: 1188.8,
      depositRate: 1.2,
      baseRate: 1.0,
      prices: {
        samsung: {
          krw: 78300,
          src: "audit:samsung.close.2021"
        },
        aapl: {
          krw: 211095.216,
          usd: 177.57,
          src: "audit:aapl.close.2021×usdkrw.close.2021"
        },
        nvda: {
          krw: 34963.7968,
          usd: 29.411,
          src: "audit:nvda.close.2021×usdkrw.close.2021"
        },
        tsla: {
          krw: 418766.688,
          usd: 352.26,
          src: "audit:tsla.close.2021×usdkrw.close.2021"
        },
        btc: {
          krw: 58412000,
          src: "audit:btc.krw.close.2021"
        },
        gold: {
          krw: 258829,
          src: "audit:gold.don_krw.close.2021 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1188.8,
          src: "audit:usdkrw.close.2021"
        },
        apt: {
          krw: 2335000000,
          src: "audit:eunma76.kb.2021-12"
        }
      }
    },
    "2022": {
      year: 2022,
      fx: 1264.5,
      depositRate: 3.12,
      baseRate: 3.25,
      prices: {
        samsung: {
          krw: 55300,
          src: "audit:samsung.close.2022"
        },
        aapl: {
          krw: 164296.485,
          usd: 129.93,
          src: "audit:aapl.close.2022×usdkrw.close.2022"
        },
        nvda: {
          krw: 18479.403,
          usd: 14.614,
          src: "audit:nvda.close.2022×usdkrw.close.2022"
        },
        tsla: {
          krw: 155761.11,
          usd: 123.18,
          src: "audit:tsla.close.2022×usdkrw.close.2022"
        },
        btc: {
          krw: 21164000,
          src: "audit:btc.krw.close.2022"
        },
        gold: {
          krw: 276515,
          src: "audit:gold.don_krw.close.2022 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1264.5,
          src: "audit:usdkrw.close.2022"
        },
        apt: {
          krw: 1906670000,
          src: "audit:eunma76.kb.2022-12"
        }
      }
    },
    "2023": {
      year: 2023,
      fx: 1288.0,
      depositRate: 3.84,
      baseRate: 3.5,
      prices: {
        samsung: {
          krw: 78500,
          src: "audit:samsung.close.2023"
        },
        aapl: {
          krw: 247978.64,
          usd: 192.53,
          src: "audit:aapl.close.2023×usdkrw.close.2023"
        },
        nvda: {
          krw: 63784.336,
          usd: 49.522,
          src: "audit:nvda.close.2023×usdkrw.close.2023"
        },
        tsla: {
          krw: 320042.24,
          usd: 248.48,
          src: "audit:tsla.close.2023×usdkrw.close.2023"
        },
        btc: {
          krw: 56901000,
          src: "audit:btc.krw.close.2023"
        },
        gold: {
          krw: 322751,
          src: "audit:gold.don_krw.close.2023 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1288.0,
          src: "audit:usdkrw.close.2023"
        },
        apt: {
          krw: 2343330000,
          src: "audit:eunma76.kb.2023-12"
        }
      }
    },
    "2024": {
      year: 2024,
      fx: 1472.5,
      depositRate: 3.48,
      baseRate: 3.0,
      prices: {
        samsung: {
          krw: 53200,
          src: "audit:samsung.close.2024"
        },
        aapl: {
          krw: 368743.45,
          usd: 250.42,
          src: "audit:aapl.close.2024×usdkrw.close.2024"
        },
        nvda: {
          krw: 197742.025,
          usd: 134.29,
          src: "audit:nvda.close.2024×usdkrw.close.2024"
        },
        tsla: {
          krw: 594654.4,
          usd: 403.84,
          src: "audit:tsla.close.2024×usdkrw.close.2024"
        },
        btc: {
          krw: 142200000,
          src: "audit:btc.krw.close.2024"
        },
        gold: {
          krw: 463200,
          src: "audit:gold.don_krw.close.2024 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1472.5,
          src: "audit:usdkrw.close.2024"
        },
        apt: {
          krw: 2683330000,
          src: "audit:eunma76.kb.2024-12"
        }
      }
    },
    "2025": {
      year: 2025,
      fx: 1439.0,
      depositRate: 2.73,
      baseRate: 2.5,
      prices: {
        samsung: {
          krw: 119900,
          src: "audit:samsung.close.2025"
        },
        aapl: {
          krw: 391206.54,
          usd: 271.86,
          src: "audit:aapl.close.2025×usdkrw.close.2025"
        },
        nvda: {
          krw: 268373.5,
          usd: 186.5,
          src: "audit:nvda.close.2025×usdkrw.close.2025"
        },
        tsla: {
          krw: 647147.08,
          usd: 449.72,
          src: "audit:tsla.close.2025×usdkrw.close.2025"
        },
        btc: {
          krw: 128336000,
          src: "audit:btc.krw.close.2025"
        },
        gold: {
          krw: 757785,
          src: "audit:gold.don_krw.close.2025 (LBMA×환율 이론값, 부가세·마진 제외)"
        },
        usd: {
          krw: 1439.0,
          src: "audit:usdkrw.close.2025"
        },
        apt: {
          krw: 3650000000,
          src: "audit:eunma76.kb.2025-12"
        }
      }
    }
  },
  final: {
    date: "2026-09-29",
    fx: 1356.7,
    prices: {
      samsung: {
        krw: 272500,
        src: "audit:samsung.close.2026-09-29"
      },
      btc: {
        krw: 113263000,
        src: "audit:btc.krw.close.2026-09-29"
      },
      gold: {
        krw: 680475,
        src: "audit:gold.don_krw.krx.2026-09-29 (KRX 종가)"
      },
      usd: {
        krw: 1356.7,
        src: "audit:usdkrw.close.2026-09-29"
      },
      apt: {
        krw: 3233330000,
        src: "audit:eunma76.2026-09"
      },
      aapl: {
        krw: 446896.98,
        usd: 329.4,
        src: "audit:aapl.close.2026-09-29×usdkrw.close.2026-09-29"
      },
      nvda: {
        krw: 308255.807,
        usd: 227.21,
        src: "audit:nvda.close.2026-09-29×usdkrw.close.2026-09-29"
      },
      tsla: {
        krw: 478698.028,
        usd: 352.84,
        src: "audit:tsla.close.2026-09-29×usdkrw.close.2026-09-29"
      }
    }
  },
  events: {
    "ev-2000-01-04": {
      id: "ev-2000-01-04",
      date: "2000-01-04",
      label: "삼성전자 종가",
      prices: {
        samsung: {
          krw: 6110,
          src: "audit:samsung.close.2000-01-04"
        }
      }
    },
    "ev-2000-09-29": {
      id: "ev-2000-09-29",
      date: "2000-09-29",
      label: "애플",
      prices: {
        aapl: {
          krw: 581.4171,
          usd: 0.4598,
          estimated: true,
          src: "audit:aapl.event.2000-09-29×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2000-10-18": {
      id: "ev-2000-10-18",
      date: "2000-10-18",
      label: "삼성전자 저점",
      prices: {
        samsung: {
          krw: 2420,
          src: "audit:samsung.low.2000-10-18"
        }
      }
    },
    "ev-2001-04-04": {
      id: "ev-2001-04-04",
      date: "2001-04-04",
      label: "원/달러",
      prices: {
        usd: {
          krw: 1365.2,
          src: "audit:usdkrw.close.2001-04-04"
        }
      }
    },
    "ev-2002-10-09": {
      id: "ev-2002-10-09",
      date: "2002-10-09",
      label: "엔비디아",
      prices: {
        nvda: {
          krw: 72.8327,
          usd: 0.0614,
          estimated: true,
          src: "audit:nvda.event.2002-10-09×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2003-04-17": {
      id: "ev-2003-04-17",
      date: "2003-04-17",
      label: "애플",
      prices: {
        aapl: {
          krw: 279.4262,
          usd: 0.2343,
          estimated: true,
          src: "audit:aapl.event.2003-04-17×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2003-09": {
      id: "ev-2003-09",
      date: "2003-09",
      label: "은마 76㎡",
      prices: {
        apt: {
          krw: 720000000,
          src: "audit:eunma76.peak.2003-09"
        }
      }
    },
    "ev-2006-11": {
      id: "ev-2006-11",
      date: "2006-11",
      label: "은마 76㎡",
      prices: {
        apt: {
          krw: 1125000000,
          src: "audit:eunma76.peak1.2006-11"
        }
      }
    },
    "ev-2007-01-09": {
      id: "ev-2007-01-09",
      date: "2007-01-09",
      label: "애플",
      prices: {
        aapl: {
          krw: 3094.8402,
          usd: 3.3061,
          estimated: true,
          src: "audit:aapl.event.2007-01-09×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2007-10-31": {
      id: "ev-2007-10-31",
      date: "2007-10-31",
      label: "원/달러",
      prices: {
        usd: {
          krw: 900.7,
          src: "audit:usdkrw.close.2007-10-31"
        }
      }
    },
    "ev-2008-10-24": {
      id: "ev-2008-10-24",
      date: "2008-10-24",
      label: "삼성전자 종가",
      prices: {
        samsung: {
          krw: 8150,
          src: "audit:samsung.close.2008-10-24"
        }
      }
    },
    "ev-2008-10-27": {
      id: "ev-2008-10-27",
      date: "2008-10-27",
      label: "삼성전자 저점",
      prices: {
        samsung: {
          krw: 8060,
          src: "audit:samsung.low.2008-10-27"
        }
      }
    },
    "ev-2009-03-02": {
      id: "ev-2009-03-02",
      date: "2009-03-02",
      label: "원/달러",
      prices: {
        usd: {
          krw: 1570.3,
          src: "audit:usdkrw.close.2009-03-02"
        }
      }
    },
    "ev-2009-03-06": {
      id: "ev-2009-03-06",
      date: "2009-03-06",
      label: "원/달러",
      prices: {
        usd: {
          krw: 1597.0,
          src: "audit:usdkrw.high.2009-03-06"
        }
      }
    },
    "ev-2010-06-29": {
      id: "ev-2010-06-29",
      date: "2010-06-29",
      label: "테슬라",
      prices: {
        tsla: {
          krw: 1807.396,
          usd: 1.5927,
          estimated: true,
          src: "audit:tsla.event.2010-06-29.first_close×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2010-07-07": {
      id: "ev-2010-07-07",
      date: "2010-07-07",
      label: "테슬라",
      prices: {
        tsla: {
          krw: 1195.2848,
          usd: 1.0533,
          estimated: true,
          src: "audit:tsla.event.2010-07-07.all_time_low×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2010-07-17": {
      id: "ev-2010-07-17",
      date: "2010-07-17",
      label: "비트코인 Mt.Gox 첫 거래",
      prices: {
        btc: {
          krw: 56.1839,
          usd: 0.04951,
          estimated: true,
          src: "audit:btc.event.mtgox_first_trade×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2011-06-08": {
      id: "ev-2011-06-08",
      date: "2011-06-08",
      label: "비트코인(달러)",
      prices: {
        btc: {
          krw: 36753.938,
          usd: 31.91,
          estimated: true,
          src: "audit:btc.usd.high.2011-06-08×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2012-12": {
      id: "ev-2012-12",
      date: "2012-12",
      label: "은마 76㎡",
      prices: {
        apt: {
          krw: 740000000,
          src: "audit:eunma76.trough.2012-12"
        }
      }
    },
    "ev-2013-11-27": {
      id: "ev-2013-11-27",
      date: "2013-11-27",
      label: "비트코인 첫 $1,000",
      prices: {
        btc: {
          krw: 1055400.0,
          usd: 1000,
          estimated: true,
          src: "audit:btc.event.first_1000.2013-11-27×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2017-12-17": {
      id: "ev-2017-12-17",
      date: "2017-12-17",
      label: "비트코인(달러)",
      prices: {
        btc: {
          krw: 21052453.0,
          usd: 19666.0,
          estimated: true,
          src: "audit:btc.usd.high.2017-12-17×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2018-01-06": {
      id: "ev-2018-01-06",
      date: "2018-01-06",
      label: "비트코인(원화)",
      prices: {
        btc: {
          krw: 28885000,
          src: "audit:btc.krw.high.2018-01-06"
        }
      }
    },
    "ev-2018-04-27": {
      id: "ev-2018-04-27",
      date: "2018-04-27",
      label: "삼성전자 종가",
      prices: {
        samsung: {
          krw: 53000,
          src: "audit:samsung.close.2018-04-27"
        }
      }
    },
    "ev-2018-05-04": {
      id: "ev-2018-05-04",
      date: "2018-05-04",
      label: "삼성전자 종가",
      prices: {
        samsung: {
          krw: 51900,
          src: "audit:samsung.close.2018-05-04"
        }
      }
    },
    "ev-2018-12-15": {
      id: "ev-2018-12-15",
      date: "2018-12-15",
      label: "비트코인(달러)",
      prices: {
        btc: {
          krw: 3483527.796,
          usd: 3122.28,
          estimated: true,
          src: "audit:btc.usd.low.2018-12-15×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2020-02-19": {
      id: "ev-2020-02-19",
      date: "2020-02-19",
      label: "애플 · 엔비디아 · 테슬라",
      prices: {
        aapl: {
          krw: 87887.1015,
          usd: 80.905,
          estimated: true,
          src: "audit:aapl.event.2020-02-19×그해 연말 환율(당일 환율 미확보 — 추정)"
        },
        nvda: {
          krw: 8546.4652,
          usd: 7.8675,
          estimated: true,
          src: "audit:nvda.event.2020-02-19×그해 연말 환율(당일 환율 미확보 — 추정)"
        },
        tsla: {
          krw: 66439.6288,
          usd: 61.1614,
          estimated: true,
          src: "audit:tsla.event.2020-02-19×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2020-03-13": {
      id: "ev-2020-03-13",
      date: "2020-03-13",
      label: "비트코인(달러) · 비트코인(원화)",
      prices: {
        btc: {
          krw: 5489000,
          src: "audit:btc.krw.low.2020-03-13"
        }
      }
    },
    "ev-2020-03-16": {
      id: "ev-2020-03-16",
      date: "2020-03-16",
      label: "엔비디아",
      prices: {
        nvda: {
          krw: 5333.733,
          usd: 4.91,
          estimated: true,
          src: "audit:nvda.event.2020-03-16.covid_low×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2020-03-18": {
      id: "ev-2020-03-18",
      date: "2020-03-18",
      label: "테슬라",
      prices: {
        tsla: {
          krw: 26159.5162,
          usd: 24.0813,
          estimated: true,
          src: "audit:tsla.event.2020-03-18.covid_low×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2020-03-19": {
      id: "ev-2020-03-19",
      date: "2020-03-19",
      label: "삼성전자 저점 · 원/달러",
      prices: {
        samsung: {
          krw: 42300,
          src: "audit:samsung.low.2020-03-19"
        },
        usd: {
          krw: 1285.7,
          src: "audit:usdkrw.close.2020-03-19"
        }
      }
    },
    "ev-2020-03-23": {
      id: "ev-2020-03-23",
      date: "2020-03-23",
      label: "애플",
      prices: {
        aapl: {
          krw: 60933.2827,
          usd: 56.0925,
          estimated: true,
          src: "audit:aapl.event.2020-03-23.covid_low×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2021-01-11": {
      id: "ev-2021-01-11",
      date: "2021-01-11",
      label: "삼성전자 고점 · 삼성전자 종가",
      prices: {
        samsung: {
          krw: 91000,
          src: "audit:samsung.close.2021-01-11"
        }
      }
    },
    "ev-2021-11-10": {
      id: "ev-2021-11-10",
      date: "2021-11-10",
      label: "비트코인(달러)",
      prices: {
        btc: {
          krw: 82027200.0,
          usd: 69000.0,
          estimated: true,
          src: "audit:btc.usd.high.2021-11-10×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2022-05-12": {
      id: "ev-2022-05-12",
      date: "2022-05-12",
      label: "비트코인(달러)",
      prices: {
        btc: {
          krw: 32119627.725,
          usd: 25401.05,
          estimated: true,
          src: "audit:btc.usd.low.2022-05-12×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2022-06": {
      id: "ev-2022-06",
      date: "2022-06",
      label: "은마 76㎡",
      prices: {
        apt: {
          krw: 2400000000,
          src: "audit:eunma76.peak2.2022-06"
        }
      }
    },
    "ev-2022-09-28": {
      id: "ev-2022-09-28",
      date: "2022-09-28",
      label: "원/달러",
      prices: {
        usd: {
          krw: 1439.9,
          src: "audit:usdkrw.close.2022-09-28"
        }
      }
    },
    "ev-2022-09-30": {
      id: "ev-2022-09-30",
      date: "2022-09-30",
      label: "삼성전자 저점",
      prices: {
        samsung: {
          krw: 51800,
          src: "audit:samsung.low.2022-09-30"
        }
      }
    },
    "ev-2022-11-21": {
      id: "ev-2022-11-21",
      date: "2022-11-21",
      label: "비트코인(달러)",
      prices: {
        btc: {
          krw: 19573195.5,
          usd: 15479.0,
          estimated: true,
          src: "audit:btc.usd.low.2022-11-21×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2022-11-30": {
      id: "ev-2022-11-30",
      date: "2022-11-30",
      label: "엔비디아",
      prices: {
        nvda: {
          krw: 21399.1335,
          usd: 16.923,
          estimated: true,
          src: "audit:nvda.event.2022-11-30×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2022-12": {
      id: "ev-2022-12",
      date: "2022-12",
      label: "은마 76㎡",
      prices: {
        apt: {
          krw: 1906670000,
          src: "audit:eunma76.2022-12"
        }
      }
    },
    "ev-2023-05-25": {
      id: "ev-2023-05-25",
      date: "2023-05-25",
      label: "엔비디아",
      prices: {
        nvda: {
          krw: 48918.24,
          usd: 37.98,
          estimated: true,
          src: "audit:nvda.event.2023-05-25×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2024-03-11": {
      id: "ev-2024-03-11",
      date: "2024-03-11",
      label: "비트코인(원화)",
      prices: {
        btc: {
          krw: 100000000,
          src: "audit:btc.krw.first_100m.2024-03-11"
        }
      }
    },
    "ev-2024-11-14": {
      id: "ev-2024-11-14",
      date: "2024-11-14",
      label: "삼성전자 종가",
      prices: {
        samsung: {
          krw: 49900,
          src: "audit:samsung.close.2024-11-14"
        }
      }
    },
    "ev-2024-12-05": {
      id: "ev-2024-12-05",
      date: "2024-12-05",
      label: "비트코인(달러)",
      prices: {
        btc: {
          krw: 147250000.0,
          usd: 100000,
          estimated: true,
          src: "audit:btc.usd.first_100k.2024-12-05×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2024-12-27": {
      id: "ev-2024-12-27",
      date: "2024-12-27",
      label: "원/달러",
      prices: {
        usd: {
          krw: 1467.5,
          src: "audit:usdkrw.close.2024-12-27"
        }
      }
    },
    "ev-2025-01-27": {
      id: "ev-2025-01-27",
      date: "2025-01-27",
      label: "엔비디아",
      prices: {
        nvda: {
          krw: 170406.38,
          usd: 118.42,
          estimated: true,
          src: "audit:nvda.event.2025-01-27×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2025-04-09": {
      id: "ev-2025-04-09",
      date: "2025-04-09",
      label: "원/달러",
      prices: {
        usd: {
          krw: 1484.1,
          src: "audit:usdkrw.close.2025-04-09"
        }
      }
    },
    "ev-2025-10-06": {
      id: "ev-2025-10-06",
      date: "2025-10-06",
      label: "비트코인(달러)",
      prices: {
        btc: {
          krw: 181705408.0,
          usd: 126272.0,
          estimated: true,
          src: "audit:btc.usd.ath.2025-10-06×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2025-10-09": {
      id: "ev-2025-10-09",
      date: "2025-10-09",
      label: "비트코인(원화)",
      prices: {
        btc: {
          krw: 179869000,
          src: "audit:btc.krw.ath.2025-10-09"
        }
      }
    },
    "ev-2025-12-16": {
      id: "ev-2025-12-16",
      date: "2025-12-16",
      label: "테슬라",
      prices: {
        tsla: {
          krw: 704937.32,
          usd: 489.88,
          estimated: true,
          src: "audit:tsla.event.2025-12-16.all_time_high×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2025-12-23": {
      id: "ev-2025-12-23",
      date: "2025-12-23",
      label: "원/달러",
      prices: {
        usd: {
          krw: 1483.6,
          src: "audit:usdkrw.close.2025-12-23"
        }
      }
    },
    "ev-2026-01": {
      id: "ev-2026-01",
      date: "2026-01",
      label: "금 1돈 · 은마 76㎡",
      prices: {
        gold: {
          krw: 1011788,
          src: "audit:gold.don_krw.peak.2026-01"
        },
        apt: {
          krw: 3666670000,
          src: "audit:eunma76.peak3.2026-01"
        }
      }
    },
    "ev-2026-01-14": {
      id: "ev-2026-01-14",
      date: "2026-01-14",
      label: "비트코인(달러)",
      prices: {
        btc: {
          krw: 132873841.3,
          usd: 97939.0,
          estimated: true,
          src: "audit:btc.usd.high.2026-01-14×그해 연말 환율(당일 환율 미확보 — 추정)"
        }
      }
    },
    "ev-2026-03-19": {
      id: "ev-2026-03-19",
      date: "2026-03-19",
      label: "원/달러",
      prices: {
        usd: {
          krw: 1501.0,
          src: "audit:usdkrw.close.2026-03-19"
        }
      }
    },
    "ev-2026-06-05": {
      id: "ev-2026-06-05",
      date: "2026-06-05",
      label: "원/달러",
      prices: {
        usd: {
          krw: 1561.5,
          src: "audit:usdkrw.high.2026-06-05"
        }
      }
    },
    "ev-2026-06-19": {
      id: "ev-2026-06-19",
      date: "2026-06-19",
      label: "삼성전자 고점",
      prices: {
        samsung: {
          krw: 374500,
          src: "audit:samsung.high.2026-06-19"
        }
      }
    },
    "ev-2026-07-02": {
      id: "ev-2026-07-02",
      date: "2026-07-02",
      label: "원/달러",
      prices: {
        usd: {
          krw: 1555.8,
          src: "audit:usdkrw.close.2026-07-02"
        }
      }
    },
    "ev-2026-07-29": {
      id: "ev-2026-07-29",
      date: "2026-07-29",
      label: "삼성전자 종가 · 삼성전자 저점",
      prices: {
        samsung: {
          krw: 208500,
          src: "audit:samsung.close.2026-07-29"
        }
      }
    },
    "ev-2026-07-30": {
      id: "ev-2026-07-30",
      date: "2026-07-30",
      label: "삼성전자 종가",
      prices: {
        samsung: {
          krw: 207000,
          src: "audit:samsung.close.2026-07-30"
        }
      }
    },
    "ev-2026-07-31": {
      id: "ev-2026-07-31",
      date: "2026-07-31",
      label: "삼성전자 종가",
      prices: {
        samsung: {
          krw: 262500,
          src: "audit:samsung.close.2026-07-31"
        }
      }
    },
    "ev-2026-08-14": {
      id: "ev-2026-08-14",
      date: "2026-08-14",
      label: "비트코인(원화)",
      prices: {
        btc: {
          krw: 88342000,
          src: "audit:btc.krw.low.2026-08-14"
        }
      }
    },
    "ev-2026-09-09": {
      id: "ev-2026-09-09",
      date: "2026-09-09",
      label: "원/달러",
      prices: {
        usd: {
          krw: 1336.1,
          src: "audit:usdkrw.close.2026-09-09"
        }
      }
    }
  },
  rules: {
    feeDomestic: [
      {
        from: 2000,
        rate: 0.002
      },
      {
        from: 2005,
        rate: 0.001
      },
      {
        from: 2015,
        rate: 0.00015
      }
    ],
    txTaxDomestic: [
      {
        from: 2000,
        rate: 0.003
      },
      {
        from: 2019,
        rate: 0.0025
      },
      {
        from: 2021,
        rate: 0.0023
      },
      {
        from: 2023,
        rate: 0.002
      },
      {
        from: 2024,
        rate: 0.0018
      },
      {
        from: 2025,
        rate: 0.0015
      },
      {
        from: 2026,
        rate: 0.002
      }
    ],
    feeOverseas: [
      {
        from: 2000,
        rate: 0.0025
      }
    ],
    overseasGainTax: {
      from: 2000,
      rate: 0.22,
      deduction: 2500000
    },
    feeCrypto: [
      {
        from: 2000,
        rate: 0.0005
      }
    ],
    goldRetailCostUntil: 2014,
    goldRetailCost: 0.1,
    ltv: [
      {
        from: 2000,
        rate: 0
      },
      {
        from: 2002,
        rate: 0.6
      },
      {
        from: 2003,
        rate: 0.4
      },
      {
        from: 2014,
        rate: 0.7
      },
      {
        from: 2017,
        rate: 0.4
      },
      {
        from: 2022,
        rate: 0.5
      },
      {
        from: 2025,
        rate: 0.4
      }
    ],
    loanBanAbove: [
      {
        from: 2019,
        until: 2022,
        price: 1500000000
      }
    ],
    loanCap: [
      {
        from: 2025,
        max: 600000000
      }
    ],
    aptAcquisitionTax: [
      {
        from: 2000,
        rate: 0.057999999999999996
      },
      {
        from: 2005,
        rate: 0.046
      },
      {
        from: 2011,
        rate: 0.04
      },
      {
        from: 2013,
        rate: 0.03
      }
    ],
    giftTax: [
      {
        upTo: 100000000,
        rate: 0.1,
        deduction: 0
      },
      {
        upTo: 500000000,
        rate: 0.2,
        deduction: 10000000
      },
      {
        upTo: 1000000000,
        rate: 0.3,
        deduction: 60000000
      },
      {
        upTo: 3000000000,
        rate: 0.4,
        deduction: 160000000
      },
      {
        upTo: Infinity,
        rate: 0.5,
        deduction: 460000000
      }
    ],
    giftDeduction: [
      {
        from: 2000,
        minor: 15000000,
        adult: 30000000
      },
      {
        from: 2014,
        minor: 20000000,
        adult: 50000000
      }
    ],
    penaltyFraud: [
      {
        from: 2000,
        rate: 0.2
      },
      {
        from: 2007,
        rate: 0.4
      }
    ],
    giftReportCredit: [
      {
        from: 2000,
        rate: 0.1
      },
      {
        from: 2017,
        rate: 0.07
      },
      {
        from: 2018,
        rate: 0.05
      },
      {
        from: 2019,
        rate: 0.03
      }
    ],
    totoTax: {
      rate: 0.22,
      floor: 10000
    },
    lateDaily: [
      {
        from: 2000,
        rate: 0.0003
      },
      {
        from: 2019,
        rate: 0.00025
      },
      {
        from: 2022,
        rate: 0.00021999999999999998
      }
    ],
    loanSpread: 1.5,
    overseasFrom: 2007,
    cryptoDomesticFrom: 2013,
    adultYear: 2013
  }
};
