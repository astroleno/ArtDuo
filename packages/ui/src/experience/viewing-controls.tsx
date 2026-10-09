"use client";

import { PREFERENCE_LABELS, type ViewingPreference, type ViewingSession } from "./viewing-session";

export function ViewingControls({ session, onPreference, onCancel, onTogglePace, onClear, storageAvailable }: {
  session: ViewingSession; onPreference: (preference: ViewingPreference) => void;
  onCancel: () => void; onTogglePace: () => void; onClear: () => void; storageAvailable: boolean;
}) {
  const remaining = session.order.length - session.frontier - 1;
  return <section className="experience-viewing-controls" aria-label="调整后续观看">
    <p className="experience-panel-label">接下来，想怎样看？</p>
    <p className="experience-panel-help">调整只影响还没走到的作品。</p>
    <div className="experience-preferences">
      {(["quieter", "similar", "different", "original"] as const).map((preference) => <button
        key={preference} type="button" disabled={remaining < 2}
        aria-pressed={session.pending?.preference === preference}
        onClick={() => onPreference(preference)}
      >{PREFERENCE_LABELS[preference]}</button>)}
    </div>
    {remaining < 2 ? <p className="experience-panel-help">{remaining === 0 ? "已走过整条路线。" : "剩下一件作品，保持当前顺序。"}</p> : null}
    {session.pending ? <p className="experience-pending">下次进入未看部分时：{PREFERENCE_LABELS[session.pending.preference]} <button type="button" onClick={onCancel}>取消调整</button></p> : null}
    <p className="experience-adaptation-status" role="status">{session.message}</p>
    {session.revisions.length ? <p className="experience-panel-help">最近一次：{session.revisions.at(-1)!.reason}。选择“保持原来的路线”可恢复剩余部分的原始顺序。</p> : null}
    <label className="experience-pace-choice"><input type="checkbox" checked={session.paceEnabled} onChange={onTogglePace} />换画节奏跟随我的观看速度</label>
    <details className="experience-observation-notes"><summary>本次观看记录</summary>
      <p>仅保存在当前标签页，用于调整换画节奏，不推测心情。</p>
      <p>{session.observations.length} 件作品有观看记录</p>
      <button type="button" className="experience-text-button" onClick={onClear}>清除观看记录</button>
    </details>
    {!storageAvailable ? <p className="experience-panel-help" role="status">浏览器无法保存观看记录；当前观看仍可继续，路线会保留在链接中。</p> : null}
  </section>;
}
