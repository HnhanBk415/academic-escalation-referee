import { FormEvent, useState } from "react";

import { ApiError, postJson, setAccessToken } from "../api/client";

export interface AuthActor {
  id: string;
  display_name: string;
  role: "STUDENT" | "LECTURER" | "ACADEMIC_AFFAIRS";
}

interface LoginResponse {
  access_token: string;
  actor: AuthActor;
}

export function LoginPage({ onLoggedIn }: { onLoggedIn: (actor: AuthActor) => void }) {
  const [actorId, setActorId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await postJson<LoginResponse>("/api/v1/auth/login", {
        actor_id: actorId.trim(),
        password,
      });
      setAccessToken(result.access_token);
      onLoggedIn(result.actor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể kết nối tới hệ thống.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-slate-950 px-5 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl shadow-black/30">
        <div className="mb-7 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-red-600 font-mono text-base font-semibold tracking-wide text-white">
            AER
          </div>
          <div>
            <h1 className="text-lg font-semibold">Academic Escalation Referee</h1>
            <p className="text-sm text-slate-500">Đăng nhập để tiếp tục</p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold text-slate-700">
            Mã tài khoản
            <input
              autoComplete="username"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              onChange={(event) => setActorId(event.target.value)}
              required
              value={actorId}
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Mật khẩu
            <input
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button
            className="w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
        <p className="mt-5 text-xs leading-5 text-slate-500">
          Tài khoản được quản trị viên cấp. Phiên đăng nhập chỉ được lưu trong tab trình duyệt hiện tại.
        </p>
      </section>
    </main>
  );
}
