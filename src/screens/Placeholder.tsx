import { Screen, EmptyState } from '../components/Screen.tsx';

/**
 * Stand-in for the screens that arrive in later phases, so the navigation
 * shell is complete and testable on the phone now.
 */
export function Placeholder({
  title,
  icon,
  phase,
  body,
}: {
  title: string;
  icon: string;
  phase: string;
  body: string;
}) {
  return (
    <Screen title={title} subtitle={phase}>
      <EmptyState icon={icon} title={`${title} comes next`} body={body} />
    </Screen>
  );
}
