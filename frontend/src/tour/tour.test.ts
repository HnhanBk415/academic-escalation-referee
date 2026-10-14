// @vitest-environment jsdom
import React, { act, useContext } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import {
  TOUR_STEPS,
  mapPathnameToTourKey,
  type PageTourKey,
} from "./tourSteps";
import {
  hasSeenTourKey,
  markTourSeen,
  resetAllTourKeys,
  hasAnyTourSeen,
  TourProvider,
  TourContext,
} from "./TourContext";

let capturedConfig: any = null;
let capturedSteps: any[] = [];
let isDriverActive = false;

const mockDestroy = vi.fn(() => {
  isDriverActive = false;
});
const mockDrive = vi.fn(() => {
  isDriverActive = true;
});
const mockSetConfig = vi.fn((cfg: any) => {
  capturedConfig = cfg;
});
const mockSetSteps = vi.fn((steps: any[]) => {
  capturedSteps = steps;
});
const mockIsActive = vi.fn(() => isDriverActive);

const mockDriverInstance = {
  isActive: mockIsActive,
  destroy: mockDestroy,
  setConfig: mockSetConfig,
  setSteps: mockSetSteps,
  drive: mockDrive,
};

vi.mock("driver.js", () => {
  return {
    driver: vi.fn(() => mockDriverInstance),
  };
});

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, val: string) => storage.set(key, String(val)),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
  get length() {
    return storage.size;
  },
  key: (index: number) => Array.from(storage.keys())[index] ?? null,
};

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("Product Tour configuration & utilities", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", localStorageMock);
    localStorage.clear();
    window.matchMedia =
      window.matchMedia ||
      vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("mapPathnameToTourKey", () => {
    it("maps paths to correct page keys", () => {
      expect(mapPathnameToTourKey("/")).toBe("home");
      expect(mapPathnameToTourKey("/workspace/ask")).toBe("ask");
      expect(mapPathnameToTourKey("/workspace/history")).toBe("history");
      expect(mapPathnameToTourKey("/workspace/history/case-123")).toBe("history");
      expect(mapPathnameToTourKey("/workspace/inbox")).toBe("inbox");
      expect(mapPathnameToTourKey("/workspace/inbox/case-456")).toBe("inbox");
      expect(mapPathnameToTourKey("/workspace/exceptions")).toBe("exceptions");
      expect(mapPathnameToTourKey("/workspace/documents")).toBe("documents");
      expect(mapPathnameToTourKey("/audit")).toBe("audit");
      expect(mapPathnameToTourKey("/verify")).toBe("verify");
      expect(mapPathnameToTourKey("/unknown")).toBe("home");
    });
  });

  describe("TOUR_STEPS declaration", () => {
    const expectedKeys: PageTourKey[] = [
      "app-shell",
      "home",
      "ask",
      "history",
      "inbox",
      "exceptions",
      "documents",
      "audit",
      "verify",
      "demo-scenario",
    ];

    it("declares steps for all required keys", () => {
      for (const key of expectedKeys) {
        expect(TOUR_STEPS[key]).toBeDefined();
        expect(TOUR_STEPS[key].length).toBeGreaterThan(0);
      }
    });

    it("defines the exact 6 app-shell steps as required", () => {
      const appShell = TOUR_STEPS["app-shell"];
      expect(appShell).toHaveLength(6);
      expect(appShell[0].element).toBe('[data-tour="app-logo"]');
      expect(appShell[1].element).toBe('[data-tour="main-nav"]');
      expect(appShell[2].element).toBe('[data-tour="account-switcher"]');
      expect(appShell[3].element).toBe('[data-tour="workspace-rail"]');
      expect(appShell[4].element).toBe('[data-tour="help-button"]');
      expect(appShell[5].element).toBe('[data-tour="account-switcher"]');
    });

    it("defines all required steps for home page", () => {
      const steps = TOUR_STEPS["home"];
      expect(steps.map((s) => s.element)).toEqual([
        '[data-tour="home-hero"]',
        '[data-tour="home-steps"]',
        '[data-tour="home-routing"]',
      ]);
      expect(steps[0].title).toBe("Bắt đầu nhanh");
      expect(steps[1].title).toBe("Quy trình 3 bước");
      expect(steps[2].title).toBe("Cách AI phân luồng");
    });

    it("defines all required steps for ask page", () => {
      const steps = TOUR_STEPS["ask"];
      expect(steps.map((s) => s.element)).toEqual([
        '[data-tour="ask-course"]',
        '[data-tour="ask-group"]',
        '[data-tour="ask-input"]',
        '[data-tour="ask-suggestions"]',
        '[data-tour="ask-progress"]',
        '[data-tour="ask-result"]',
        '[data-tour="ask-try"]',
      ]);
      expect(steps[0].title).toBe("Chọn môn học");
      expect(steps[1].title).toBe("Chọn nhóm");
      expect(steps[2].title).toBe("Đặt câu hỏi");
      expect(steps[3].title).toBe("Gợi ý nhanh");
      expect(steps[4].title).toBe("Theo dõi xử lý");
      expect(steps[5].title).toBe("Đọc kết quả");
      expect(steps[6].title).toBe("Thử ngay");
    });

    it("defines all required steps for history page", () => {
      const steps = TOUR_STEPS["history"];
      expect(steps.map((s) => s.element)).toEqual([
        '[data-tour="history-search"]',
        '[data-tour="history-filters"]',
        '[data-tour="history-first-row"]',
        '[data-tour="history-reading-mode"]',
        '[data-tour="history-refresh"]',
      ]);
      expect(steps[0].title).toBe("Tìm hồ sơ");
      expect(steps[1].title).toBe("Lọc theo trạng thái");
      expect(steps[2].title).toBe("Mở một hồ sơ");
      expect(steps[3].title).toBe("Chế độ đọc");
      expect(steps[4].title).toBe("Cập nhật kết quả");
    });

    it("defines all required steps for inbox page", () => {
      const steps = TOUR_STEPS["inbox"];
      expect(steps.map((s) => s.element)).toEqual([
        '[data-tour="inbox-filters"]',
        '[data-tour="inbox-first-row"]',
        '[data-tour="inbox-citations"]',
        '[data-tour="inbox-decision"]',
        '[data-tour="inbox-exception"]',
        '[data-tour="inbox-sla"]',
      ]);
      expect(steps[0].title).toBe("Hàng chờ thẩm định");
      expect(steps[1].title).toBe("Mở hồ sơ");
      expect(steps[2].title).toBe("Căn cứ quy chế");
      expect(steps[3].title).toBe("Ra quyết định");
      expect(steps[4].title).toBe("Tạo ngoại lệ");
      expect(steps[5].title).toBe("Thời hạn xử lý");
    });

    it("defines all required steps for exceptions page", () => {
      const steps = TOUR_STEPS["exceptions"];
      expect(steps.map((s) => s.element)).toEqual([
        '[data-tour="exceptions-filters"]',
        '[data-tour="exceptions-table"]',
        '[data-tour="exceptions-revoke"]',
      ]);
      expect(steps[0].title).toBe("Lọc ngoại lệ");
      expect(steps[1].title).toBe("Danh sách ngoại lệ");
      expect(steps[2].title).toBe("Thu hồi");
    });

    it("defines all required steps for documents page", () => {
      const steps = TOUR_STEPS["documents"];
      expect(steps.map((s) => s.element)).toEqual([
        '[data-tour="docs-stepper"]',
        '[data-tour="docs-meta"]',
        '[data-tour="docs-upload"]',
        '[data-tour="docs-text"]',
        '[data-tour="docs-submit"]',
        '[data-tour="docs-conflicts"]',
        '[data-tour="docs-try"]',
      ]);
      expect(steps[0].title).toBe("Ba bước tiếp nhận");
      expect(steps[1].title).toBe("Thông tin tài liệu");
      expect(steps[2].title).toBe("Tải tệp");
      expect(steps[3].title).toBe("Hoặc dán văn bản");
      expect(steps[4].title).toBe("Trích xuất");
      expect(steps[5].title).toBe("Xử lý xung đột");
      expect(steps[6].title).toBe("Thử ngay");
    });

    it("defines all required steps for audit page", () => {
      const steps = TOUR_STEPS["audit"];
      expect(steps.map((s) => s.element)).toEqual([
        '[data-tour="audit-search"]',
        '[data-tour="audit-filters"]',
        '[data-tour="audit-table"]',
        '[data-tour="audit-expand"]',
      ]);
      expect(steps[0].title).toBe("Tìm sự kiện");
      expect(steps[1].title).toBe("Lọc loại sự kiện");
      expect(steps[2].title).toBe("Nhật ký không sửa được");
      expect(steps[3].title).toBe("Xem chi tiết");
    });

    it("defines all required steps for verify page", () => {
      const steps = TOUR_STEPS["verify"];
      expect(steps.map((s) => s.element)).toEqual([
        '[data-tour="verify-run"]',
        '[data-tour="verify-metrics"]',
        '[data-tour="verify-latency"]',
        '[data-tour="verify-table"]',
      ]);
      expect(steps[0].title).toBe("Chạy kiểm thử");
      expect(steps[1].title).toBe("Chỉ số chính");
      expect(steps[2].title).toBe("Thời gian xử lý");
      expect(steps[3].title).toBe("Kết quả từng ca");
    });

    it("defines all 4 steps for demo-scenario tour", () => {
      const steps = TOUR_STEPS["demo-scenario"];
      expect(steps).toHaveLength(4);
      expect(steps[0].title).toContain("Gửi câu hỏi");
      expect(steps[1].title).toContain("Đổi sang tài khoản Giảng viên");
      expect(steps[2].title).toContain("Phê duyệt kèm tạo ngoại lệ");
      expect(steps[3].title).toContain("Kiểm tra kết quả cập nhật");
    });
  });

  describe("Storage helpers", () => {
    it("tracks seen tours per role and allows reset", () => {
      expect(hasAnyTourSeen()).toBe(false);
      expect(hasSeenTourKey("student", "home")).toBe(false);
      expect(hasSeenTourKey("lecturer", "home")).toBe(false);

      markTourSeen("student", "home");
      expect(hasSeenTourKey("student", "home")).toBe(true);
      expect(hasSeenTourKey("lecturer", "home")).toBe(false);
      expect(hasAnyTourSeen()).toBe(true);

      markTourSeen("lecturer", "inbox");
      expect(hasSeenTourKey("lecturer", "inbox")).toBe(true);

      resetAllTourKeys();
      expect(hasSeenTourKey("student", "home")).toBe(false);
      expect(hasSeenTourKey("lecturer", "inbox")).toBe(false);
      expect(hasAnyTourSeen()).toBe(false);
    });
  });

  describe("Tour lifecycle & driver.js integration", () => {
    let container: HTMLDivElement | null = null;
    let root: any = null;
    let tourContextValue: any = null;

    function TestConsumer() {
      const ctx = useContext(TourContext);
      tourContextValue = ctx;
      return null;
    }

    function renderTour(initialPath = "/workspace/inbox", role: "student" | "lecturer" = "lecturer") {
      act(() => {
        root.render(
          React.createElement(
            MemoryRouter,
            { initialEntries: [initialPath] },
            React.createElement(
              TourProvider,
              { currentRole: role },
              React.createElement(TestConsumer)
            )
          )
        );
      });
    }

    function setupDomForTour(keys: PageTourKey[]) {
      keys.forEach((key) => {
        (TOUR_STEPS[key] || []).forEach((step) => {
          const match = step.element.match(/\[data-tour="([^"]+)"\]/);
          if (match) {
            let el = document.querySelector(step.element);
            if (!el) {
              el = document.createElement("div");
              el.setAttribute("data-tour", match[1]);
              document.body.appendChild(el);
            }
          }
        });
      });
    }

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
      isDriverActive = false;
      capturedConfig = null;
      capturedSteps = [];
      mockDestroy.mockClear();
      mockDrive.mockClear();
      mockSetConfig.mockClear();
      mockSetSteps.mockClear();
      mockIsActive.mockClear();

      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
      setupDomForTour(["app-shell", "inbox"]);
    });

    afterEach(() => {
      if (root) {
        act(() => {
          root.unmount();
        });
      }
      if (container) {
        container.remove();
      }
      document.body.innerHTML = "";
      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it("hoàn thành tour bằng nút cuối (onHighlightStarted + onDestroyStarted) → ghi key vào localStorage", () => {
      renderTour("/workspace/inbox", "lecturer");

      expect(hasSeenTourKey("lecturer", "inbox")).toBe(false);

      act(() => {
        tourContextValue.startTour("inbox");
      });

      expect(mockDrive).toHaveBeenCalled();
      expect(capturedSteps.length).toBeGreaterThan(0);

      // Check onHighlightStarted on the final step
      const lastIndex = capturedSteps.length - 1;
      const lastStep = capturedSteps[lastIndex];
      expect(lastStep.onHighlightStarted).toBeDefined();

      // Trigger final step highlight
      act(() => {
        lastStep.onHighlightStarted();
      });
      expect(hasSeenTourKey("lecturer", "inbox")).toBe(true);

      // Click done button on the final step -> triggers onDestroyStarted
      expect(capturedConfig.onDestroyStarted).toBeDefined();
      act(() => {
        capturedConfig.onDestroyStarted(null, lastStep, { driver: mockDriverInstance });
      });

      expect(hasSeenTourKey("lecturer", "inbox")).toBe(true);
      expect(mockDestroy).toHaveBeenCalled();
    });

    it("đóng tour bằng nút X → ghi key vào localStorage và gọi driver.destroy()", () => {
      renderTour("/workspace/inbox", "lecturer");

      expect(hasSeenTourKey("lecturer", "inbox")).toBe(false);

      act(() => {
        tourContextValue.startTour("inbox");
      });

      // User closes at first step via X button
      const firstStep = capturedSteps[0];
      act(() => {
        capturedConfig.onDestroyStarted(null, firstStep, { driver: mockDriverInstance });
      });

      expect(hasSeenTourKey("lecturer", "inbox")).toBe(true);
      expect(mockDestroy).toHaveBeenCalled();
    });

    it("app-shell xong → tour trang được gọi đúng một lần sau 250ms", () => {
      renderTour("/workspace/inbox", "lecturer");

      expect(hasSeenTourKey("lecturer", "app-shell")).toBe(false);
      expect(hasSeenTourKey("lecturer", "inbox")).toBe(false);

      // Advance timers by 1000ms to trigger auto-run interval
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockDrive).toHaveBeenCalled();
      const initialDriveCalls = mockDrive.mock.calls.length;

      // Complete app-shell tour via onDestroyStarted
      act(() => {
        capturedConfig.onDestroyStarted(null, capturedSteps[capturedSteps.length - 1], {
          driver: mockDriverInstance,
        });
      });

      // app-shell seen key recorded immediately
      expect(hasSeenTourKey("lecturer", "app-shell")).toBe(true);
      expect(mockDestroy).toHaveBeenCalled();

      // Page tour has not started before 250ms
      expect(mockDrive.mock.calls.length).toBe(initialDriveCalls);

      // Advance 250ms: chained page tour starts
      act(() => {
        vi.advanceTimersByTime(250);
      });

      // Exactly one more drive() call for inbox tour
      expect(mockDrive.mock.calls.length).toBe(initialDriveCalls + 1);
      expect(capturedSteps[0].element).toBe(TOUR_STEPS["inbox"][0].element);

      // Advance more time to verify it is NOT called again
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(mockDrive.mock.calls.length).toBe(initialDriveCalls + 1);
    });

    it("ẩn nút Quay lại ở bước đầu tiên (showButtons không có previous)", () => {
      renderTour("/workspace/inbox", "lecturer");

      act(() => {
        tourContextValue.startTour("inbox");
      });

      expect(capturedSteps[0].popover.showButtons).toEqual(["next", "close"]);
      expect(capturedSteps[0].popover.showButtons).not.toContain("previous");

      if (capturedSteps.length > 1) {
        expect(capturedSteps[1].popover.showButtons).toContain("previous");
        expect(capturedSteps[1].popover.showButtons).toContain("next");
        expect(capturedSteps[1].popover.showButtons).toContain("close");
      }
    });
  });
});
