export interface ProgressIndicatorProps {
  total: number;
  currentIndex: number;
}

export function ProgressIndicator({ total, currentIndex }: ProgressIndicatorProps) {
  return (
    <ol className="immersive-progress" aria-label="Immersive gallery progress">
      {Array.from({ length: total }).map((_, index) => (
        <li
          aria-current={index === currentIndex ? "step" : undefined}
          className={index === currentIndex ? "is-active" : ""}
          key={index}
        >
          <span>{index + 1}</span>
        </li>
      ))}
    </ol>
  );
}
