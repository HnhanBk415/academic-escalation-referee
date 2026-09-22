import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { IconScale } from "../components/Icons";
import type { PolicyException } from "../types";

export function ExceptionsView() {
  const [exceptions, setExceptions] = useState<PolicyException[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadExceptions() {
      setLoading(true);
      try {
        const data = await api<PolicyException[]>("/api/exceptions");
        if (Array.isArray(data)) {
          setExceptions(data);
        }
      } catch (err) {
        console.warn("Could not load policy exceptions", err);
      } finally {
        setLoading(false);
      }
    }
    loadExceptions();
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] overflow-y-auto">
      {/* Header */}
      <div className="px-8 pt-6 pb-4 border-b border-slate-200 bg-white flex-shrink-0">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Ngoại lệ quy chế</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Danh sách các ngoại lệ chính sách đã được tạo và phê duyệt
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 flex flex-col">
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-slate-400 text-sm">
            Đang tải dữ liệu ngoại lệ quy chế...
          </div>
        ) : exceptions.length === 0 ? (
          /* Empty State as shown in 4.png */
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-300/80 flex items-center justify-center mx-auto mb-3.5 text-slate-500 shadow-xs">
                <IconScale size={24} />
              </div>
              <p className="text-sm text-slate-500 font-medium">
                Chưa có ngoại lệ quy chế nào được tạo
              </p>
            </div>
          </div>
        ) : (
          /* Populated Exceptions Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
            {exceptions.map((ex) => (
              <div
                key={ex.id}
                className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded text-[11px] font-bold font-mono">
                    {ex.scope_type} · {ex.scope_id}
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold uppercase">
                    {ex.status}
                  </span>
                </div>
                <p className="text-sm text-slate-800 leading-relaxed font-medium">
                  {ex.content}
                </p>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Học phần: <strong>{ex.course_id}</strong></span>
                  <span className="font-mono">{ex.valid_from} → {ex.valid_until}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
