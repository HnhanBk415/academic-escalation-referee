import { useEffect, useState } from "react";

import { api, postJson } from "../api/client";
import { IconScale } from "../components/Icons";
import type { CourseExceptionOverview, PolicyException } from "../types";

export function ExceptionsView() {
  const [courses, setCourses] = useState<CourseExceptionOverview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadExceptions() {
    setLoading(true);
    setError("");
    try {
      const data = await api<CourseExceptionOverview[]>("/api/exceptions/overview");
      setCourses(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải ngoại lệ.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadExceptions();
  }, []);

  async function revoke(item: PolicyException) {
    const reason = window.prompt("Lý do thu hồi ngoại lệ:");
    if (!reason) return;
    try {
      await postJson(`/api/exceptions/${item.id}/revoke`, {
        actor_id: "lecturer-01",
        reason,
      });
      await loadExceptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể thu hồi ngoại lệ.");
    }
  }

  function exceptionCard(item: PolicyException) {
    return (
      <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="font-mono text-slate-500">{item.scope_type} · {item.scope_id}</span>
          <span className={`rounded px-2 py-0.5 font-bold ${item.is_effective ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
            {item.effective_status}
          </span>
        </div>
        <p className="text-sm font-medium leading-relaxed text-slate-800">{item.content}</p>
        <p className="mt-1 font-mono text-[11px] font-semibold text-sky-700">{item.policy_topic}</p>
        <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-slate-500">
          <span>{item.valid_from} → {item.valid_until}</span>
          {item.status === "ACTIVE" && (
            <button type="button" onClick={() => revoke(item)} className="font-semibold text-rose-700">
              Thu hồi
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#F8FAFC]">
      <div className="flex-shrink-0 border-b border-slate-200 bg-white px-8 pb-4 pt-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Ngoại lệ quy chế</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Theo dõi theo môn và tên nhóm, bao gồm cả nhóm chưa có ngoại lệ
        </p>
      </div>

      <div className="flex flex-1 flex-col p-8">
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            Đang tải dữ liệu ngoại lệ quy chế...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>
        ) : courses.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="py-16 text-center">
              <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-full border border-slate-300/80 bg-slate-100 text-slate-500 shadow-xs">
                <IconScale size={24} />
              </div>
              <p className="text-sm font-medium text-slate-500">Chưa có dữ liệu môn và nhóm</p>
            </div>
          </div>
        ) : (
          <div className="grid max-w-5xl gap-5">
            {courses.map((course) => (
              <section key={course.course_id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                  <h2 className="font-bold text-slate-900">{course.course_code} · {course.course_name}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Học kỳ {course.semester}</p>
                </div>
                <div className="grid gap-4 p-5">
                  {course.course_exceptions.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Áp dụng toàn môn</h3>
                      <div className="grid gap-2 md:grid-cols-2">{course.course_exceptions.map(exceptionCard)}</div>
                    </div>
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    {course.groups.map((group) => {
                      const activeCount = group.exceptions.filter((item) => item.is_effective).length;
                      return (
                        <article key={group.group_id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <h3 className="font-bold text-slate-800">{group.group_name}</h3>
                              <p className="font-mono text-[11px] text-slate-500">{group.group_id}</p>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${activeCount ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                              {activeCount ? `${activeCount} ngoại lệ hiệu lực` : "Không có ngoại lệ"}
                            </span>
                          </div>
                          <div className="grid gap-2">
                            {group.exceptions.length ? group.exceptions.map(exceptionCard) : (
                              <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-500">
                                Nhóm này đang áp dụng quy định chung của môn.
                              </p>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  {course.student_exceptions.length > 0 && (
                    <details>
                      <summary className="cursor-pointer text-xs font-bold text-slate-600">
                        Ngoại lệ cá nhân ({course.student_exceptions.length})
                      </summary>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">{course.student_exceptions.map(exceptionCard)}</div>
                    </details>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
