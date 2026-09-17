import { Icon } from './icons';

export function LoadingState({ cards = 4 }: { cards?: number }) {
  return <div className="skeleton-grid" aria-label="Loading">{Array.from({ length: cards }, (_, index) => <div className="skeleton-card" key={index}><i/><i/><i/></div>)}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="premium-empty"><span><Icon name="activity"/></span><h3>{title}</h3>{description && <p>{description}</p>}{action}</div>;
}
