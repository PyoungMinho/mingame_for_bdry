/**
 * curriculum.ts — 교육과정 단원 데이터 레이어 무결성 (해자 2: 평가원/교육과정 정합성)
 *
 * 강사/학생이 단원을 '찍어서' 출제하는 기능의 토대다. 데이터가 깨지면
 * (id 중복·빈 배열·범위 밖 배점) 엔진 프롬프트와 시험지 단원 라벨이 동시에 오염된다.
 * 단원명 '철자'는 사람이 별도 검수 — 여기서는 구조/일관성 불변식만 못박는다.
 */
import { describe, it, expect } from "vitest";
import {
  CURRICULUM,
  coursesBySubject,
  getCourse,
  findUnit,
  unitPathLabel,
} from "@/lib/exam/curriculum";
import { SUBJECTS, type Subject } from "@/lib/exam/types";

const ALL_SUBJECTS: Subject[] = SUBJECTS.map((s) => s.id);
const allCourses = CURRICULUM;
const allUnits = CURRICULUM.flatMap((c) => c.units);

describe("CURRICULUM — 구조 불변식", () => {
  it("CUR-01: 과정이 1개 이상 존재", () => {
    expect(allCourses.length).toBeGreaterThan(0);
  });

  it("CUR-02: 모든 과정 id가 유일", () => {
    const ids = allCourses.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("CUR-03: 모든 단원 id가 전 과목 통틀어 유일 — findUnit 충돌 방지", () => {
    const ids = allUnits.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("CUR-04: 모든 과정이 1개 이상의 단원을 가짐", () => {
    for (const c of allCourses) {
      expect(c.units.length, `${c.id} 단원 없음`).toBeGreaterThan(0);
    }
  });

  it("CUR-05: 과정 subject가 5개 교과 enum 중 하나", () => {
    for (const c of allCourses) {
      expect(ALL_SUBJECTS).toContain(c.subject);
    }
  });

  it("CUR-06: 5개 교과 전부 1개 이상의 과정으로 채워짐(누락 과목 없음)", () => {
    for (const s of ALL_SUBJECTS) {
      expect(coursesBySubject(s).length, `${s} 과정 없음`).toBeGreaterThan(0);
    }
  });
});

describe("CURRICULUM — 단원 필드 정합", () => {
  it("CUR-10: 모든 과정/단원 name·focus 공백 아님", () => {
    for (const c of allCourses) {
      expect(c.name.trim().length, `${c.id} name`).toBeGreaterThan(0);
    }
    for (const u of allUnits) {
      expect(u.name.trim().length, `${u.id} name`).toBeGreaterThan(0);
      expect(u.focus.trim().length, `${u.id} focus`).toBeGreaterThan(0);
    }
  });

  it("CUR-11: 모든 단원 topics 1개 이상 & 각 항목 공백 아님", () => {
    for (const u of allUnits) {
      expect(u.topics.length, `${u.id} topics 비어있음`).toBeGreaterThan(0);
      u.topics.forEach((t) =>
        expect(t.trim().length, `${u.id} 빈 topic`).toBeGreaterThan(0)
      );
    }
  });

  it("CUR-12: 모든 단원 points 1개 이상 & 전부 2~4 정수(배점 불변식)", () => {
    for (const u of allUnits) {
      expect(u.points.length, `${u.id} points 비어있음`).toBeGreaterThan(0);
      for (const p of u.points) {
        expect(Number.isInteger(p), `${u.id} points 비정수 ${p}`).toBe(true);
        expect(p, `${u.id} points<2`).toBeGreaterThanOrEqual(2);
        expect(p, `${u.id} points>4`).toBeLessThanOrEqual(4);
      }
    }
  });
});

describe("CURRICULUM — 헬퍼 함수", () => {
  it("CUR-20: coursesBySubject 결과의 subject가 전부 일치", () => {
    for (const s of ALL_SUBJECTS) {
      coursesBySubject(s).forEach((c) => expect(c.subject).toBe(s));
    }
  });

  it("CUR-21: getCourse(존재 id)=해당 과정, 없는 id=undefined", () => {
    const first = allCourses[0];
    expect(getCourse(first.id)?.id).toBe(first.id);
    expect(getCourse("__no_such_course__")).toBeUndefined();
  });

  it("CUR-22: findUnit가 모든 단원 id를 (과정,단원) 쌍으로 역참조", () => {
    for (const u of allUnits) {
      const f = findUnit(u.id);
      expect(f, `${u.id} 역참조 실패`).toBeDefined();
      expect(f!.unit.id).toBe(u.id);
      expect(f!.course.units).toContain(f!.unit);
    }
  });

  it("CUR-23: findUnit(없는 id)=undefined", () => {
    expect(findUnit("__no_such_unit__")).toBeUndefined();
  });

  it("CUR-24: unitPathLabel='과정명 · 단원명' 형식", () => {
    for (const u of allUnits) {
      const f = findUnit(u.id)!;
      expect(unitPathLabel(u.id)).toBe(`${f.course.name} · ${f.unit.name}`);
    }
  });

  it("CUR-25: unitPathLabel(없는 id)=undefined", () => {
    expect(unitPathLabel("__no_such_unit__")).toBeUndefined();
  });
});
