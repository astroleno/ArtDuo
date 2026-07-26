export interface ProgressIndicatorProps {
  total: number;
  currentIndex: number;
  itemHrefs?: Array<string | undefined>;
  onSelect?: (index: number) => void;
  disabled?: boolean;
}

function mobileVisibleIndexes(total: number, currentIndex: number): Set<number> {
  const windowSize = Math.min(5, total);
  const halfWindow = Math.floor(windowSize / 2);
  const start = Math.max(0, Math.min(currentIndex - halfWindow, total - windowSize));

  return new Set(Array.from({ length: windowSize }).map((_, offset) => start + offset));
}

export function ProgressIndicator({ total, currentIndex, itemHrefs = [], onSelect, disabled = false }: ProgressIndicatorProps) {
  const mobileIndexes = mobileVisibleIndexes(total, currentIndex);
  const canSelect = Boolean(onSelect || itemHrefs.some(Boolean));

  return (
    <div className="immersive-progress-wrap">
      <span className="immersive-progress-count" aria-hidden="true">
        {currentIndex + 1} / {total}
      </span>
      <ol
        className={canSelect ? "immersive-progress has-jump-targets" : "immersive-progress"}
        aria-label={`观展进度，第 ${currentIndex + 1} 幅，共 ${total} 幅`}
      >
        {Array.from({ length: total }).map((_, index) => {
          const href = itemHrefs[index];
          const isActive = index === currentIndex;
          const content = <span>{index + 1}</span>;
          const ariaLabel = isActive
            ? `当前第 ${index + 1} 幅，共 ${total} 幅`
            : `跳到第 ${index + 1} 幅，共 ${total} 幅`;
          const className = [
            isActive ? "is-active" : "",
            mobileIndexes.has(index) ? "is-mobile-visible" : "",
          ].filter(Boolean).join(" ");

          return (
            <li
              aria-current={isActive ? "step" : undefined}
              className={className}
              key={index}
            >
              {onSelect ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(index)}
                  aria-label={ariaLabel}
                >
                  {content}
                </button>
              ) : href ? (
                <a href={href} aria-label={ariaLabel}>
                  {content}
                </a>
              ) : content}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
