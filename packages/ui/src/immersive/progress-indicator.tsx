export interface ProgressIndicatorProps {
  total: number;
  currentIndex: number;
  itemHrefs?: Array<string | undefined>;
}

export function ProgressIndicator({ total, currentIndex, itemHrefs = [] }: ProgressIndicatorProps) {
  return (
    <ol className="immersive-progress" aria-label="Immersive gallery progress">
      {Array.from({ length: total }).map((_, index) => {
        const href = itemHrefs[index];
        const isActive = index === currentIndex;
        const content = <span>{index + 1}</span>;

        return (
          <li
            aria-current={isActive ? "step" : undefined}
            className={isActive ? "is-active" : ""}
            key={index}
          >
            {href ? (
              <a href={href} aria-label={`Open scene ${index + 1}`}>
                {content}
              </a>
            ) : content}
          </li>
        );
      })}
    </ol>
  );
}
