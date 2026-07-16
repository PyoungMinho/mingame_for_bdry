// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import GuessInput from "./GuessInput";
import type { Region } from "@/lib/dongne/types";

function region(over: Partial<Region>): Region {
  return {
    code: "00000",
    name: "테스트구",
    sido: "테스트",
    sidoFull: "테스트특별시",
    nameWithSido: "테스트구",
    aliases: [],
    centroid: { lat: 0, lng: 0 },
    bbox: [0, 0, 0, 0],
    ...over,
  };
}

const REGIONS: Region[] = [
  region({ code: "26010", name: "중구", sido: "부산", nameWithSido: "중구(부산)" }),
  region({ code: "23010", name: "중구", sido: "인천", nameWithSido: "중구(인천)" }),
  region({ code: "11020", name: "해운대구", sido: "부산", nameWithSido: "해운대구", aliases: ["해운대"] }),
];

describe("GuessInput", () => {
  it("자유 텍스트만 입력한 상태(미선택)에서는 [추측하기]를 눌러도 제출되지 않는다(2탭 규칙)", async () => {
    const onSubmit = vi.fn();
    render(<GuessInput regions={REGIONS} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "해운대" } });
    await waitFor(() => expect(screen.getByRole("option", { name: /해운대\s*구/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "추측하기" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("드롭다운에서 옵션 선택(1탭) 후 [추측하기](2탭)를 눌러야 onSubmit이 호출된다", async () => {
    const onSubmit = vi.fn();
    render(<GuessInput regions={REGIONS} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "해운대" } });
    await waitFor(() => expect(screen.getByRole("option", { name: /해운대\s*구/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("option", { name: /해운대\s*구/ }));
    expect(onSubmit).not.toHaveBeenCalled(); // 1탭째 — 아직 제출 아님
    expect(screen.getByRole("combobox")).toHaveValue("해운대구");

    fireEvent.click(screen.getByRole("button", { name: "추측하기" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ code: "11020" }));
  });

  it("제출 후 입력창과 선택 상태가 다음 시도용으로 초기화된다", async () => {
    const onSubmit = vi.fn();
    render(<GuessInput regions={REGIONS} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "해운대" } });
    await waitFor(() => expect(screen.getByRole("option", { name: /해운대\s*구/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: /해운대\s*구/ }));
    fireEvent.click(screen.getByRole("button", { name: "추측하기" }));

    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("동명 지역은 옵션마다 (시도) 배지를 병기한다", async () => {
    render(<GuessInput regions={REGIONS} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "중구" } });
    await waitFor(() => expect(screen.getAllByText("중구")).toHaveLength(2));
    expect(screen.getByText("(부산)")).toBeInTheDocument();
    expect(screen.getByText("(인천)")).toBeInTheDocument();
  });

  it("이미 추측한 코드는 강제 차단 없이 '이미 추측함' 캡션과 함께 여전히 선택 가능하다", async () => {
    const onSubmit = vi.fn();
    render(<GuessInput regions={REGIONS} excludedCodes={["11020"]} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "해운대" } });
    await waitFor(() => expect(screen.getByRole("option", { name: /해운대\s*구/ })).toBeInTheDocument());

    expect(screen.getByText("이미 추측함")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /해운대\s*구/ }));
    fireEvent.click(screen.getByRole("button", { name: "추측하기" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("일치하는 결과가 없으면 빈 상태 문구를 보여준다", async () => {
    render(<GuessInput regions={REGIONS} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "존재하지않는동네" } });
    await waitFor(() => expect(screen.getByText("일치하는 동네가 없어요")).toBeInTheDocument());
  });

  it("disabled=true면 포커스해도 드롭다운이 열리지 않는다", () => {
    render(<GuessInput regions={REGIONS} onSubmit={vi.fn()} disabled />);
    const input = screen.getByRole("combobox");
    expect(input).toBeDisabled();
    fireEvent.focus(input);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
