// src/app/cloudcheck/_client/components/s-keys.ts — 컴포넌트가 그리지만 글자는 S(i18n/ko/screens.ts, 페이지개발자 소유)가 가진 키 목록.
// 디자인 최종안 §8-1 규칙 13: 어느 코드든 어느 파일의 키든 그릴 수 있다. 소유는 글자를 쓰는 사람 기준이다.
//  - 값은 UX 카피 덱 §7-3의 키 그대로다. 페이지개발자가 screens.ts를 채우면 컴파일 단계가 아니라 가드 테스트('코드에 적은 카탈로그 키가 카탈로그에 있다')가 존재를 검사한다.
//  - 타입을 일부러 CatalogKey로 넓혔다(k() 헬퍼): 아직 없는 S 키가 이 파일을 컴파일 오류로 만들지 않게 한다. 없는 키는 화면에 ⟦키⟧로 보인다.
//  - 컴포넌트 렌더 테스트(__tests__/render.tsx)는 이 파일의 키만 'S 대기'로 허용하고 나머지 C·S 키가 빠지면 실패한다.
import type { CatalogKey, DemoSetId } from "../../../../lib/cloudcheck/model/report";

const k = (key: CatalogKey): CatalogKey => key;

export const S_KEY = {
  /* ConfirmDialog (리포트 닫기 확인) */
  dlgTitle: k("cc.app.dlg.close-report.title"),
  dlgBody: k("cc.app.dlg.close-report.body"),
  dlgStay: k("cc.app.dlg.close-report.stay"),
  dlgGo: k("cc.app.dlg.close-report.go"),
  /* InputTabs */
  tabFile: k("cc.input.tab.file"),
  tabPaste: k("cc.input.tab.paste"),
  /* JumpNav */
  jumpAria: k("cc.report.jump.aria"),
  /* FixSteps · AccountCheck */
  fixStepObserve: k("cc.fix.step.observe"),
  fixStepChange: k("cc.fix.step.change"),
  fixStepRevert: k("cc.fix.step.revert"),
  fixProperty: k("cc.fix.property"),
  fixDoc: k("cc.fix.doc"),
  fixAccount: k("cc.fix.account"),
  fixAccountCheck: k("cc.fix.account-check"),
  fixAccountCheckAzure: k("cc.fix.account-check.azure"),
  fixAccountDemo: k("cc.fix.account-demo"),
  /* BeforeAfterTable */
  cmpBecameUnknownNote: k("cc.compare.became-unknown.note"),
  cmpBecameKnownNote: k("cc.compare.became-known.note"),
  /* PrintHead */
  footerVersions: k("cc.app.footer.versions"),
  /* PathChooser */
  pathsHeading: k("cc.prep.paths.heading"),
  pathDoorsLabel: k("cc.prep.path.doors-label"),
  /* DemoCards · CloudRadio */
  demoCloudLegend: k("cc.demo.cloud.legend"),
  demoOpen: k("cc.demo.open"),
} as const;

export interface PathCardKeys {
  readonly title: CatalogKey;
  readonly tag: CatalogKey | null;
  readonly summary: Readonly<Record<"aws" | "azure", CatalogKey>>;
  readonly covers: Readonly<Record<"aws" | "azure", CatalogKey>>;
  readonly needs: Readonly<Record<"aws" | "azure", CatalogKey>> | null;
  /** 한계 문장(Azure 방법 ②는 없음) */
  readonly limit: Readonly<Partial<Record<"aws" | "azure", CatalogKey>>>;
}

/** PathChooser 카드 문구: csv = 방법 ①(파일 하나만), collector = 방법 ②(수집기) */
export const PATH_KEYS: Readonly<Record<"csv" | "collector", PathCardKeys>> = {
  csv: {
    title: k("cc.prep.path1.title"),
    tag: k("cc.prep.path1.tag"),
    summary: { aws: k("cc.prep.path1.summary.aws"), azure: k("cc.prep.path1.summary.azure") },
    covers: { aws: k("cc.prep.path1.covers.aws"), azure: k("cc.prep.path1.covers.azure") },
    needs: null,
    limit: { aws: k("cc.prep.path1.limit.aws"), azure: k("cc.prep.path1.limit.azure") },
  },
  collector: {
    title: k("cc.prep.path2.title"),
    tag: null, // '권장' 칩은 C 키(cc.c.path.recommended)로 그린다
    summary: { aws: k("cc.prep.path2.summary.aws"), azure: k("cc.prep.path2.summary.azure") },
    covers: { aws: k("cc.prep.path2.covers"), azure: k("cc.prep.path2.covers") },
    needs: { aws: k("cc.prep.path2.needs.aws"), azure: k("cc.prep.path2.needs.azure") },
    limit: { aws: k("cc.prep.path2.limit.aws") },
  },
};

export interface DemoSetKeys {
  readonly name: CatalogKey;
  readonly teach: CatalogKey;
  readonly story: CatalogKey;
  readonly aws: CatalogKey;
  readonly azure: CatalogKey;
}

/** 체험 세트 카드 문구(세트 글자 A~D는 화면에 쓰지 않는다. 키만 소문자 글자를 쓴다) */
export const DEMO_SET_KEYS: Readonly<Record<DemoSetId, DemoSetKeys>> = {
  A: { name: k("cc.demo.set.a.name"), teach: k("cc.demo.set.a.teach"), story: k("cc.demo.set.a.story"), aws: k("cc.demo.set.a.aws"), azure: k("cc.demo.set.a.azure") },
  B: { name: k("cc.demo.set.b.name"), teach: k("cc.demo.set.b.teach"), story: k("cc.demo.set.b.story"), aws: k("cc.demo.set.b.aws"), azure: k("cc.demo.set.b.azure") },
  C: { name: k("cc.demo.set.c.name"), teach: k("cc.demo.set.c.teach"), story: k("cc.demo.set.c.story"), aws: k("cc.demo.set.c.aws"), azure: k("cc.demo.set.c.azure") },
  D: { name: k("cc.demo.set.d.name"), teach: k("cc.demo.set.d.teach"), story: k("cc.demo.set.d.story"), aws: k("cc.demo.set.d.aws"), azure: k("cc.demo.set.d.azure") },
};
/** 체험 카드 순서: C → D → A → B (UX Q14) */
export const DEMO_CARD_ORDER: readonly DemoSetId[] = ["C", "D", "A", "B"];

/** 위 S 키 전부(렌더 테스트의 'S 대기' 허용 목록) */
export function allSKeys(): readonly string[] {
  const keys: string[] = [...Object.values(S_KEY)];
  for (const p of Object.values(PATH_KEYS)) {
    keys.push(p.title, ...Object.values(p.summary), ...Object.values(p.covers), ...Object.values(p.limit));
    if (p.tag !== null) keys.push(p.tag);
    if (p.needs !== null) keys.push(...Object.values(p.needs));
  }
  for (const d of Object.values(DEMO_SET_KEYS)) keys.push(d.name, d.teach, d.story, d.aws, d.azure);
  return [...new Set(keys)];
}
